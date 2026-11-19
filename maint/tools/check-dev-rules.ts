/**
 * 规范结构自检（对应 DEV-RULES 第 2 条 ＋ 16.2 的守卫自验）
 * 用法：npx tsx maint/tools/check-dev-rules.ts [--file=path]
 *
 * ── 维度编号对照表 ─────────────────────────────────────────
 * 本脚本的维度编号 = **规范自身引用的维度编号**（DEV-RULES 正文各处写「自检第 (11) 项」
 * 之类，指的是下表的号）。**编号即契约**：脚本内不得另编一套，否则条文说"见 (11)"
 * 而脚本里 (11) 是别的东西——读者照着条文找守卫，找到的是另一项，等于没有守卫。
 *
 * 号  含义（条文出处）                                    脚本 tag
 * ─  ──────────────────────────────────────────────────  ──────────────
 *  1  条号连续（第 2 条 2.1）                              条号
 *  2  章区间覆盖（第 2 条 2.1）                            章区间
 *  3  目录锚点（第 2 条 2.6）                              目录
 *  3b 跨文件条号引用（12.5.1.1.1）                         跨文件引用
 *  4  各级连号、不跳不重（第 2 条 2.1）                    编号连号
 *  5  可键入字符 ／ 日期补零（第 2 条 2.4、22 第 3/8 行）  禁用字符
 *  6  扩展名小写（20.4）                                  扩展名
 *  7  铁律版本串：开发侧 3 份文档之间（19.3）              版本串
 *  8  跨侧哈希：开发侧 → 随包副本（11.3、12.5.2）          跨侧哈希
 *  9  条号引用真实性：本文件内部（12.5.1）                 引用
 * 10  绝对编号引用、表格行带父级（22 第 2 行）             软指代
 * 11  行首加粗须带编号（2.2）                              加粗编号
 * 12  元规则归属：条以下编号规则只许出自第 2 条（2.5）      元规则
 * 13  24.3 表登记六病征（24.3.1、24.3.4）                  24.3 表 ／ 落点词表
 * 14  底线断言（12.5.4.2 假过）                            底线
 *
 * 本次只落地 (1)—(5)、(9)(11)(13)(14) ＋ 新增 (3b)；**(6)(7)(8)(10)(12) 为待补缺口**，
 * 已登记入 24.3 表与开发日志的防治缺口表，**不得据"脚本跑绿"认为这些维已闭合**。
 */
import fs from 'node:fs';
import path from 'node:path';

const argFile = process.argv.find((a) => a.startsWith('--file='));
const FILE = argFile
  ? path.resolve(process.cwd(), argFile.slice('--file='.length))
  : path.resolve(process.cwd(), 'dev/DEV-RULES.md');

