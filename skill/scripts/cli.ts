/**
 * 法律计算器 CLI
 *
 * 用法：
 *   npx tsx skill/scripts/cli.ts --list
 *   npx tsx skill/scripts/cli.ts --search 违约金
 *   npx tsx skill/scripts/cli.ts <计算器id> --参数=值 ...
 *   npx tsx skill/scripts/cli.ts --report report.json --format md|html|word|excel|pdf|png|txt [--out 文件或目录]
 *
 * 说明：核心计算逻辑位于 src/core，与网页端共用同一份实现。
 * **两种跑法**：开发侧直接跑本文件（引用 src/core 真源码）；装进技能包后跑
 * 自带的 `lib/` bundle（见 build-skill-bundles.mjs）——包内不含 src/，因此下面
 * 先试 lib，再回落到源码。两条路径指向同一份实现，改口径只需改 src/core。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { CalcValues } from '../../src/core/types';
import type { ExportFormat, Party } from '../../src/core/report';
import { loadFirst, CORE_CANDIDATES } from './core-loader';

/* 三类核心能力分别装：计算器注册表、报告导出、版本常量。
   每个都"先包内 lib、再开发侧 src"，装到哪都能跑（见 core-loader.ts）。 */
const CORE = loadFirst<typeof import('../../src/core/calculators')>(CORE_CANDIDATES('calculators'));
const REPORT = loadFirst<typeof import('../../src/core/report')>([
  ['lib/report.mjs', '../lib/report.mjs'],
  ['src/core/report', '../../src/core/report'],
]);
const VERSION_MOD = loadFirst<typeof import('../../src/core/version')>([
  ['lib/version.mjs', '../lib/version.mjs'],
  ['src/core/version', '../../src/core/version'],
]);
const {
  ALL_CALCULATORS,
  CATEGORIES,
  getCalculator,
  defaultValues,
  searchCalculators,
} = CORE;
const { VERSION_LINE } = VERSION_MOD;
const {
  resolveReport,
  exportBaseName,
  reportToMarkdown,
  reportToPlainText,
  reportToHtmlFile,
  reportToWordHtml,
  reportToSheets,
  reportToPngHtml,
} = REPORT;

const arg = process.argv.slice(2);

function printHelp(): void {
  console.log(`${VERSION_LINE} · 共 ${ALL_CALCULATORS.length} 个计算器

用法：
  --version                    显示版本号
  --list                       列出全部计算器
  --search <关键词>             搜索计算器
  <id> --参数=值                执行单个计算
  --report <json>               生成汇总报告
      --format md|html|word|excel|pdf|png|txt
                                    单格式输出一个文件；逗号分隔多选批量导出并逐项校验，
                                    如 --format md,excel,png
      --out <文件或目录>            单格式＝文件路径；多格式＝输出目录
      文件名自动按「当事方简称_事项_费用类型_生成时间」四段式生成（与网页端一致）；
      items[].parties[] 支持 short 简称字段用于命名，重名自动追加 -2 / -3。
      Excel 导出需 xlsx 依赖（技能目录 npm i xlsx）；缺省时其它格式照常导出。
      PNG 导出为整页长图（需本机 Chromium；找不到浏览器时降级为同名 .shot.html）。
  --help                       显示本帮助

示例：
  npx tsx skill/scripts/cli.ts civil-fee --amount=1000000
  npx tsx skill/scripts/cli.ts contract-penalty --principal=1000000 --dailyRate=5 \\
      --startDate=2025-01-01 --endDate=2026-06-30
  npx tsx skill/scripts/cli.ts --report report.json --format md --out 报告.md
`);
}

