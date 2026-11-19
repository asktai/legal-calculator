/**
 * 版本身份证 · 更新检测 · 本地升级（scripts/version.ts）
 * =====================================================
 * 用途：解决"装完之后不知道自己装的是哪一版、有没有新版、新版怎么装上去"。
 *       三件事：**看清当前版本**（身份证）→ **比对更新源**（有没有新版）→ **本地升级**（带备份）。
 *
 * 用法：
 *   npx tsx scripts/version.ts                       打印当前版本身份证
 *   npx tsx scripts/version.ts --check <源>          与更新源比对（源＝解开的目录 或 未解开的 .skill / .zip）
 *   npx tsx scripts/version.ts --check               省略源时，用 --watch 登记过的那个
 *   npx tsx scripts/version.ts --changelog <源>      摘出「从当前版本到源版本」之间的沿革条目
 *   npx tsx scripts/version.ts --upgrade <源> --target <安装目录>
 *                                                    升级预演（默认 dry-run，列出覆盖/新增/保留）
 *   npx tsx scripts/version.ts --upgrade <源> --target <安装目录> --apply
 *                                                    真正升级（先整目录备份，再覆盖）
 *
 * 更新源登记与更新提示（对应"技能版本 / 技能更新 / 技能升级"三个入口）：
 *   --watch <源>        登记一个更新源（本机记录路径，以后不必每次手打）
 *   --source            看当前登记的是哪个源、上次查到哪一版
 *   --unwatch           取消登记
 *   --notice            静默检查有没有新版（**无新版完全不输出**，退出码 0；有新版才输出，退出码 1）
 *   --dismiss <版本>    忽略某个版本的提醒（使用者明确说"先不升"时用）
 *   --undismiss         恢复提醒
 *
 * > **升级永远是使用者说了算。** `--notice` 只提示，不改任何文件；`--upgrade` 不带 `--apply` 就是
 * > 预演（dry-run），只列出会覆盖/新增/保留什么，一个字节都不动。发现新版就自动替使用者升级，
 * > 是明确排除的行为——版本换季可能改变计算口径与产出形态，必须由人判断何时切。
 *
 * **零联网**：本脚本只读本地文件与本地 zip，**不访问任何网络**。
 * 更新源由使用者自己给（U 盘、内网共享、发布目录），因此"检测更新"不需要、也不会联网。
 * 判定依据＝两侧 `SKILL.md` frontmatter 的 `version` 字段。
 *
 * 保护规则（升级时）：
 * - `examples/` **永不覆盖**（示例报告与使用者测算数据属本机私有数据）；
 * - 目标里有、源里没有的文件**一律保留**并列出，不删除。
 * 备份：升级前整目录备份到 `<安装目录>_bak-V<旧版本>-<时间戳>`，与安装目录同级。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as zlib from 'node:zlib';
import { createRequire } from 'node:module';

const HERE = path.dirname(path.resolve(process.argv[1]));
const ROOT = path.dirname(HERE);
const SKILL_PATH = path.join(ROOT, 'SKILL.md');

/** 永不覆盖的目录（本机私有数据） */
const NEVER_OVERWRITE = ['examples'];
/** 需显式 --overwrite-config 才覆盖的本机配置 */
const KEEP_CONFIG = 'scripts/config.json';
/** 复制时排除 */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '__pycache__', '.codebuddy']);

/** 更新源登记：与备份同思路，不落在技能目录内，免得整目录外发时把使用者的更新来源一并带出去 */
const UPDATE_DIR = process.env.LC_UPDATE_DIR || path.join(os.homedir(), '.legal-calculator-updates');
const SOURCE_FILE = path.join(UPDATE_DIR, 'source.json');

const P = '[version]';

/* ───────────────────────── 基础工具 ───────────────────────── */

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}