if (!fs.existsSync(FILE)) {
  console.error(`✗ 找不到规范文件：${FILE}`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

let fail = 0;
const err = (tag: string, msg: string) => {
  fail++;
  console.log(`FAIL [${tag}] ${msg}`);
};
const ok = (tag: string, msg: string) => console.log(`  ok [${tag}] ${msg}`);

// ── 解析条标题 ────────────────────────────────────────────
type Art = { no: number; title: string; line: number };
const articles: Art[] = [];
const chapterLines: { range: [number, number] | null; title: string; line: number }[] = [];

lines.forEach((l, i) => {
  const m = l.match(/^### 第 (\d+) 条\s+「?(.+?)」?$/);
  if (m) articles.push({ no: Number(m[1]), title: m[2].trim(), line: i + 1 });
  const c = l.match(/^## 第[一二三四五六七八九十]+章\s+(.+)$/);
  if (c) {
    // 两种合法写法：区间 `第 A—B 条`；单条章 `第 A 条`（如「预防漂移（第 12 条）」）
    const r = c[1].match(/第 (\d+)—(\d+) 条/) ?? null;
    const one = r ? null : c[1].match(/第 (\d+) 条/);
    chapterLines.push({
      range: r ? [Number(r[1]), Number(r[2])] : one ? [Number(one[1]), Number(one[1])] : null,
      title: c[1].trim(),
      line: i + 1,
    });
  }
});

const maxArt = articles.length ? Math.max(...articles.map((a) => a.no)) : 0;

// ── (10) 底线断言：先证明真解析到了 ──────────────────────
const EXPECTED_MIN = 24;
if (articles.length < EXPECTED_MIN) {
  err('(14) 底线', `只解析到 ${articles.length} 条，少于预期 ${EXPECTED_MIN} 条 —— 判失败，不判通过`);
  console.log(`\n✗ 共 ${fail} 项失败`);
  process.exit(1);
}
ok('(14) 底线', `解析到 ${articles.length} 条（预期 ≥ ${EXPECTED_MIN}）`);

// ── (1) 条号连续 ─────────────────────────────────────────
{
  const nos = articles.map((a) => a.no);
  const dup = nos.filter((n, i) => nos.indexOf(n) !== i);
  if (dup.length) err('(1) 条号', `重复：${[...new Set(dup)].join(', ')}`);
  const missing: number[] = [];
  for (let n = 1; n <= maxArt; n++) if (!nos.includes(n)) missing.push(n);
  if (missing.length) err('(1) 条号', `缺号：${missing.join(', ')}`);
  const unsorted = nos.some((n, i) => i > 0 && n < nos[i - 1]);
  if (unsorted) err('(1) 条号', '条序非递增');
  if (!dup.length && !missing.length && !unsorted) ok('(1) 条号', `第 1—${maxArt} 条连续无缺无重`);
}

// ── (2) 章区间覆盖 ───────────────────────────────────────
{
  // 章起始行索引（含目录里的同名行不算，只取 ^## ）
  const starts = lines
    .map((l, i) => (/^## 第[一二三四五六七八九十]+章\s+/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  chapterLines.forEach((ch) => {
    const idx = starts.indexOf(ch.line - 1);
    const end = idx + 1 < starts.length ? starts[idx + 1] : lines.length;
    const inRange = articles
      .filter((a) => a.line - 1 > ch.line - 1 && a.line - 1 < end)
      .map((a) => a.no);
    if (!inRange.length) return;
    if (!ch.range) {
      err('(2) 章区间', `L${ch.line}「${ch.title}」未写区间，但含 ${inRange.length} 条（${inRange.join(',')}）`);
      return;
    }
    const [a, b] = ch.range;
    const listed: number[] = [];
    for (let n = a; n <= b; n++) listed.push(n);
    const same =
      listed.length === inRange.length && listed.every((n, i) => n === inRange[i]);
    if (!same) err('(2) 章区间', `「${ch.title}」声明 ${a}—${b}，实际收录 ${inRange.join(',')}`);
    else ok('(2) 章区间', `${a}—${b} 覆盖正确`);
  });
}

// ── 解析全部编号单元（只认「定义处」，不认正文里的引用）────────
// 定义处形态：行首（可带缩进与 - 列表符）紧跟 **N.M…**
// 排除：目录行（- [第 N 条...]），因为它们不是编号单元定义
const clauseKeys = new Set<string>();
const clauseLines = new Map<string, number>();
// 逐个「出现」按序记录（不去重），供第 (5) 项查重号——
// 用 Set 去重会把「同号定义两次」抹平，重号检查就成了永远不触发的死代码。
const clauseOrder: string[] = [];
const defRe = /^\s*(?:-\s+)?\*\*(\d{1,2}(?:\.\d{1,2}){1,4})/;
lines.forEach((l, i) => {
  if (/^\s*-\s+\[第 \d+ 条/.test(l)) return; // 目录行
  const m = l.match(defRe);
  if (!m) return;
  const k = m[1];
  const major = Number(k.split('.')[0]);
  if (major < 1 || major > maxArt) return;
  // 判断是否为「引用上游编号」：行首编号之后紧跟的是「并入本文件」等说法，
  // 说明这一行在讲"上游的某款并到哪里"，k 本身不是本文件的定义处。
  // 例外：真正的定义处行形如 `**16.4.7.1 先独立核事实...**（**本款并入自上游...`——编号后有标题文字。
  // （原注释举例写的是 `16.4.10`，该款在 v1.0.0 下不存在，属悬空示例，2026-10-20 改为现行款号。）
  const after = l.slice(l.indexOf(m[1]) + m[1].length);
  const isUpstreamRef =
    /^\*{0,2}\s*→?\s*并入本文件/.test(after) || /^\*{0,2}\s*「[^」]*」\*{0,2}\s*→/.test(after);
  if (isUpstreamRef) return;
  if (!clauseKeys.has(k)) clauseLines.set(k, i + 1);
  clauseKeys.add(k);
  clauseOrder.push(k); // 不去重：重号要能被第 (5) 项看见
});

// ── (3) 目录锚点 ────────────────────────────────────────
{
  const tocStart = lines.findIndex((l) => /^目录（/.test(l));
  if (tocStart < 0) err('(3) 目录', '找不到目录区块');
  else {
    const tocEnd = lines.findIndex((l, i) => i > tocStart && /^---\s*$/.test(l));
    // 目录区块须以 --- 收尾；找不到就是「切不出目录」，此时退回全文切片会让
    // 正文混进目录集合、把「目录少列了几条」掩盖成通过（16.4.9 假过）。
    // 所以此处判失败，不回退。
    if (tocEnd < 0) {
      err('(3) 目录', '目录区块未见 --- 收尾分隔符，无法界定目录范围 —— 判失败，不按全文回退');
    } else {
      const block = lines.slice(tocStart + 1, tocEnd);
      // 正向断言：目录区块里只应有「目录说明＋目录条目＋空行」。
      // 出现别的行，说明 tocEnd 取到的不是目录真正的收尾分隔符（切宽了），
      // 此时再比对条数就失去意义——须先判范围切错。
      // 目录条目有两种缩进：一级章为 0 缩进 `- [第一章 …]`，条为 2 缩进 `  - [第 N 条 …]`。
      // 说明文字只允许出现在**第一个条目之前**（目录引言可跨行）；条目一旦开始，
      // 后面再出现非条目行，才是"切宽了"的信号。
      const isTocLine = (l: string) => /^ {0,4}- \[[^\]]+\]\(#[^)]+\)\s*$/.test(l);
      const firstItem = block.findIndex((l) => isTocLine(l));
      const alien = block
        .map((l, k) => ({ l, n: tocStart + 2 + k, k }))
        .filter(({ l, k }) => {
          if (l.trim() === '' || isTocLine(l)) return false;
          if (firstItem < 0) return false; // 尚无条目时，都算引言
          return k > firstItem; // 条目开始后的非条目行 → 范围切错
        });
      if (alien.length) {
        err(
          '目录',
          `目录区块混入 ${alien.length} 行非目录内容（首个在 L${alien[0].n}：${alien[0].l.slice(0, 40)}）——` +
            `收尾分隔符取错，目录范围被切宽，判失败`
        );
      } else {
        const tocNos = block
          .filter((l) => /^ {1,4}- \[第 \d+ 条/.test(l))
          .map((l) => Number(l.match(/第 (\d+) 条/)?.[1]));
        // 底线：目录里一条都没解析到时，"0 == 0"会假过，须判失败
        if (tocNos.length === 0) {
          err('(3) 目录', '目录区块内未解析到任何条目 —— 判失败，不判通过');
        } else if (tocNos.length !== articles.length) {
          err('(3) 目录', `目录列 ${tocNos.length} 条，正文 ${articles.length} 条`);
        } else if (!tocNos.every((n, i) => n === articles[i].no)) {
          err('(3) 目录', `目录条号顺序与正文不一致`);
        } else ok('(3) 目录', `${tocNos.length} 条与正文一一对应`);
      }
    }
  }
}

// ── (4) 行首加粗须带编号 ────────────────────────────────
{
  // 判定为「编号单元标题」的形态：**词句。**（以句号收尾且整段加粗）
  const bad: string[] = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\*\*([^*]+)\*\*/);
    if (!m) return;
    const inner = m[1];
    if (/^\d{1,2}\.\d{1,2}/.test(inner)) return; // 已带编号
    // 豁免：文档头（版本行、导读、合并口径）、附录小节 A.N、声明为非规范组成部分
    if (/^版本 |^导读|^合并口径|^A\.\d/.test(inner)) return;
    // 只对「以句号收尾的加粗整段」判违规，中段强调不算
    if (!/[。：]$/.test(inner)) return;
    bad.push(`L${i + 1}: **${inner.slice(0, 40)}**`);
  });
  if (bad.length) bad.forEach((b) => err('(11) 加粗编号', b));
  else ok('(11) 加粗编号', '所有行首加粗标题段落均带 N.M 编号');
}

// ── (5) 各级编号连号（不只二级，逐级下钻）──────────────────
{
  // 底线：解析不到任何编号单元时，(5)(6) 会"零个问题＝全过"——这是假过，须判失败。
  if (clauseOrder.length < 100) {
    err('(14) 底线', `只解析到 ${clauseOrder.length} 个编号单元（预期 ≥ 100），连号与引用检查无意义 —— 判失败，不判通过`);
    process.exit(1);
  }
  // 把 16.4.7.3 这类编号按前缀分组：父前缀 "16" → [4]、"16.4" → [3]、"16.4.7" → [1,2,3...]
  // 注意：必须逐个「出现」累加，不能用 Set 去重后再分组——
  // 去重会让下面的「重号」分支永远走不到（16.4.9：守卫的有效性能不能真拦，须实测）。
  // 也不能写 `for (d = 1; d < parts.length; d++)` 把各级祖先都算进同一层：
  // 那样对 "16.4" 这个父节点，"16.4.7" 与 "16.4.7.3" 会被当成两个 child=7 而与真实重复无法区分。
  const byParent = new Map<string, number[]>();
  for (const k of clauseOrder) {
    const parts = k.split('.');
    const parent = parts.slice(0, parts.length - 1).join('.'); // 只取其「直接父」
    const child = Number(parts[parts.length - 1]);
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(child);
  }
  let bad = 0;
  for (const [parent, kids] of [...byParent].sort()) {
    const sorted = [...kids].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1]) {
        err('(4) 编号连号', `${parent}.${sorted[i]} 重号（同号定义出现 ${sorted.filter((x) => x === sorted[i]).length} 次）`);
        bad++;
      } else if (sorted[i] !== sorted[i - 1] + 1) {
        err(
          '编号连号',
          `${parent} 下：.${sorted[i - 1]} 之后应为 .${sorted[i - 1] + 1}，实为 .${sorted[i]}`
        );
        bad++;
      }
    }
  }
  if (!bad) ok('(4) 编号连号', `${byParent.size} 个父节点下各级子项均连号（含三级）`);
}

