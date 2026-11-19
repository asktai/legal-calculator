/**
 * 技能包脚本自足化打包（scripts/build-skill-bundles.mjs）
 * ========================================================
 * 解决的问题：`scripts/*.ts` 里的 `import '../../src/core/...'` 只在**开发侧**成立。
 * 技能包只发 `skill/`，不含 `src/`，所以包内直接跑 `tsx scripts/cli.ts` 必报
 * `Cannot find module '../../src/core/calculators'`——使用者装完包，CLI 与回归审计全哑。
 *
 * 做法：把需要真跑的核心逻辑（计算器注册表、报告导出、版本常量）**内联**成
 * 自足 bundle，随包发布；开发侧原样保留源码（源码是唯一真源，bundle 是派生物）。
 *
 * 版本常量的处理：`src/core/version.ts` 在打包时被替换成从 `skill/SKILL.md`
 * frontmatter + `skill/VERSION.md` 读出的桩，保证**包内版本号与本包一致**，
 * 不会出现"包是 v1.4.2、包内常量还是旧版"的漂移。
 *
 * 用法（开发侧执行，出包前跑）：
 *   node skill/scripts/build-skill-bundles.mjs
 * 产物（随包分发）：
 *   skill/lib/calculators.mjs   计算器注册表（CLI / 回归审计 / 冒烟共用）
 *   skill/lib/report.mjs        报告模型与多格式导出
 *   skill/lib/version.mjs       版本常量（自 SKILL.md 生成）
 * 退出码：0 成功；非 0 失败（出包链应据此中止）。
 */
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import * as path from 'node:path';

const HERE = import.meta.dirname;
const SKILL = path.resolve(HERE, '..');
const DEV_ROOT = path.resolve(SKILL, '..');
const CORE = path.join(DEV_ROOT, 'src', 'core');
const OUT = path.join(SKILL, 'lib');

/* ── 解析 esbuild（vite 的传递依赖，pnpm 布局下不能直接 import 'esbuild'） ── */
async function loadEsbuild() {
  const require = createRequire(path.join(DEV_ROOT, 'package.json'));
  try {
    return require('esbuild');
  } catch {
    /* 落到下面的 pnpm 查找 */
  }
  const pnpm = path.join(DEV_ROOT, 'node_modules', '.pnpm');
  if (fs.existsSync(pnpm)) {
    const hits = fs
      .readdirSync(pnpm)
      .filter((d) => d.startsWith('esbuild@'))
      .sort()
      .reverse();
    for (const h of hits) {
      const p = path.join(pnpm, h, 'node_modules', 'esbuild', 'lib', 'main.js');
      if (fs.existsSync(p)) return (await import(p)).default ?? (await import(p));
    }
  }
  throw new Error('找不到 esbuild：请先在开发侧执行 pnpm install');
}

/* ── 从技能包自身读出身份（包内版本号的真源是 SKILL.md，与 check.ts 同口径） ── */
function readIdentity() {
  const md = fs.readFileSync(path.join(SKILL, 'SKILL.md'), 'utf-8');
  const fmEnd = md.startsWith('---') ? md.indexOf('\n---', 3) : -1;
  const fm = fmEnd > 0 ? md.slice(3, fmEnd) : '';
  const pick = (k) => {
    const m = new RegExp(`^${k}:\\s*(.+)$`, 'm').exec(fm);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  const version = pick('version');
  if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`SKILL.md frontmatter 读不到 version（读到「${version}」）`);
  const displayName = pick('display_name') || pick('name');
  const name = pick('name') || displayName.split('·')[0].trim();
  /* name 支持中文（推荐），ASCII 名称也允许——但那样面板会显示英文，属使用者选择，不予阻断。
     真正必须拦的是"没名字"与"name 抄成 slug"（后者在下面与 slug 比对处拦）。 */
  if (!name) throw new Error('SKILL.md frontmatter 读不到 name：WorkBuddy 面板靠它显示技能名称');
  const slug = pick('slug');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new Error(`frontmatter slug 不合法：「${slug}」。官方规范要求 kebab-case（小写字母数字、连字符分隔，不得下划线／首尾连字符／连续连字符）`);
  /* name 与 slug 雷同＝等于没分流：面板与平台索引读同一个串，中文名等于没做。
     这条挡住"把 name 抄成 slug 交差"（DEV_SPEC 三·五「不得互换混用」） */
  if (name.toLowerCase() === slug.toLowerCase())
    throw new Error(`frontmatter name 与 slug 不能相同（均为「${name}」）：name 供 WorkBuddy 面板显示，slug 供平台索引与目录命名，两者须分开`);
  const author = pick('author');
  const license = pick('license');
  const updated = pick('updated');
  return { version, name, displayName, slug, author, license, updated };
}