/** 解析 YAML frontmatter 的键值子集（只要标量） */
function frontmatter(text: string): Record<string, string> {
  if (!text.startsWith('---')) return {};
  const end = text.indexOf('\n---', 3);
  if (end < 0) return {};
  const out: Record<string, string> = {};
  for (const line of text.slice(3, end).split('\n')) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

/** 版本串 → 可比较数组。认不出返回 [0,0,0] */
function vkey(s: string): number[] {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(s || '');
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

function vcmp(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function vstr(t: number[]): string {
  return t.join('.');
}

function stamp(): string {
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`;
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19);
}

/* ───────────────────────── 极简 zip 读取（零依赖） ───────────────────────── */

interface ZipEntry {
  name: string;
  data: Buffer;
}

export function zipEntries(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  const min = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    let data = Buffer.alloc(0);
    try {
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.slice(start, start + compSize);
      data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : Buffer.alloc(0);
    } catch {
      data = Buffer.alloc(0);
    }
    out.push({ name, data });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

function zipPick(entries: ZipEntry[], tail: string): ZipEntry | undefined {
  const hit = entries.filter((e) => {
    const n = e.name.replace(/\\/g, '/');
    return n.endsWith('/' + tail) || n === tail;
  });
  if (!hit.length) return undefined;
  return hit.sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];
}

/* ───────────────────────── 更新源读取 ───────────────────────── */

/** 从更新源读取某文件内容。src＝目录 或 zip。返回 [形态, 文本|null] */
function sourceText(src: string, tail: string): [string, string | null] {
  if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
    const p = path.join(src, tail.split('/').join(path.sep));
    return ['目录', fs.existsSync(p) ? read(p) : null];
  }
  if (fs.existsSync(src) && fs.statSync(src).isFile() && /\.(zip|skill)$/i.test(src)) {
    try {
      const entries = zipEntries(fs.readFileSync(src));
      const e = zipPick(entries, tail);
      return ['zip', e ? e.data.toString('utf8') : null];
    } catch {
      return ['zip', null];
    }
  }
  return ['路径不存在', null];
}

function sourceVersion(src: string): [string, string | null, string] {
  const [kind, txt] = sourceText(src, 'SKILL.md');
  if (txt === null) return [kind, null, ''];
  const fm = frontmatter(txt);
  return [kind, fm.version || '', fm.name || ''];
}

/* ───────────────────────── 当前版本（身份证） ───────────────────────── */

/**
 * 计算器规模：开发侧数 `src/core/calculators/*.ts` 里的 `id: '...'`（按模块文件数＝分类数）；
 * **装成技能包后没有 `src/`**，改为**运行时加载**随包的 `lib/calculators.mjs`，直接取
 * `ALL_CALCULATORS.length` 与 `CATEGORIES.length`（同一份源码打出来的，口径天然一致）。
 *
 * 为什么不在 bundle 文本里数 `id: "..."`：
 *   · 全局数会把 `CATEGORIES` 的 7 个分类 id 一并数进来（52 ≠ 45）；
 *   · 只数 `ALL_CALCULATORS = [ ... ]` 块会得 0——该数组是 `...litigationBase` 这样的**展开**写法，
 *     字面量里一个 `id` 都没有。
 * 这类文本扫描的错误是**静默**的：不报错，只是数字错了，比不显示更误导人。
 * 运行时加载至少和 `check.ts` 用的是同一份模块，错了会直接抛错。
 */
function countCalculators(): { total: number; cats: number } {
  const dir = path.join(ROOT, '..', 'src', 'core', 'calculators');
  if (fs.existsSync(dir)) {
    let total = 0;
    let cats = 0;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.ts') || f === 'index.ts') continue;
      if (f.endsWith('.d.ts')) continue;
      cats++;
      const txt = read(path.join(dir, f));
      total += (txt.match(/^\s*id: '/gm) || []).length;
    }
    return { total, cats };
  }
  /* 包内回落：运行时加载 lib/calculators.mjs */
  for (const spec of ['../lib/calculators.mjs', '../lib/index.mjs']) {
    try {
      const mod = createRequire(import.meta.url)(spec) as {
        ALL_CALCULATORS?: unknown[];
        CATEGORIES?: unknown[];
      };
      const total = Array.isArray(mod.ALL_CALCULATORS) ? mod.ALL_CALCULATORS.length : 0;
      if (!total) continue; // 该 bundle 不是注册表形态，试下一个
      const cats = Array.isArray(mod.CATEGORIES) ? mod.CATEGORIES.length : 0;
      return { total, cats };
    } catch {
      /* 模块不存在则继续试 */
    }
  }
  return { total: 0, cats: 0 };
}

function countScripts(): number {
  return fs.readdirSync(HERE).filter((f) => f.endsWith('.ts') || f.endsWith('.py')).length;
}

function identity() {
  const fm = frontmatter(read(SKILL_PATH));
  const { total, cats } = countCalculators();
  return {
    name: fm.name || '',
    version: fm.version || '',
    license: fm.license || '',
    author: fm.author || '',
    calculators: total,
    modules: cats,
    scripts: countScripts(),
    mtime: fs.existsSync(SKILL_PATH)
      ? new Date(fs.statSync(SKILL_PATH).mtimeMs).toISOString().slice(0, 10)
      : '',
  };
}

function show(): number {
  const i = identity();
  console.log(`${P} 位置：${ROOT}`);
  console.log(`${P} 名称：${i.name}`);
  console.log(`${P} 版本：v${i.version}`);
  if (i.author) console.log(`${P} 作者：${i.author}`);
  console.log(`${P} 许可：${i.license}`);
  console.log(`${P} 规模：计算器 ${i.calculators} 个（${i.modules} 个模块）　脚本 ${i.scripts} 个　卡片图标 / 横幅已就位`);
  console.log(`${P} 入口更新时间：${i.mtime}`);
  console.log(`${P} 核对更新：npx tsx scripts/version.ts --check <更新源目录或 zip>`);
  return 0;
}

/* ───────────────────────── 更新源登记与提示 ───────────────────────── */

interface SrcCfg {
  path?: string;
  registered_at?: string;
  checked_at?: string;
  dismissed?: string[];
}

function loadCfg(): SrcCfg {
  try {
    if (!fs.existsSync(SOURCE_FILE)) return {};
    const d = JSON.parse(read(SOURCE_FILE));
    return d && typeof d === 'object' ? (d as SrcCfg) : {};
  } catch {
    return {};
  }
}

function saveCfg(d: SrcCfg): void {
  fs.mkdirSync(UPDATE_DIR, { recursive: true });
  fs.writeFileSync(SOURCE_FILE, JSON.stringify(d, null, 2), 'utf-8');
}

function watch(src: string): number {
  const abs = path.resolve(src);
  const [, sver] = sourceVersion(abs);
  if (sver === null || !sver) {
    console.log(`${P} 未登记：这里读不到 SKILL.md —— ${abs}`);
    console.log(`${P} 更新源应是：解开的技能目录、或未解开的 .skill / .zip 发布包。`);
    return 2;
  }
  const d = loadCfg();
  d.path = abs;
  d.registered_at = nowIso();
  delete d.checked_at;
  saveCfg(d);
  console.log(`${P} 已登记更新源：${abs}（源版本 v${sver}）`);
  console.log(`${P} 以后直接跑 npx tsx scripts/version.ts --check 即可比对；--notice 只在有新版本时提示一次。`);
  return 0;
}

function unwatch(): number {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.log(`${P} 本来就没有登记更新源。`);
    return 0;
  }
  fs.rmSync(SOURCE_FILE);
  console.log(`${P} 已取消更新源登记，不再提示新版本。`);
  return 0;
}

function showSource(): number {
  const d = loadCfg();
  if (!d.path) {
    console.log(`${P} 尚未登记更新源。登记方法：npx tsx scripts/version.ts --watch <目录或 zip>`);
    return 0;
  }
  const i = identity();
  const exists = fs.existsSync(d.path);
  console.log(`${P} 更新源：${d.path}${exists ? '' : '　（**当前不可访问**）'}`);
  if (exists) {
    const [, sver] = sourceVersion(d.path);
    const cmp = vcmp(vkey(sver || ''), vkey(i.version));
    if (sver && cmp > 0) {
      console.log(`${P} 源版本 v${sver} ＞ 当前 v${i.version}：**有更新可用**（是否升级由使用者决定）`);
    } else if (sver && cmp < 0) {
      console.log(`${P} 源版本 v${sver} ＜ 当前 v${i.version}：这个源比本机旧，装它会回退。`);
    } else if (sver) {
      console.log(`${P} 源版本 v${sver} ＝ 当前 v${i.version}：已是最新。`);
    }
  }
  console.log(`${P} 登记时间：${d.registered_at || '未知'}`);
  if (d.checked_at) console.log(`${P} 上次检查：${d.checked_at}`);
  if (d.dismissed?.length) console.log(`${P} 已忽略的版本：${d.dismissed.join('、')}（--undismiss 可恢复提醒）`);
  return 0;
}

function setDismiss(ver: string | null, undo = false): number {
  const d = loadCfg();
  if (!d.path && !undo) {
    console.log(`${P} 尚未登记更新源，无从忽略。`);
    return 2;
  }
  const arr = d.dismissed ?? [];
  if (undo) {
    d.dismissed = [];
    console.log(`${P} 已恢复所有版本的更新提醒。`);
  } else if (ver) {
    if (!arr.includes(ver)) arr.push(ver);
    d.dismissed = arr;
    console.log(`${P} 已忽略 v${ver} 的更新提醒（本机仍可随时手动检查或升级）。`);
  }
  saveCfg(d);
  return 0;
}

/** 静默检查：无新版、无登记源、源不可访问，一律不输出、退 0；有新版输出并退 1 */
function notice(): number {
  const d = loadCfg();
  const p = d.path || '';
  if (!p || !fs.existsSync(p)) return 0;
  const i = identity();
  const [, sver] = sourceVersion(p);
  if (!sver) return 0;
  if (vcmp(vkey(sver), vkey(i.version)) <= 0) return 0;
  if ((d.dismissed ?? []).includes(sver)) return 0;
  try {
    d.checked_at = nowIso();
    saveCfg(d);
  } catch {
    /* 忽略写入失败 */
  }
  console.log(`${P} 检测到新版本：当前 v${i.version} → 可用 v${sver}（更新源：${p}）`);
  console.log(`${P} 这只是一个提示，**不会自动升级**。要看看改了什么：npx tsx scripts/version.ts --changelog ${p}`);
  console.log(`${P} 要升级（须使用者确认后才可执行）：先用 --upgrade 预演，确认无误再加 --apply 真正安装。`);
  return 1;
}

/* ───────────────────────── 更新检测 ───────────────────────── */

function check(src: string): number {
  const i = identity();
  const [kind, sver] = sourceVersion(src);
  if (sver === null) {
    console.log(`${P} 未在更新源里找到 SKILL.md：${src}（${kind}）`);
    console.log(`${P} 更新源应是：解开的技能目录、或未解开的 .skill / .zip 发布包。`);
    return 2;
  }
  console.log(`${P} 当前：v${i.version}　更新源：v${sver}（${kind}）`);
  const cmp = vcmp(vkey(sver), vkey(i.version));
  if (cmp === 0) {
    console.log(`${P} 已是最新版，无需升级。`);
    return 0;
  }
  if (cmp > 0) {
    console.log(`${P} 有更新：v${i.version} → v${sver}`);
    console.log(`${P} 先看改了什么：npx tsx scripts/version.ts --changelog ${src}`);
    console.log(`${P} 再预演升级：npx tsx scripts/version.ts --upgrade ${src} --target <安装目录>`);
    return 0;
  }
  console.log(`${P} 更新源版本 **低于** 当前版本（v${sver} < v${i.version}）——确认是否拿错了包；继续安装会**回退**功能。`);
  return 3;
}

function changelog(src: string, limit = 40): number {
  const i = identity();
  const [kind, sver] = sourceVersion(src);
  if (sver === null) {
    console.log(`${P} 更新源里没有 SKILL.md：${src}`);
    return 2;
  }
  const [, txt] = sourceText(src, 'VERSION.md');
  if (!txt) {
    console.log(`${P} 更新源里没有 VERSION.md（${kind || src}）——沿革随项目维护，不随发布包。`);
    console.log(`${P} 新旧差异请以两侧 SKILL.md / README.md 为准。`);
    return 0;
  }
  const rows: { v: number[]; raw: string; tail: string }[] = [];
  for (const line of txt.split('\n')) {
    const s = line.trim();
    // 形态一：标题式  `## V1.1.0 2026-09-23 关键变化`
    const m1 = /^(#{2,6})\s*V?(\d+\.\d+\.\d+)\s*(.*)$/.exec(s);
    if (m1) {
      rows.push({ v: vkey(m1[2]), raw: m1[2], tail: m1[3].trim() });
      continue;
    }
    // 形态二：表格式  `| **V1.1.0** | 2026-09-23 | 关键变化 |`
    const m2 = /^\|\s*\*{0,2}V?(\d+\.\d+\.\d+)\*{0,2}\s*\|([^|]*)\|(.*)$/.exec(s);
    if (m2) {
      rows.push({ v: vkey(m2[1]), raw: m2[1], tail: `${m2[2].trim()}　${m2[3].replace(/\|?\s*$/, '').trim()}` });
    }
  }
  const cur = vkey(i.version);
  const tgt = vkey(sver);
  const lo = vcmp(tgt, cur) >= 0 ? cur : tgt;
  const hi = vcmp(tgt, cur) >= 0 ? tgt : cur;
  const hit = rows.filter((r) => vcmp(r.v, lo) > 0 && vcmp(r.v, hi) <= 0);
  if (!hit.length && vcmp(tgt, cur) === 0) {
    console.log(`${P} 当前 v${i.version} 与源版本相同，无区间沿革。`);
    return 0;
  }
  console.log(`${P} 区间沿革 V${vstr(lo)} → V${vstr(hi)}（${hit.length} 个版本条目）：`);
  if (!hit.length) console.log('    （VERSION.md 中未找到该区间的版本标题）');
  for (const r of hit.slice(0, limit)) {
    console.log(`    V${r.raw.padEnd(8)} ${r.tail.slice(0, 96)}`);
  }
  return 0;
}

/* ───────────────────────── 升级 ───────────────────────── */

function walkFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile()) {
        if (e.name === '.DS_Store' || e.name.endsWith('.pyc')) continue;
        out.push(path.relative(root, path.join(dir, e.name)).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return out.sort();
}

/** 把更新源整理成一个目录；zip 则解到临时目录。返回 [目录|null, 是否临时] */
function prepareSrc(src: string): [string | null, boolean] {
  if (fs.existsSync(src) && fs.statSync(src).isDirectory()) return [src, false];
  if (fs.existsSync(src) && fs.statSync(src).isFile() && /\.(zip|skill)$/i.test(src)) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lc-up-'));
    const all = zipEntries(fs.readFileSync(src)).filter((e) => !e.name.replace(/\\/g, '/').endsWith('/'));
    // zip 可能带一层顶层目录：若所有条目都在同一个顶层目录下，则下沉一层
    const tops = new Set(all.map((e) => e.name.replace(/\\/g, '/').split('/')[0]));
    const sink = tops.size === 1 && !all.some((e) => !e.name.replace(/\\/g, '/').includes('/'));
    for (const e of all) {
      const rel = sink ? e.name.replace(/\\/g, '/').split('/').slice(1).join('/') : e.name.replace(/\\/g, '/');
      if (!rel) continue;
      const target = path.join(tmp, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, e.data);
    }
    return [tmp, true];
  }
  return [null, false];
}

function protectedReason(rel: string, overwriteCfg: boolean): string {
  const head = rel.split('/')[0];
  if (NEVER_OVERWRITE.includes(head)) return `${head}/（本机数据，永不覆盖）`;
  if (rel === KEEP_CONFIG && !overwriteCfg) return 'config.json（本机配置，需 --overwrite-config 才覆盖）';
  return '';
}

function upgrade(srcDir: string, target: string, apply: boolean, overwriteCfg: boolean): number {
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    console.log(`${P} 安装目录不存在：${target}`);
    return 2;
  }
  const [src, tmp] = prepareSrc(srcDir);
  if (!src) {
    console.log(`${P} 更新源不可用：${srcDir}（应为目录或 .skill / .zip）`);
    return 2;
  }

  const sFiles = walkFiles(src);
  const tSet = new Set(walkFiles(target));
  const over = sFiles.filter((f) => tSet.has(f));
  const add = sFiles.filter((f) => !tSet.has(f));
  const keep = [...tSet].filter((f) => !sFiles.includes(f)).sort();
  const prot = [...over, ...add]
    .map((f) => [f, protectedReason(f, overwriteCfg)] as const)
    .filter(([, why]) => why);

  const curVer = identity().version;
  console.log(`${P} 源：${srcDir}`);
  console.log(`${P} 目标：${target}`);
  console.log(`${P} 变更：覆盖 ${over.length}　新增 ${add.length}　目标独有（保留）${keep.length}`);
  if (prot.length) {
    console.log(`${P} 受保护（不覆盖）：`);
    for (const [f, why] of prot.slice(0, 12)) console.log(`    ${f.padEnd(46)} ${why}`);
  }
  for (const f of add.slice(0, 12)) console.log(`    [新增] ${f}`);
  for (const f of keep.slice(0, 12)) console.log(`    [保留] ${f}`);
  if (keep.length > 12) console.log(`    …… 其余保留项 ${keep.length - 12} 个（目标独有，不会删除）`);

  if (!apply) {
    console.log(`${P} 以上是预演（dry-run），未改动任何文件。`);
    console.log(`${P} 确认无误后加 --apply 执行；备份会写在安装目录同级。`);
    if (tmp) fs.rmSync(src, { recursive: true, force: true });
    return 0;
  }

  const bak = `${target.replace(/[\\/]$/, '')}_bak-V${curVer.replace(/\./g, '')}-${stamp()}`;
  console.log(`${P} 备份中：${bak}`);
  let n = 0;
  for (const rel of [...tSet]) {
    const dst = path.join(bak, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(target, rel), dst);
    n++;
  }
  console.log(`${P} 已备份 ${n} 个文件。`);

  let done = 0;
  let skipped = 0;
  for (const rel of [...over, ...add]) {
    if (protectedReason(rel, overwriteCfg)) {
      skipped++;
      continue;
    }
    const tp = path.join(target, rel.split('/').join(path.sep));
    fs.mkdirSync(path.dirname(tp), { recursive: true });
    fs.copyFileSync(path.join(src, rel.split('/').join(path.sep)), tp);
    done++;
  }
  console.log(`${P} 已写入 ${done} 个文件（受保护跳过 ${skipped} 个）。`);
  if (tmp) fs.rmSync(src, { recursive: true, force: true });
  console.log(`${P} 升级完成。接下来跑：npx tsc --noEmit && npx tsx scripts/smoke.ts`);
  return 0;
}

/* ───────────────────────── 入口 ───────────────────────── */

function help(): void {
  console.log(`${P} 用法：
  npx tsx scripts/version.ts                     版本身份证
  npx tsx scripts/version.ts --check <源>        比对更新源（目录或 zip；省略源用已登记的）
  npx tsx scripts/version.ts --changelog <源>    摘出区间沿革
  npx tsx scripts/version.ts --upgrade <源> --target <目录> [--apply]   升级（默认预演）
  npx tsx scripts/version.ts --watch <源>       登记更新源   --unwatch 取消
  npx tsx scripts/version.ts --source           查看登记   --notice 静默检查
  npx tsx scripts/version.ts --dismiss <版本>   忽略提醒   --undismiss 恢复
`);
}

function main(): number {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    if (i < 0) return null;
    const v = argv[i + 1];
    return v && !v.startsWith('--') ? v : '__registered__';
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const resolve = (v: string | null): string | null => {
    if (v === null) return null;
    if (v !== '__registered__') return v;
    const d = loadCfg();
    if (!d.path) {
      console.log(`${P} 尚未登记更新源。先登记：npx tsx scripts/version.ts --watch <目录或 zip>`);
      return null;
    }
    if (!fs.existsSync(d.path)) {
      console.log(`${P} 已登记的更新源当前不可访问：${d.path}`);
      console.log(`${P} 换一个：--watch <新源>；或取消登记：--unwatch`);
      return null;
    }
    return d.path;
  };

  if (has('--help') || has('-h')) {
    help();
    return 0;
  }
  if (has('--unwatch')) return unwatch();
  if (has('--source')) return showSource();
  if (has('--notice')) return notice();
  if (has('--undismiss')) return setDismiss(null, true);

  const w = get('--watch');
  if (w && w !== '__registered__') return watch(w);
  const dis = get('--dismiss');
  if (dis && dis !== '__registered__') return setDismiss(dis);

  const c = get('--check');
  if (c) {
    const src = resolve(c);
    return src ? check(src) : 2;
  }
  const cl = get('--changelog');
  if (cl) {
    const src = resolve(cl);
    return src ? changelog(src) : 2;
  }
  const up = get('--upgrade');
  if (up && up !== '__registered__') {
    const t = get('--target');
    if (!t || t === '__registered__') {
      console.log(`${P} --upgrade 需要同时给 --target <安装目录>。`);
      return 2;
    }
    return upgrade(up, t, has('--apply'), has('--overwrite-config'));
  }
  return show();
}

// 仅当作为入口直接执行时才运行主流程；被 check.ts 等模块 import 时静默（只导出工具函数）。
// 判定依据：argv[1] 是否为本文件。（tsx / node 下跨平台通用）
const IS_ENTRY = (() => {
  const a = process.argv[1] ?? '';
  return a.length > 0 && path.resolve(a).replace(/\.(ts|js)$/, '') === import.meta.filename.replace(/\.(ts|js)$/, '');
})();
if (IS_ENTRY) process.exit(main());

export { main };