// ── (6) 引用真实性 ──────────────────────────────────────
{
  const bad: string[] = [];
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/第 (\d+) 条/g)) {
      const n = Number(m[1]);
      if (n < 1 || n > maxArt) bad.push(`L${i + 1}: 「第 ${n} 条」不存在`);
    }
    // 反引号包裹的编号单元：`16.4.7.3`
    for (const m of l.matchAll(/`(\d{1,2}\.\d{1,2}(?:\.\d{1,2}){0,2})`/g)) {
      const k = m[1];
      const major = Number(k.split('.')[0]);
      if (major < 1 || major > maxArt) continue;

      // 排除版本号：`2.7.0` 这类**三段 X.Y.Z 且末段为 0 或紧随 v 前缀**的串不是条款号。
      // 判据（任一即视为版本号）：
      //   (a) 紧邻前置字符是 `v`／`V`（如 `v1.7.0`）；
      //   (b) 同一行出现"版本"字样，且形如 X.Y.Z（三段且首段 ≤ 9，符合语义化版本）；
      // 理由：条款号最多到 16.4.7.3 这类，但**版本号同样长得像**，不区分会把示例当悬空引用。
      const before = l.slice(Math.max(0, m.index! - 1), m.index!);
      const isVerPrefixed = /[vV]$/.test(before);
      const isSemver = /^\d{1,2}\.\d{1,2}\.0$/.test(k) && /版本/.test(l);
      if (isVerPrefixed || isSemver) continue;

      if (!clauseKeys.has(k)) bad.push(`L${i + 1}: \`${k}\` 无此编号单元`);
    }
  });
  const uniq = [...new Set(bad)];
  if (uniq.length) uniq.slice(0, 25).forEach((b) => err('(9) 引用', b));
  else ok('(9) 引用', '引用的条号与编号单元均存在');
}

