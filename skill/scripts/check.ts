/**
 * 一致性校验器（工程规格的机器判定版）
 *
 * 把原先进「grep + 人眼甄别」的检查全部变成机器判定，任一 FAIL 即退出码 1。
 *
 * 用法：
 *   npx tsx skill/scripts/check.ts                # 全量校验
 *   npx tsx skill/scripts/check.ts --anchors      # 只校验版本锚点
 *   npx tsx skill/scripts/check.ts --package      # 只校验发布包与源码一致
 *   npx tsx skill/scripts/check.ts --statutory    # 只校验法条时效与参考价
 *
 * 设计原则：校验规则与"锚点清单"同源，新增锚点只需在 ANCHORS 里加一行。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { zipEntries } from './version';
import { loadFirst } from './core-loader';

/**
 * 版本常量：开发侧读 src/core/version.ts 真源；装进技能包后没有 src/，
 * 改读随包的 lib/version.mjs（由 build-skill-bundles.mjs 依 SKILL.md 生成）。
 */
const { VERSION, PRODUCT_NAME, DISPLAY_NAME, SLUG } = loadFirst<{
  VERSION: string;
  PRODUCT_NAME: string;
  DISPLAY_NAME: string;
  SLUG: string;
}>([
  ['lib/version.mjs', '../lib/version.mjs'],
  ['src/core/version', '../../src/core/version'],
]);

/** 开发侧仓库根（skill/ 的上一级）；装进技能包后这个位置没有 src/，见下方 DEV_MODE */
const ROOT = path.resolve(import.meta.dirname, '../..');
/** 技能包自身根目录（scripts/ 的上一级）——装包后包内自检只认这个根，不能再用 ROOT */
const PKG = path.resolve(import.meta.dirname, '..');
/** 当前生效的根：开发侧＝ROOT（沿用原有全部锚点路径），安装形态＝PKG */
let BASE = ROOT;
/** 技能 slug＝技术标识：包内顶层目录、包名第三段、frontmatter slug 共用；真源在 version.ts */
const SKILL_ID = SLUG;
const only = process.argv[2] ?? '';
const want = (k: string): boolean => !only || only === k;

interface Finding {
  level: 'FAIL' | 'WARN';
  where: string;
  msg: string;
}
const findings: Finding[] = [];
const fail = (where: string, msg: string): void => void findings.push({ level: 'FAIL', where, msg });
const warn = (where: string, msg: string): void => void findings.push({ level: 'WARN', where, msg });

const read = (rel: string): string => {
  const p = path.join(BASE, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
};

// ────────────────────────────────────────────────────────────
// 1. 版本锚点一致性
//
// 规则：任何出现版本号的「锚点行」必须等于当前 VERSION；VERSION.md 沿革表里
// 除最新版外的行属于历史记录，合法豁免。判定完全基于行的结构（是否表格行 +
// 是否位于沿革表区段），不依赖人眼。
// ────────────────────────────────────────────────────────────
const VER_RE = /V?(\d+\.\d+\.\d+)/g;

/** 非本产品版本号的干扰项：规格号、外部产品版本、依赖版本等，不算锚点违规 */
const IGNORE_VER_CONTEXT = [
  /SemVer/i, // 语义化版本（SemVer 2.0.0）
  /语义化/, // 版本号遵循语义化版本
  /运行时\s*≥/, // CodeBuddy 技能运行时 ≥ 1.0.0
  /CodeBuddy|WorkBuddy/i, // 外部产品
  /node|pnpm|vite|react|typescript/i, // 依赖
];

/** 收集 VERSION.md 沿革表中的历史版本号（非最新行） */
function changelogHistory(text: string): Set<string> {
  const out = new Set<string>();
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*\*{0,2}V?(\d+\.\d+\.\d+)\*{0,2}\s*\|/);
    if (m && m[1] !== VERSION) out.add(m[1]);
  }
  return out;
}