/** 本机时区的今天（YYYY-MM-DD），避免 toISOString 的 UTC 偏移导致日期差一天 */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pad(s: string, n: number): string {
  // 中文按两个字符宽度计算
  const width = [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
  return s + ' '.repeat(Math.max(0, n - width));
}

function listAll(): void {
  for (const cat of CATEGORIES) {
    const list = ALL_CALCULATORS.filter((c) => c.category === cat.id);
    console.log(`\n【${cat.name}】${cat.desc}`);
    for (const c of list) {
      console.log(`  ${pad(c.id, 22)}${c.name}  —  ${c.summary}`);
    }
  }
  console.log(`\n共 ${ALL_CALCULATORS.length} 个计算器。`);
}

function search(kw: string): void {
  const r = searchCalculators(kw);
  if (!r.length) {
    console.log(`未找到匹配「${kw}」的计算器。`);
    return;
  }
  console.log(`找到 ${r.length} 个结果：`);
  r.forEach((c) => console.log(`  ${pad(c.id, 22)}${c.name}  —  ${c.summary}`));
}

function runOne(id: string, rawFlags: Record<string, string>): void {
  const def = getCalculator(id);
  if (!def) {
    console.error(`未找到计算器「${id}」。使用 --list 查看全部。`);
    process.exit(1);
  }

  const values: CalcValues = defaultValues(def);
  for (const [k, v] of Object.entries(rawFlags)) {
    if (!(k in values)) {
      console.error(`警告：未知参数「${k}」，已忽略。`);
      continue;
    }
    values[k] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(Number(v)) ? v : Number(v);
  }

  let output;
  try {
    output = def.calc(values);
  } catch (e) {
    console.error(`计算失败：${String(e)}`);
    process.exit(1);
  }

  const L: string[] = [];
  L.push('═'.repeat(60));
  L.push(`  ${def.name}`);
  L.push(`  ${def.summary}`);
  L.push('═'.repeat(60));
  L.push('');
  L.push(`【${output.main.label}】`);
  L.push(`    ${output.main.value}${output.main.unit ? ' ' + output.main.unit : ''}`);
  if (output.main.sub) L.push(`    ${output.main.sub}`);
  L.push('');

  if (output.blocks?.length) {
    L.push('── 分项结果 ──');
    for (const b of output.blocks) {
      L.push(`  ${pad(b.label, 26)}${b.value}${b.unit ? ' ' + b.unit : ''}${b.sub ? `  （${b.sub}）` : ''}`);
    }
    L.push('');
  }

  if (output.steps.length) {
    L.push('── 计算明细 ──');
    for (const s of output.steps) {
      L.push(`  ${s.label}`);
      L.push(`      ${s.value}`);
      if (s.note) L.push(`      ※ ${s.note}`);
    }
    L.push('');
  }

  if (output.basis.length) {
    L.push('── 法律依据 ──');
    for (const b of output.basis) {
      L.push(`  ${b.law}${b.article ? ' ' + b.article : ''}`);
      L.push(`    ${b.text}`);
    }
    L.push('');
  }

  if (output.tips?.length) {
    L.push('── 实务提示 ──');
    output.tips.forEach((t) => L.push(`  · ${t}`));
    L.push('');
  }

  L.push(`计算结果仅供参考，不构成法律意见。`);
  console.log(L.join('\n'));
}

async function runReport(jsonPath: string, formatSpec: string, out?: string): Promise<void> {
  const abs = path.resolve(jsonPath);
  if (!fs.existsSync(abs)) {
    console.error(`报告配置文件不存在：${abs}`);
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(abs, 'utf-8'));
  const options = {
    title: parsed.title ?? '法务测算报告',
    subject: parsed.subject,
    author: parsed.author,
    date: parsed.date ?? localToday(),
    summary: parsed.summary,
    items: (parsed.items ?? []).map((it: Record<string, unknown>) => {
      const def = getCalculator(String(it.calcId));
      return {
        calcId: String(it.calcId),
        title: it.title as string | undefined,
        date: it.date as string | undefined,
        owner: it.owner as string | undefined,
        agent: it.agent as string | undefined,
        parties: it.parties as Party[] | undefined,
        note: it.note as string | undefined,
        values: { ...(def ? defaultValues(def) : {}), ...((it.values as Record<string, unknown>) ?? {}) },
      };
    }),
    includeParams: parsed.includeParams ?? true,
    includeSteps: parsed.includeSteps ?? true,
    includeBasis: parsed.includeBasis ?? true,
    includeTips: parsed.includeTips ?? true,
  };

  const resolved = resolveReport(options);
  if (!resolved.items.length) {
    console.error('报告中没有有效的计算项目，请检查 items 中的 calcId。');
    process.exit(1);
  }

  /* 四段式导出命名：当事方简称_事项_费用类型_生成时间（与 Web 端共用 exportBaseName） */
  const base = exportBaseName(resolved);

  /** 自动命名时的重名避让：目标已存在则追加 -2 / -3…；用户显式 --out 指定时直接覆盖 */
  function uniqueTarget(p: string): string {
    if (!fs.existsSync(p)) return p;
    const dir = path.dirname(p);
    const ext = path.extname(p);
    const stem = path.basename(p, ext);
    for (let i = 2; i < 1000; i++) {
      const q = path.join(dir, `${stem}-${i}${ext}`);
      if (!fs.existsSync(q)) return q;
    }
    return p;
  }

  /* ── 格式解析：支持逗号分隔多选，兼容旧别名 doc / xlsx / text ── */
  const FORMAT_ALIASES: Record<string, ExportFormat> = {
    md: 'md', markdown: 'md',
    html: 'html', htm: 'html',
    word: 'word', doc: 'word',
    excel: 'excel', xlsx: 'excel',
    pdf: 'pdf',
    png: 'png', image: 'png', img: 'png',
    txt: 'txt', text: 'txt',
  };
  const FORMAT_LABEL: Record<ExportFormat, string> = {
    md: 'Markdown', html: 'HTML', word: 'Word', excel: 'Excel', pdf: 'PDF', png: '图片', txt: '纯文本',
  };
  const formats = formatSpec
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => FORMAT_ALIASES[s]);
  if (formats.some((f) => !f)) {
    console.error(`不支持的格式，可选：md | html | word | excel | pdf | png | txt（可逗号分隔多选）`);
    process.exit(1);
  }

  function bytesLabel(n: number): string {
    return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
  }

  /** 单格式内容构建（pdf 走打印管线、png 走截图管线，均不在此列） */
  async function buildContent(format: ExportFormat): Promise<{ content: string | Buffer; ext: string }> {
    switch (format) {
      case 'md':
        return { content: reportToMarkdown(resolved), ext: 'md' };
      case 'html':
        return { content: reportToHtmlFile(resolved), ext: 'html' };
      case 'word':
        return { content: reportToWordHtml(resolved), ext: 'doc' };
      case 'txt':
        return { content: reportToPlainText(resolved), ext: 'txt' };
      case 'excel': {
        const sheets = reportToSheets(resolved);
        /* 用 createRequire 同步解析：既认开发侧 node_modules，也认使用者全局装的 xlsx；
           避免 `await import('xlsx')` 在包内解析基准变成技能目录而找不到。 */
        let XLSX: typeof import('xlsx');
        try {
          XLSX = createRequire(import.meta.url)('xlsx') as typeof import('xlsx');
        } catch (e) {
          if (!/Cannot find (module|package)/.test(String(e))) throw e;
          throw new Error('Excel 导出需要 xlsx 依赖：在技能目录执行 npm i xlsx（或改用 --format md,html,word,pdf,png,txt）');
        }
        const wb = XLSX.utils.book_new();
        for (const s of sheets) {
          const ws = XLSX.utils.aoa_to_sheet(s.rows);
          const widths = s.rows.reduce<number[]>((acc, row) => {
            row.forEach((cell, ci) => {
              const len = String(cell ?? '').length * 1.6;
              acc[ci] = Math.min(60, Math.max(acc[ci] ?? 10, len));
            });
            return acc;
          }, []);
          ws['!cols'] = widths.map((w) => ({ wch: w }));
          XLSX.utils.book_append_sheet(wb, ws, s.sheet.slice(0, 31));
        }
        return { content: Buffer.from(XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })), ext: 'xlsx' };
      }
      default:
        throw new Error(`${format} 不走 buildContent`);
    }
  }

  /**
   * PNG 校验：光看「文件非空」不够——半张图、纯白底也都是合法 PNG。
   * 这里读 IHDR 里的宽高判断是否是**长图**（高度明显大于浏览器窗口），
   * 再扫一遍 IDAT 长度，挡住「只画了个头就收工」的情况。
   */
  function pngCheck(buf: Buffer, size: string, items: string): { ok: boolean; check: string } {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (buf.length < 33 || !sig.every((b, i) => buf[i] === b)) return { ok: false, check: `不是合法的 PNG（文件头不符，${size}）` };
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (!w || !h || w < 200) return { ok: false, check: `PNG 尺寸异常（${w}×${h}）` };
    /* 报告至少含封面 + 汇总 + 总览表 + 页脚，900 宽下高度几乎不可能低于 600 */
    if (h < 600) return { ok: false, check: `图片过矮（${w}×${h}），疑似只渲染了局部` };
    return { ok: true, check: `PNG 长图 ${w}×${h}px，${size}，${items}` };
  }

  /**
   * PNG：Chromium 无头「截图」路线，两步走：
   *
   * ① 量高：往 HTML 尾部注入一段探针脚本，把 #report-root 的真实排版高度写进
   *    <title>，用 --dump-dom 读回精确值。
   *    为什么不猜：猜小了截断内容、猜大了图里全是空白——上一版按字数估算高度的
   *    实测出过 60000px 高、九成空白的图，教训就是必须真量。
   * ② 截图：--screenshot 按量得的高度开窗，一次截全。
   *
   * 和网页端共用同一份 reportToPngHtml，出图版式一致；--force-device-scale-factor=2
   * 出 2 倍图，微信里不糊。Node 里没有 DOM + canvas，跑不了网页端的 composePng，
   * 让浏览器自己排版自己截，是 CLI 侧最省依赖的同效做法。
   */
  function shotToPng(htmlPath: string, pngPath: string): { ok: boolean; fallback?: string; browser?: string } {
    const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    const PROBE =
      '<script>(function(){function put(){var r=document.getElementById("report-root");' +
      'if(r)document.title="RCHEIGHT:"+Math.ceil(r.getBoundingClientRect().height);}' +
      'setTimeout(put,400);})();</script></body>';

    for (const c of candidates) {
      if (spawnSync(c, ['--version'], { timeout: 15000 }).status !== 0) continue;

      /* ① 量高：探针写 title → dump-dom → 正则读回 */
      const html = fs.readFileSync(htmlPath, 'utf-8');
      if (!/<\/body>/i.test(html)) return { ok: false, fallback: htmlPath };
      const probePath = htmlPath.replace(/\.html$/i, '.probe.html');
      fs.writeFileSync(probePath, html.replace(/<\/body>/i, PROBE));
      const dump = spawnSync(
        c,
        ['--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=6000', '--dump-dom', `file://${probePath}`],
        { timeout: 60000, maxBuffer: 64 * 1024 * 1024 },
      );
      fs.unlinkSync(probePath);
      const m = /RCHEIGHT:(\d+)/.exec(dump.stdout.toString());
      if (dump.status !== 0 || !m) return { ok: false, fallback: htmlPath };
      const height = Math.max(800, parseInt(m[1], 10) + 8); // +8 兜住取整误差，避免底部削掉 1px

      /* ② 截图：窗口高度=内容高度，一次截全（window-size 高度上限约 32767，报告一般不至于超） */
      const r = spawnSync(
        c,
        [
          '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
          '--force-device-scale-factor=2',
          `--window-size=900,${height}`,
          `--screenshot=${pngPath}`,
          `file://${htmlPath}`,
        ],
        { timeout: 120000 },
      );
      if (r.status !== 0 || !fs.existsSync(pngPath)) return { ok: false, fallback: htmlPath };
      const buf = fs.readFileSync(pngPath);
      if (buf.length < 33 || buf[0] !== 0x89 || buf[1] !== 0x50) return { ok: false, fallback: htmlPath };
      return { ok: true, browser: c };
    }
    return { ok: false, fallback: htmlPath };
  }

  /** 导出校验机制（CLI 落地）：写盘后读回核对结构特征，机器判定不靠人眼 */
  function verifyFile(format: ExportFormat, file: string): { ok: boolean; check: string } {
    const buf = fs.readFileSync(file);
    const size = bytesLabel(buf.length);
    const items = `${resolved.items.length} 个计算项`;
    const head = buf.subarray(0, 512).toString('utf-8');
    const tail = buf.subarray(Math.max(0, buf.length - 64)).toString('utf-8');
    switch (format) {
      case 'md':
        return /^#\s/m.test(head) && buf.length > 200
          ? { ok: true, check: `标题与分项结构完整，${size}，${items}` }
          : { ok: false, check: `缺少 Markdown 一级标题或内容过短（${size}）` };
      case 'html':
      case 'word':
        return /<!doctype html|<html[\s>]/i.test(head) && /<\/html>/i.test(tail)
          ? { ok: true, check: `完整 HTML 文档（doctype + 闭合），${size}，${items}` }
          : { ok: false, check: `HTML 结构不完整（${size}）` };
      case 'excel': {
        const isZip = buf.subarray(0, 2).toString('latin1') === 'PK';
        const isXml = head.includes('mso-application') || head.includes('<?xml');
        return isZip || isXml
          ? { ok: true, check: `${isZip ? 'OOXML(xlsx) zip 容器' : 'SpreadsheetML(xls)'} 结构完整，${size}，${items}` }
          : { ok: false, check: `不是合法的 Excel 文件（${size}）` };
      }
      case 'pdf':
        return buf.subarray(0, 5).toString('latin1') === '%PDF-'
          ? { ok: true, check: `PDF 文件头正确（%PDF-），${size}，${items}` }
          : { ok: false, check: `PDF 文件头缺失（${size}）` };
      case 'txt':
        return buf.length >= 100
          ? { ok: true, check: `纯文本完整，${size}，${items}` }
          : { ok: false, check: `精简文本过短（${size}），疑似生成异常` };
      case 'png':
        return pngCheck(buf, size, items);
    }
  }

  /** PDF：Chromium 无头打印（--print-to-pdf），未找到浏览器时降级输出打印视图 HTML */
  function printToPdf(htmlPath: string, pdfPath: string): { ok: boolean; fallback?: string; browser?: string } {
    const candidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
    for (const c of candidates) {
      const probe = spawnSync(c, ['--version'], { timeout: 15000 });
      if (probe.status !== 0) continue;
      const r = spawnSync(
        c,
        ['--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`],
        { timeout: 120000 },
      );
      if (r.status === 0 && fs.existsSync(pdfPath) && fs.readFileSync(pdfPath).subarray(0, 5).toString('latin1') === '%PDF-') {
        return { ok: true, browser: c };
      }
      return { ok: false, fallback: htmlPath };
    }
    return { ok: false, fallback: htmlPath };
  }

  const outDir = formats.length > 1 ? (out ?? '.') : path.dirname(out ?? `${base}.md`);
  if (formats.length > 1 && !fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const results: Array<{ format: ExportFormat; file: string; ok: boolean; check: string; size: number }> = [];
  for (const format of formats) {
    try {
      if (format === 'pdf') {
        // 打印管线：写打印视图 HTML → Chromium 转 PDF → 校验 → 清理临时文件
        // 多格式＝输出目录（重名避让）；单格式显式 --out＝文件路径（覆盖）；单格式无 --out＝自动命名（重名避让）
        const pdfTarget =
          formats.length > 1
            ? uniqueTarget(path.join(outDir, `${base}.pdf`))
            : out ?? uniqueTarget(path.join(outDir, `${base}.pdf`));
        const printHtml = pdfTarget.replace(/\.pdf$/i, '.print.html');
        fs.writeFileSync(printHtml, reportToHtmlFile(resolved));
        const pdfPath = path.resolve(pdfTarget);
        const r = printToPdf(path.resolve(printHtml), pdfPath);
        if (r.ok) {
          fs.unlinkSync(printHtml);
          const v = verifyFile('pdf', pdfPath);
          results.push({ format, file: pdfPath, ...v, size: fs.statSync(pdfPath).size });
        } else {
          results.push({
            format,
            file: r.fallback!,
            ok: false,
            check: `未找到可用的 Chromium / Chrome，无法直接生成 PDF；已降级输出打印视图 ${path.basename(r.fallback!)}，用浏览器打开后 Ctrl+P「另存为 PDF」`,
            size: fs.statSync(r.fallback!).size,
          });
        }
        continue;
      }
      if (format === 'png') {
        /* 截图路线：先落一份自包含 HTML，交给 Chromium 排版并截图，成功后删临时 HTML */
        const pngTarget =
          formats.length > 1
            ? uniqueTarget(path.join(outDir, `${base}.png`))
            : out ?? uniqueTarget(path.join(outDir, `${base}.png`));
        const shotHtml = pngTarget.replace(/\.png$/i, '.shot.html');
        fs.writeFileSync(shotHtml, reportToPngHtml(resolved));
        const pngPath = path.resolve(pngTarget);
        const r = shotToPng(path.resolve(shotHtml), pngPath);
        if (r.ok) {
          fs.unlinkSync(shotHtml);
          const v = verifyFile('png', pngPath);
          results.push({ format, file: pngPath, ...v, size: fs.statSync(pngPath).size });
        } else {
          results.push({
            format,
            file: r.fallback!,
            ok: false,
            check: `未找到可用的 Chromium / Chrome，无法直接截图；已降级输出长图版 HTML ${path.basename(r.fallback!)}，浏览器打开后 Ctrl+S 或改用 --format html,pdf`,
            size: fs.statSync(r.fallback!).size,
          });
        }
        continue;
      }
      const { content, ext } = await buildContent(format);
      const target =
        formats.length > 1
          ? uniqueTarget(path.join(outDir, `${base}.${ext}`))
          : out ?? uniqueTarget(`${base}.${ext}`);
      fs.writeFileSync(path.resolve(target), content);
      const v = verifyFile(format, path.resolve(target));
      results.push({ format, file: path.resolve(target), ...v, size: fs.statSync(path.resolve(target)).size });
    } catch (e) {
      results.push({ format, file: '', ok: false, check: `导出失败：${String(e)}`, size: 0 });
    }
  }

  console.log(`报告「${options.title}」共 ${resolved.items.length} 个计算项目，导出 ${formats.length} 种格式：`);
  for (const r of results) {
    const name = r.file ? path.basename(r.file) : '—';
    console.log(`  ${r.ok ? '✓' : '✗'} ${FORMAT_LABEL[r.format].padEnd(8)} ${name.padEnd(28)} ${r.check}`);
  }
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n导出校验：${okCount}/${results.length} 通过${okCount === results.length ? '' : '（存在未通过项，见上）'}`);
  if (okCount !== results.length) process.exit(1);
}

async function main(): Promise<void> {
  if (!arg.length || arg.includes('--help') || arg.includes('-h')) {
    printHelp();
    return;
  }

  if (arg[0] === '--version' || arg[0] === '-v') {
    console.log(VERSION_LINE);
    return;
  }

  if (arg[0] === '--list') {
    listAll();
    return;
  }

  if (arg[0] === '--search') {
    search(arg[1] ?? '');
    return;
  }

  if (arg[0] === '--report') {
    const jsonPath = arg[1];
    const fi = arg.indexOf('--format');
    const oi = arg.indexOf('--out');
    await runReport(jsonPath, fi >= 0 ? arg[fi + 1] : 'md', oi >= 0 ? arg[oi + 1] : undefined);
    return;
  }

  const id = arg[0];
  const flags: Record<string, string> = {};
  for (const a of arg.slice(1)) {
    if (!a.startsWith('--')) continue;
    const body = a.slice(2);
    const eq = body.indexOf('=');
    if (eq < 0) flags[body] = 'true';
    else flags[body.slice(0, eq)] = body.slice(eq + 1);
  }
  runOne(id, flags);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