// ── (5) 禁用字符（含全库文档扫描）──────────────────────
// 22 第 8 行管的是"**自己写的任何正式文本**"，不限本文件。只查 DEV-RULES.md 是**假过**：
// 实测本轮全库扫出 28 处 ①②③（README 版本表 24 处、开发日志 4 处）而本维一直报绿——
// 因为被检范围从一开始就窄了（12.5.4.2「零个维度自然零个错误」的另一形态）。
{
  const banned = /[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑴⑵⑶⑷⑸⑹]/;
  const bad: string[] = [];
  lines.forEach((l, i) => {
    if (!banned.test(l)) return;
    // 豁免：作为**反例**引述的地方（如「`①` 等特殊符号 → 改用 `(1)`」）。
    // 判据参照 20.4.3「引述历史当时写法属史实记载、经白名单放行」——
    // 规则要说清"不许用什么"，就必须能举出它；把反例本身也禁掉，规则将无法表述。
    // 豁免条件写死、不放宽：**同一行内**既出现禁用字符，又出现替代写法 `(1)`。
    if (/\(1\)/.test(l)) return;
    bad.push(`L${i + 1}: ${l.slice(0, 40)}`);
  });
  if (bad.length) bad.forEach((b) => err('(5) 禁用字符', b));

  // 全库文档扫描：当前生效的对外/对内文档，不含历史存档（述史豁免，20.4.3）。
  const DOCS = [
    'README.md',
    'skill/SKILL.md',
    'skill/CARD.md',
    'skill/LICENSE.md',
    'skill/VERSION.md',
    'skill/references/DEV_SPEC.md',
    'EVALUATION.md',
    'dev/CHANGELOG.md',
    'maint/DEVLOG.md',
  ];
  let docHits = 0;
  let docScanned = 0;
  for (const rel of DOCS) {
    const p = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(p)) continue;
    docScanned++;
    fs.readFileSync(p, 'utf8')
      .split('\n')
      .forEach((l, i) => {
        if (!banned.test(l)) return;
        if (/\(1\)/.test(l)) return; // 反例引述
        docHits++;
        err('(5) 禁用字符', `${rel}:${i + 1}: ${l.trim().slice(0, 40)}`);
      });
  }
  if (docScanned === 0) {
    err('(5) 禁用字符', '全库文档扫描未读到任何文件 —— 判失败，不判通过');
  } else if (bad.length === 0 && docHits === 0) {
    ok('(5) 禁用字符', `本文件与 ${docScanned} 份文档均无特殊面板符号（反例引述已放行）`);
  }
}