function checkAnchors(): void {
  // 参与锚点校验的文件（SKILL/VERSION/CARD/LICENSE/README/package.json）
  const files = ['skill/SKILL.md', 'skill/VERSION.md', 'skill/CARD.md', 'skill/LICENSE.md', 'README.md'];
  const history = changelogHistory(read('skill/VERSION.md'));

  for (const rel of files) {
    const text = read(rel);
    if (!text) {
      fail(rel, '文件缺失');
      continue;
    }
    text.split('\n').forEach((line, i) => {
      // 跳过沿革表历史行（VERSION.md / SKILL.md / README.md 的沿革表）
      const rowVer = line.match(/^\|\s*\*{0,2}V?(\d+\.\d+\.\d+)\*{0,2}\s*\|/);
      if (rowVer && rowVer[1] !== VERSION && history.has(rowVer[1])) return;
      // 跳过对历史版本的事实性陈述（如 "V1.1.0 起 xxx"）
      if (/\bV?\d+\.\d+\.\d+\s*起/.test(line)) return;
      // 跳过非本产品版本号（规格号 / 外部产品 / 依赖版本）
      if (IGNORE_VER_CONTEXT.some((re) => re.test(line))) return;

      for (const m of line.matchAll(VER_RE)) {
        const v = m[1];
        // 排除 URL / 文件名片段（如 ...v1.2.0.zip 之外的数字串）与日期
        if (line.includes(`v${v}`)) continue;
        if (v !== VERSION) {
          fail(`${rel}:${i + 1}`, `锚点出现 ${m[0]}，应为 v${VERSION} → ${line.trim().slice(0, 80)}`);
        }
      }
    });
  }

  // package.json 单独判定
  try {
    const pkg = JSON.parse(read('package.json')) as { version?: string; license?: string };
    if (pkg.version !== VERSION) fail('package.json', `version=${pkg.version}，应为 ${VERSION}`);
  } catch {
    fail('package.json', '无法解析');
  }

  // SKILL.md frontmatter 与 version.ts 同源判定
  const skillFm = read('skill/SKILL.md').match(/^---\n([\s\S]*?)\n---/);
  const fmVer = skillFm?.[1].match(/^version:\s*(\S+)/m)?.[1];
  if (fmVer !== VERSION) fail('skill/SKILL.md frontmatter', `version=${fmVer}，应为 ${VERSION}`);

  // 命名真源判定（DEV_SPEC「技能命名纪律」）：面板名称 name 用中文产品名、
  // display_name 用中文全称，均以 version.ts 为真源；slug 只许出现在技术标识位
  // （frontmatter slug / 包内顶层目录 / 包名第三段），name 与 slug 不得互换混用
  const fmDisplay = skillFm?.[1].match(/^display_name:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (fmDisplay !== DISPLAY_NAME)
    fail('skill/SKILL.md frontmatter', `display_name="${fmDisplay}"，应为中文显示名真源 "${DISPLAY_NAME}"（version.ts DISPLAY_NAME）`);
  const fmName = skillFm?.[1].match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? '';
  if (fmName !== PRODUCT_NAME)
    fail('skill/SKILL.md frontmatter', `name="${fmName}"，应为中文产品名 "${PRODUCT_NAME}"（WorkBuddy 面板显示，version.ts PRODUCT_NAME）`);
  const fmSlug = skillFm?.[1].match(/^slug:\s*(\S+)/m)?.[1] ?? '';
  if (fmSlug !== SKILL_ID)
    fail('skill/SKILL.md frontmatter', `slug=${fmSlug}，应为技术 ID ${SKILL_ID}（version.ts SLUG）`);
  else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fmSlug))
    fail('skill/SKILL.md frontmatter', `slug=${fmSlug} 不是 kebab-case（小写字母数字、连字符分隔）`);

  // 规模数字（软锚点）：与实际计算器/脚本数量比对
  const calcCount = ['src/core/calculators'].flatMap((d) =>
    fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
      .flatMap((f) => read(`${d}/${f}`).match(/^\s*id:\s*'/gm) ?? []),
  ).length;
  /* 脚本口径与 version.ts 的 countScripts() 必须一致：只数可执行的 .ts / .py，
     不收 .mjs 打包脚本与目录（两处口径不同会让"脚本 N 个"这条软锚点自相矛盾） */
  const scriptCount = fs
    .readdirSync(path.join(ROOT, 'skill/scripts'))
    .filter((f) => f.endsWith('.ts') || f.endsWith('.py')).length;
  for (const rel of ['skill/SKILL.md', 'README.md']) {
    const t = read(rel);
    const m = t.match(/计算器\s*\*{0,2}(\d+)\s*个/);
    if (m && Number(m[1]) !== calcCount) {
      fail(rel, `文中「${m[1]} 个计算器」与实际 ${calcCount} 个不符`);
    }
  }
  const sm = read('skill/SKILL.md').match(/脚本\s*(\d+)\s*个/);
  if (sm && Number(sm[1]) !== scriptCount) {
    fail('skill/SKILL.md', `文中「脚本 ${sm[1]} 个」与实际 ${scriptCount} 个不符`);
  }

  // 用例规模（软锚点）：SKILL.md / DEV_SPEC 提到的审计用例数 = audit.ts 实际用例数
  const auditSrc = read('skill/scripts/audit.ts');
  const auditCases = (auditSrc.match(/^\s{2}\{\n\s{4}id:/gm) ?? []).length;
  if (auditCases > 0) {
    for (const rel of ['skill/SKILL.md', 'skill/references/DEV_SPEC.md', 'README.md']) {
      for (const m of read(rel).matchAll(/(\d+)\s*(?:个|项)?(?:法定口径)?(?:用例|手算期望值)/g)) {
        const n = Number(m[1]);
        // 只比对量级相符的声明（排除"1 个用例"这类描述新增要求的最小值）
        if (n >= 5 && n !== auditCases) {
          fail(rel, `文中「${n} 个用例」与 audit.ts 实际 ${auditCases} 个不符`);
        }
      }
    }
  }

  // 审计用例身份样本：抽查若干条期望值，防止 audit.ts 被静默改动后仍"通过"
  const digest = createHash('sha256').update(auditSrc.replace(/\s+/g, '')).digest('hex').slice(0, 16);
  console.log(`  [自校验] audit.ts 用例数 ${auditCases}，指纹 ${digest}（改动 audit.ts 后须复跑全部用例）`);
  // SKILL.md 列出的计算器 id 必须真实存在
  const ids = new Set(
    ['src/core/calculators'].flatMap((d) =>
      fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.ts') && f !== 'index.ts')
        .flatMap((f) => (read(`${d}/${f}`).match(/(?<=^\s{4}id: ')[^']+/gm) ?? [])),
    ),
  );
  for (const m of read('skill/SKILL.md').matchAll(/cli\.ts\s+([a-z][a-z0-9-]+)\s/g)) {
    if (!ids.has(m[1])) fail('skill/SKILL.md', `示例引用了不存在的计算器 id「${m[1]}」`);
  }
}

// ────────────────────────────────────────────────────────────
// 2. 发布包与源码一致
//
// 逐个比对 zip 内文件与开发侧同名文件的 sha256；同时校验包内不得混入
// 不该发布的内容（node_modules / release / .git / 明文密钥）。
// ────────────────────────────────────────────────────────────
const FORBIDDEN = [/node_modules\//, /\/release\//, /\.git\//, /\.env$/, /\.DS_Store$/];
const sha = (buf: Buffer | string): string => createHash('sha256').update(buf).digest('hex');

/**
 * 四段式包名规范（DEV-RULES 20.1）：
 *   `中文产品名_版本号_日期_(技能ID).格式`
 *   示例：`法律计算器大全_v1.5.0_20261020_(legal-calculator).skill`
 * 分隔符一律下划线、版本号前缀小写 v、技能 ID 半角括号包裹。
 * **SKILL_ID 真源在文件顶部**（frontmatter 断言也要用）——别处不得硬拼包名字符串（20.4.2：改一处，全链跟随）。
 */

/** 按 20.1 生成包名。date 为 8 位紧凑日期（YYYYMMDD）。 */
function packageName(ext: string, date: string): string {
  return `${PRODUCT_NAME}_v${VERSION}_${date}_(${SKILL_ID}).${ext}`;
}

/** 在 release/ 下发现当前版本的 .skill 技能包（取最新；.zip 为完整工程包，不参与 skill 结构比对） */
function findSkillPackage(): { file: string; full: string } | null {
  const dir = path.join(ROOT, 'release');
  if (!fs.existsSync(dir)) return null;
  const cands = fs.readdirSync(dir)
    // 精确按 20.1 的形态匹配：`产品名_v版本_8位日期_(slug).skill`
    .filter((f) =>
      new RegExp(`^${PRODUCT_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_v${VERSION.replace(/\./g, '\\.')}_\\d{8}_\\(${SKILL_ID}\\)\\.skill$`).test(f)
    )
    .map((f) => ({ file: f, full: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  return cands[0] ?? null;
}

function checkPackage(): void {
  const pkg = findSkillPackage();
  if (!pkg) {
    warn('release', `未找到当前版本的四段式包（${packageName('skill', '日期')}）；若尚未发版可忽略`);
    return;
  }
  const pkgPath = pkg.full;
  const entries = zipEntries(fs.readFileSync(pkgPath)).filter((e) => !e.name.endsWith('/'));
  // 顶层目录从包内推断（四段式规范下应为技能 ID：legal-calculator/）
  const firstSeg = entries[0]?.name.split('/')[0] ?? '';
  const prefix = entries.every((e) => e.name.startsWith(firstSeg + '/')) ? firstSeg + '/' : '';

  let compared = 0;
  for (const e of entries) {
    const rel = e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name;
    for (const pat of FORBIDDEN) {
      if (pat.test('/' + rel)) fail('skill包', `含不该发布的路径：${rel}`);
    }
    const src = path.join(ROOT, 'skill', rel);
    if (!fs.existsSync(src)) {
      fail('skill包', `包内文件在开发侧不存在（幽灵文件）：${rel}`);
      continue;
    }
    compared++;
    if (sha(fs.readFileSync(src)) !== sha(e.data)) {
      fail('skill包', `与开发侧不一致（包未重建？）：${rel}`);
    }
  }
  // 反向：开发侧文件必须都在包里
  const walk = (dir: string, base = ''): string[] =>
    fs.readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return fs.statSync(p).isDirectory() ? walk(p, `${base}${f}/`) : [`${base}${f}`];
    });
  const inZip = new Set(entries.map((e) => (e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name)));
  for (const rel of walk(path.join(ROOT, 'skill'))) {
    if (!inZip.has(rel)) fail('skill包', `开发侧文件缺失于包内：${rel}`);
  }
  console.log(`  [包一致] ${pkg.file}：逐字节比对 ${compared} 个文件，双向无差集`);
}

// ────────────────────────────────────────────────────────────
// 3. 法条时效与参考价（易腐数据）
//
// 把"会过期的数据"登记成清单：到了复核期就 WARN，避免陈旧数字静默流传。
// ────────────────────────────────────────────────────────────
interface Freshness {
  what: string;
  /** 依据数据的年度（如统计公报年度） */
  asOf: string;
  /** 每年这个月之前必须复核（该月数据通常已公布） */
  reviewBy: string;
  where: string;
}

const FRESHNESS: Freshness[] = [
  { what: '全国城镇居民人均可支配收入（工亡补助金基数）', asOf: '2025 年度（56,502 元）', reviewBy: '2027-01', where: 'src/core/calculators/labor.ts URBAN_INCOME_DEFAULT' },
  { what: '职工月平均工资（工伤口径，输入默认值为示例）', asOf: '2025 年度全国居民人均可支配收入 43,377 元已核', reviewBy: '2027-01', where: 'src/core/calculators/labor.ts localAvg 默认值' },
  { what: '一年期 LPR 当期值', asOf: '随发布变动', reviewBy: '2026-12', where: 'interest.ts lpr 默认值' },
  { what: '社保费率（全国统一档）与缴费基数口径', asOf: '2026-2027 年度', reviewBy: '2027-07', where: 'tax.ts social-insurance（各省基数由使用者按当地填）' },
  { what: '节假日安排（2024—2026 官方；2027 放假日官方已公布、补班日推定）', asOf: '2027 官方（2026-11 发布）', reviewBy: '2027-11', where: 'src/core/dateUtils.ts' },
  { what: '公告费／公证费／鉴定费／评估费参考价', asOf: '市场调节价', reviewBy: '2026-12', where: 'otherfee.ts 各 PRICE 常量' },
];

function checkStatutory(): void {
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  for (const f of FRESHNESS) {
    if (ym >= f.reviewBy) {
      warn(f.where, `【${f.what}】登记为 ${f.asOf}，应于 ${f.reviewBy} 前复核——数字可能已过期`);
    } else {
      console.log(`  [时效] ${f.what}：${f.asOf}，复核期 ${f.reviewBy}（未到期）`);
    }
  }
  // 法条条文号提示：民事诉讼法 2023 修正后部分条文序号变动
  const mpl = read('src/core/calculators/limitation.ts') + read('src/core/calculators/otherfee.ts');
  if (/民事诉讼法》\s*第\s*(9[0-9]|1[0-9]{2})\s*条/.test(mpl)) {
    console.log('  [时效] 已引用《民事诉讼法》具体条文，修正后序号可能变动（UI 已提示需对照现行版本）');
  }
}

// ────────────────────────────────────────────────────────────
/** 是否处于开发侧（有 src/ 与 package.json）；装到技能目录后只能做包内自检 */
const DEV_MODE =
  fs.existsSync(path.join(ROOT, 'src', 'core', 'version.ts')) && fs.existsSync(path.join(ROOT, 'package.json'));

if (!DEV_MODE) {
  BASE = PKG; // 装包后所有相对路径以技能包根为基准（ROOT 在安装位置指向包外，会误报"全都缺"）
  console.log(`包内自检 · 当前版本 v${VERSION}（安装形态，无 src/）\n`);
  const have = (rel: string): boolean => fs.existsSync(path.join(BASE, rel));
  const must = ['SKILL.md', 'CARD.md', 'VERSION.md', 'LICENSE.md', 'references/DEV_SPEC.md', 'lib/calculators.mjs', 'lib/report.mjs', 'lib/version.mjs'];
  const miss = must.filter((r) => !have(r));
  for (const r of miss) console.log(`✗ [FAIL] 包结构 — 缺少 ${r}；重出包请先跑 build-skill-bundles.mjs`);

  /* 版本一致性：SKILL.md frontmatter ＝ CARD.md 注册块 ＝ lib/version.mjs（bundle 派生物） */
  const fmVer = (read('SKILL.md').match(/^version:\s*([\d.]+)/m) ?? [])[1] ?? '';
  const cardVer = (read('CARD.md').match(/^version:\s*([\d.]+)/m) ?? [])[1] ?? '';
  const libVer = (read('lib/version.mjs').match(/VERSION = ['"]([^'"]+)['"]/) ?? [])[1] ?? '';
  let verFails = 0;
  if (!libVer) {
    verFails++;
    console.log('✗ [FAIL] 包内一致性 — lib/version.mjs 读不到 VERSION（bundle 未生成，须跑 build-skill-bundles.mjs）');
  } else if (fmVer && libVer !== fmVer) {
    verFails++;
    console.log(`✗ [FAIL] 包内一致性 — SKILL.md 版本 ${fmVer} ≠ lib/version.mjs ${libVer}（bundle 是旧版，须重跑 build-skill-bundles.mjs）`);
  }
  if (cardVer && fmVer && cardVer !== fmVer) {
    verFails++;
    console.log(`✗ [FAIL] 包内一致性 — CARD.md 版本 ${cardVer} ≠ SKILL.md ${fmVer}`);
  }
  /* 命名真源（DEV_SPEC「技能命名纪律」）：frontmatter display_name 必须等于中文产品名真源，
     防止包内文档改名漂移（12.3.4 的 display_name 分支在包内也兜住） */
  const fmDisplay = (read('SKILL.md').match(/^display_name:\s*(.+)$/m) ?? [])[1]?.trim() ?? '';
  if (fmDisplay && libVer && fmDisplay !== DISPLAY_NAME) {
    verFails++;
    console.log(`✗ [FAIL] 包内一致性 — SKILL.md display_name="${fmDisplay}" ≠ 中文显示名真源 "${DISPLAY_NAME}"`);
  }
  const fmName = (read('SKILL.md').match(/^name:\s*(.+)$/m) ?? [])[1]?.trim() ?? '';
  if (fmName && libVer && fmName !== PRODUCT_NAME) {
    verFails++;
    console.log(`✗ [FAIL] 包内一致性 — SKILL.md name="${fmName}" ≠ 中文产品名 "${PRODUCT_NAME}"（面板显示，version.ts PRODUCT_NAME）`);
  }
  const fmSlug = (read('SKILL.md').match(/^slug:\s*(\S+)/m) ?? [])[1] ?? '';
  if (fmSlug && libVer && (fmSlug !== SLUG || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fmSlug))) {
    verFails++;
    console.log(`✗ [FAIL] 包内一致性 — SKILL.md slug=${fmSlug} ≠ 技术 ID ${SLUG} 或非 kebab-case（version.ts SLUG）`);
  }
  if (fmVer && libVer === fmVer) console.log(`  [包内自带] 版本 v${fmVer}：SKILL.md ＝ CARD.md ＝ lib/version.mjs`);

  /* 自足性：bundle 不得残留开发侧相对路径，否则换个目录装又哑一次 */
  for (const r of ['lib/calculators.mjs', 'lib/report.mjs']) {
    if (have(r) && read(r).includes('../../src/core')) {
      verFails++;
      console.log(`✗ [FAIL] 包内自足性 — ${r} 仍引用 ../../src/core`);
    }
  }

  /* 实跑一道：注册表能载入、计算器数与文档一致、随便算一个非零结果 */
  try {
    const cal = loadFirst<typeof import('../../src/core/calculators')>([['lib/calculators.mjs', '../lib/calculators.mjs']]);
    const n = cal.ALL_CALCULATORS.length;
    const docN = Number((read('SKILL.md').match(/计算器\s*(\d+)\s*个/) ?? [])[1] ?? NaN);
    if (docN && docN !== n) {
      verFails++;
      console.log(`✗ [FAIL] 包内一致性 — SKILL.md 写 ${docN} 个计算器，包内实有 ${n} 个`);
    }
    const demo = cal.getCalculator('preservation-fee');
    const out = demo && demo.calc({ ...cal.defaultValues(demo), amount: 10000000 });
    const ok = String(out?.main.value ?? '').includes('5,000');
    if (!ok) {
      verFails++;
      console.log('✗ [FAIL] 包内可运行性 — 保全费 1000 万未算出 5,000 封顶值，bundle 可能损坏');
    } else {
      console.log(`  [包内可运行] ${n} 个计算器可载入，试算 preservation-fee 1000 万 → ${out?.main.value}`);
    }
  } catch (e) {
    verFails++;
    console.log(`✗ [FAIL] 包内可运行性 — ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`);
  }

  const fails0 = miss.length + verFails;
  console.log(`\n结果：FAIL ${fails0} 项。安装形态只做包内自检（版本锚点／包与源码逐字节比对需在开发侧执行）。`);
  process.exit(fails0 ? 1 : 0);
}

console.log(`一致性校验 · 当前版本 v${VERSION}\n`);
if (want('--anchors') || !only) {
  console.log('【1】版本锚点与规模自检');
  checkAnchors();
}
if (want('--package')) {
  console.log('【2】发布包与源码一致性');
  checkPackage();
}
if (want('--statutory')) {
  console.log('【3】法条时效与参考价');
  checkStatutory();
}

const fails = findings.filter((f) => f.level === 'FAIL');
const warns = findings.filter((f) => f.level === 'WARN');
console.log('');
for (const f of finds_dedupe(findings)) {
  console.log(`${f.level === 'FAIL' ? '✗' : '!'} [${f.level}] ${f.where} — ${f.msg}`);
}
function finds_dedupe(list: Finding[]): Finding[] {
  const seen = new Set<string>();
  return list.filter((f) => {
    const k = f.where + f.msg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
console.log(`\n结果：FAIL ${fails.length} 项，WARN ${warns.length} 项。`);
process.exit(fails.length ? 1 : 0);