/** 生成 version 桩：字段与 src/core/version.ts 一一对应，缺一个都会让使用者看到 undefined */
function versionStub(id, productName) {
  return `// 自动生成（build-skill-bundles.mjs）——勿手改；改版本请改 SKILL.md 并重出包
export const VERSION = ${JSON.stringify(id.version)};
export const RELEASE_DATE = ${JSON.stringify(id.updated)};
export const RELEASE_CHANNEL = 'Stable';
export const MIN_RUNTIME = '1.0.0';
export const LICENSE = ${JSON.stringify(id.license)};
export const LICENSE_SUMMARY = '专有作品、非开源；个人自用授权，商业使用须事先取得作者书面授权';
export const AUTHOR = ${JSON.stringify(id.author)};
export const PRODUCT_NAME = ${JSON.stringify(productName)};
export const SLUG = ${JSON.stringify(id.slug)};
export const DISPLAY_NAME = ${JSON.stringify(id.displayName)};
export const CARD_TAGLINE = '';
export const VERSION_LINE = \`\${PRODUCT_NAME} V\${VERSION}（\${RELEASE_DATE}，\${RELEASE_CHANNEL}）· \${LICENSE}\`;
`;
}

/* ── 把 ../../src/core/version 重定向到桩；其余 ../../src/core/* 一律指向开发侧真源 ── */
function coreResolver(stubPath) {
  return {
    name: 'core-resolver',
    setup(build) {
      build.onResolve({ filter: /^\.\.\/\.\.\/src\/core\// }, (args) => {
        const name = args.path.replace(/^\.\.\/\.\.\/src\/core\//, '');
        if (name === 'version') return { path: stubPath };
        const file = path.join(CORE, `${name}.ts`);
        if (!fs.existsSync(file)) throw new Error(`技术性模块不存在：src/core/${name}.ts（${args.importer} 引用）`);
        return { path: file };
      });
    },
  };
}

async function bundle(esbuild, entry, outfile, stubPath) {
  await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    legalComments: 'none',
    banner: { js: `// 由 skill/scripts/build-skill-bundles.mjs 自开发侧生成，随技能包分发；请勿手改。` },
    plugins: [coreResolver(stubPath)],
  });
}

async function main() {
  if (!fs.existsSync(path.join(CORE, 'calculators', 'index.ts'))) {
    throw new Error(`开发侧核心源码不存在：${CORE}。本脚本只能在开发仓库内执行。`);
  }
  const esbuild = await loadEsbuild();
  const id = readIdentity();
  const productName = id.name;

  fs.mkdirSync(OUT, { recursive: true });
  const stubPath = path.join(OUT, 'version.mjs');
  fs.writeFileSync(stubPath, versionStub(id, productName), 'utf-8');
  console.log(`  version.mjs    v${id.version}（自 SKILL.md 生成）`);

  /* calculators：注册表 + 默认值 + 检索。audit/smoke/cli 三处共用同一份，
     避免"审计过的实现"与"CLI 实际跑的实现"是两份代码 */
  const calcEntry = path.join(OUT, '.calculators.entry.ts');
  fs.writeFileSync(calcEntry, `export * from ${JSON.stringify(path.join(CORE, 'calculators', 'index.ts'))};\n`, 'utf-8');
  await bundle(esbuild, calcEntry, path.join(OUT, 'calculators.mjs'), stubPath);
  fs.rmSync(calcEntry);

  /* report：报告模型与多格式导出（报告类 CLI 与网页端共用一套排版） */
  const repEntry = path.join(OUT, '.report.entry.ts');
  fs.writeFileSync(repEntry, `export * from ${JSON.stringify(path.join(CORE, 'report.ts'))};\n`, 'utf-8');
  await bundle(esbuild, repEntry, path.join(OUT, 'report.mjs'), stubPath);
  fs.rmSync(repEntry);

  /* 产物自检：不得残留开发侧相对路径，否则装到别处又哑一次 */
  for (const f of ['calculators.mjs', 'report.mjs']) {
    const t = fs.readFileSync(path.join(OUT, f), 'utf-8');
    if (t.includes('../../src/core')) throw new Error(`${f} 仍残留 ../../src/core 引用，打包未自足`);
    const kb = (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1);
    console.log(`  ${f.padEnd(14)} ${kb} KB`);
  }
  console.log(`  → ${OUT}`);
}

main().catch((e) => {
  console.error(`✗ 打包失败：${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