// ── (3b) 跨文件条号引用（12.5.1.1.1）──────────────────────
// 第 (9) 维只查**本文件内部**的悬空引用。「条号」还会被别处引用——
// 脚本注释、随包文档、开发侧说明里写死的"（铁律 9.4）"，本文件一重排即全部悬空。
// 判据边界（照 12.5.1.1.1 的四条写死，不得放宽）：
//   （甲）只认紧邻"铁律"二字的引用——裸写"第 9.4 条"可能是别家文档的编号，不属本维；
//   （乙）只认机械悬空——改号后指向了另一个真实存在的款（语义该是 A、实际写 B）查不出，
//        仍靠 12.5.1 的"语义部分靠人工"；
//   （丙）开发日志与历史记录豁免（述史，改了反而失真）；
//   （丁）扫描范围限开发侧工具目录、技能本体、运行实例目录三处。
{
  const ROOTS = ['maint/tools', 'skill', 'src'];
  const SKIP = /(^|\/)(archive|node_modules|release|dist|dist-single)\//;
  // 述史类文件整份豁免（丙）
  const HIST = /(DEVLOG|CHANGELOG|24\.3 落实|archive)/i;
  const EXT = /\.(ts|tsx|js|mjs|py|md|json|ya?ml)$/;

  const walk = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      const rel = path.relative(process.cwd(), p);
      if (SKIP.test(rel + '/')) continue;
      if (e.isDirectory()) out.push(...walk(p));
      else if (EXT.test(e.name)) out.push(p);
    }
    return out;
  };

  const bad: string[] = [];
  let scanned = 0; // 底线断言用：扫了 0 个文件，"零个问题"毫无意义
  let hits = 0; // 真实引用数（排除本脚本自身的说明文本）
  let selfHits = 0; // 本脚本注释里举例用的引用——不参与"有引用才叫验过"的结论
  // 本脚本自身的相对路径——用来把"脚本注释里举例的引用"与"别处的真实引用"分开计数
  const SELF = path.relative(process.cwd(), path.resolve(process.argv[1] ?? ''));
  for (const root of ROOTS) {
    for (const f of walk(path.resolve(process.cwd(), root))) {
      const rel = path.relative(process.cwd(), f);
      if (HIST.test(rel)) continue;
      scanned++;
      const isSelf = rel === SELF;
      const text = fs.readFileSync(f, 'utf8');
      text.split('\n').forEach((l, i) => {
        // 两种等价写法都要认（2026-10-20 全库检查时发现只认前者，漏了后者：
        // 本项目大量引用写的是 `DEV-RULES 20.1`，该维却报"未发现引用"——判据过窄即假过）：
        //   (a) 「铁律 9.4」「铁律第 9.4 条」「铁律 16.4.7.3」
        //   (b) 「DEV-RULES 20.1」「`DEV-RULES 20.4.2`」
        for (const m of l.matchAll(/铁律\s*第?\s*(\d{1,2}(?:\.\d{1,2}){1,3})\s*条?/g)) {
          const k = m[1];
          const major = Number(k.split('.')[0]);
          if (major < 1 || major > maxArt) {
            bad.push(`${rel}:${i + 1}: 铁律 ${k} —— 条号 ${major} 超出 1—${maxArt}`);
            continue;
          }
          if (isSelf) selfHits++;
          else hits++;
          if (!clauseKeys.has(k)) bad.push(`${rel}:${i + 1}: 铁律 ${k} —— 无此编号单元`);
        }
        for (const m of l.matchAll(/DEV-RULES\s*(\d{1,2}(?:\.\d{1,2}){1,3})/g)) {
          const k = m[1];
          const major = Number(k.split('.')[0]);
          if (major < 1 || major > maxArt) {
            bad.push(`${rel}:${i + 1}: DEV-RULES ${k} —— 条号 ${major} 超出 1—${maxArt}`);
            continue;
          }
          if (isSelf) selfHits++;
          else hits++;
          if (!clauseKeys.has(k)) bad.push(`${rel}:${i + 1}: DEV-RULES ${k} —— 无此编号单元`);
        }
      });
    }
  }
  if (scanned === 0) {
    err('(3b) 跨文件引用', `一个文件都没扫到（根目录：${ROOTS.join('、')}）—— 判失败，不判通过`);
  } else if (bad.length) {
    bad.slice(0, 25).forEach((b) => err('(3b) 跨文件引用', b));
    if (bad.length > 25) err('(3b) 跨文件引用', `另有 ${bad.length - 25} 处未列出`);
  } else {
    // 结论行须分清"真扫到引用"与"只扫到自己的举例"：
    // 把自证算进"全部合规"，读者会以为本维已被真实引用验过（12.5.4.2 假过的另一种形态）。
    const tail = selfHits ? `（另 ${selfHits} 处为本脚本自身的举例文本，不计入）` : '';
    ok(
      '(3b) 跨文件引用',
      hits > 0
        ? `${scanned} 个文件、${hits} 处"铁律 N.M"引用全部落在现行编号内${tail}`
        : `${scanned} 个文件已扫，未发现跨文件"铁律 N.M"引用${tail} —— 本维通过，但尚未被真实引用验过`
    );
  }
}

// ── 24.3 落点表 ─────────────────────────────────────────
const tblStart = lines.findIndex((l) => /^\| 条 \| 名称 \| 落点 \| 兜在何处 \|$/.test(l));
if (tblStart < 0) {
  err('(13) 24.3 表', '找不到 24.3 落点表的表头');
} else {
  const rows: { no: number; landing: string }[] = [];
  for (let i = tblStart + 2; i < lines.length; i++) {
    const m = lines[i].match(/^\| (\d+) \| [^|]+ \| ([^|]+) \|/);
    if (!m) {
      if (lines[i].trim() === '') break;
      continue;
    }
    rows.push({ no: Number(m[1]), landing: m[2].trim() });
  }

  // ── (8) 登记完整性 ────────────────────────────────────
  const expected: number[] = [];
  for (let n = 1; n <= maxArt; n++) expected.push(n);
  const listed = rows.map((r) => r.no);
  const missing = expected.filter((n) => !listed.includes(n));
  const extra = listed.filter((n) => n < 1 || n > maxArt);
  const dupR = listed.filter((n, i) => listed.indexOf(n) !== i);
  if (missing.length) err('(13) 24.3 表', `漏登条号：${missing.join(', ')}`);
  if (extra.length) err('(13) 24.3 表', `多登条号：${extra.join(', ')}`);
  if (dupR.length) err('(13) 24.3 表', `重登条号：${[...new Set(dupR)].join(', ')}`);
  if (!missing.length && !extra.length && !dupR.length)
    ok('(13) 24.3 表', `${rows.length} 条全部登记，无漏无多无重`);

  // ── (9) 落点词表 ──────────────────────────────────────
  const allowed = ['守卫', '人工', '流程', '守卫＋人工', '守卫缺口'];
  let bad = 0;
  rows.forEach((r) => {
    // 表格单元格内常写 **守卫＋人工**，比对前剥掉加粗标记
    const plain = r.landing.replace(/\*\*/g, '').trim();
    if (!allowed.includes(plain)) {
      err('(13) 落点词表', `第 ${r.no} 条落点「${plain}」不在四态词表内`);
      bad++;
    }
  });
  if (!bad) ok('(13) 落点词表', '全部落点属规定词表');
}

console.log(`\n${fail === 0 ? '✓ 全部通过' : `✗ 共 ${fail} 项失败`}`);
process.exit(fail === 0 ? 0 : 1);
