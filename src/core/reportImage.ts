/**
 * PNG 长图报告（纯函数 · 零依赖）
 * =============================
 * 为什么不是「截屏」：截图只能拿到当前屏幕那一块，侧边栏、滚动条、窗口宽度都会进画面，
 * 一屏之外的内容直接丢掉。报告要发给客户，必须是**完整、可控、可复现**的版面。
 *
 * 所以这里走「**按数据模型重排一遍**」：从 ResolvedReport 生成一张 A4 宽度、
 * 纵向可无限延长的**内联样式 HTML**，再交给 composePng() 变成 PNG 位图。
 * 好处是：与窗口大小无关、跟随「导出内容」开关、桌面端与 CLI 出图一致。
 *
 * 为什么必须内联样式：栅格化走的是 `SVG <foreignObject>` 路线，SVG 一旦被当作
 * 图片绘制，**外部样式表全部失效**（浏览器不允许图片去读文档 CSS）。因此这里
 * 不使用任何 className，所有样式都写在 style 属性或 <style> 块里（并转成内联）。
 *
 * 为什么是 SVG 而不是自己画像素：中文字体排版（换行、字重、表格对齐）自己做
 * 既慢又必然出错；浏览器本来就最会做这件事，让它排版、只把结果取成位图即可。
 * 代价是没法在 <canvas> 上直接画 DOM，故采用 foreignObject 中转（现代 Chromium /
 * Safari / Firefox 均支持；不支持时 UI 会明确提示改用 HTML / PDF，不静默出错）。
 */
import type { ResolvedReport, ResolvedItem } from './report';
import { isSharedField } from './compare';
import { PRODUCT_NAME } from './version';
import { money } from './format';

/* ───────────────────────── 版面常量 ───────────────────────── */

/** 出图宽度（px）。A4 竖版 210mm 按 96dpi ≈ 794px，取 900 更利于微信里看清 */
export const PNG_WIDTH = 900;
/** 内边距 */
const PAD = 44;
/** 栅格化倍率：2 倍 = 等效 1800px 宽，微信不糊，文件也不至于过大 */
export const PNG_SCALE = 2;

const C = {
  text: '#101828',
  text2: '#475467',
  text3: '#98a2b3',
  border: '#e4e7ec',
  head: '#f9fafb',
  primary: '#5b3df5',
  primarySoft: '#f1edff',
  danger: '#d92d20',
  dangerSoft: '#fef3f2',
  success: '#039855',
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Source Han Sans SC', sans-serif";

/* ───────────────────────── 小工具 ───────────────────────── */

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const st = (o: Record<string, string | number>): string =>
  Object.entries(o)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
    .join(';');

/** 表格单元格：报表里数字右对齐、文字左对齐，读起来才不费劲 */
function td(content: string, opts: { right?: boolean; bold?: boolean; color?: string; muted?: boolean } = {}): string {
  return `<td style="${st({
    padding: '7px 10px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: '12.5px',
    lineHeight: '1.6',
    textAlign: opts.right ? 'right' : 'left',
    fontWeight: opts.bold ? 700 : 400,
    color: opts.muted ? C.text3 : (opts.color ?? C.text),
    verticalAlign: 'top',
    wordBreak: 'break-word',
  })}">${content}</td>`;
}

function th(content: string, right = false): string {
  return `<th style="${st({
    padding: '7px 10px',
    background: C.head,
    borderBottom: `1px solid ${C.border}`,
    fontSize: '12px',
    fontWeight: 600,
    color: C.text2,
    textAlign: right ? 'right' : 'left',
    whiteSpace: 'nowrap',
  })}">${esc(content)}</th>`;
}

function sectionTitle(text: string, extra = ''): string {
  return `<div style="${st({
    fontSize: '13.5px',
    fontWeight: 700,
    color: C.text,
    margin: '22px 0 9px',
    paddingLeft: '9px',
    borderLeft: `3px solid ${C.primary}`,
    lineHeight: '1.4',
  })}">${esc(text)}${extra}</div>`;
}

/* ───────────────────────── 版块渲染 ───────────────────────── */

function coverHead(r: ResolvedReport): string {
  const o = r.options;
  const meta = [
    o.subject ? `项目 / 客户：${o.subject}` : '',
    o.author ? `编制人：${o.author}` : '',
    o.date ? `日期：${o.date}` : '',
  ]
    .filter(Boolean)
    .join('　·　');
  return `
  <div style="${st({ borderBottom: `2px solid ${C.primary}`, paddingBottom: '18px', marginBottom: '6px' })}">
    <div style="${st({ fontSize: '12px', letterSpacing: '.14em', color: C.primary, fontWeight: 700, marginBottom: '8px' })}">
      ${esc(PRODUCT_NAME)}
    </div>
    <div style="${st({ fontSize: '25px', fontWeight: 800, color: C.text, lineHeight: '1.35', marginBottom: '10px' })}">
      ${esc(o.title)}
    </div>
    ${meta ? `<div style="${st({ fontSize: '12.5px', color: C.text2 })}">${esc(meta)}</div>` : ''}
  </div>`;
}

function summaryBlock(r: ResolvedReport): string {
  if (!r.options.summary?.trim()) return '';
  return `${sectionTitle('总体说明')}
  <div style="${st({
    fontSize: '13px',
    lineHeight: '1.85',
    color: C.text2,
    background: C.head,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    padding: '13px 16px',
    whiteSpace: 'pre-wrap',
  })}">${esc(r.options.summary)}</div>`;
}

/** 概览表：一页看清「几项、每项多少钱」，飞书/微信里最常被单独转发的一块 */
function overviewTable(r: ResolvedReport): string {
  if (r.items.length < 2) return '';
  const rows = r.items
    .map((it, i) => {
      const v = `${it.output.main.value}${it.output.main.unit ? ' ' + it.output.main.unit : ''}`;
      const isAmt = /^[\d,]+\.\d{2}/.test(it.output.main.value);
      return `<tr>
        ${td(String(i + 1), { muted: true })}
        ${td(esc(it.title))}
        ${td(esc(v), { right: true, bold: isAmt, color: isAmt ? C.text : C.text2 })}
      </tr>`;
    })
    .join('');
  return `${sectionTitle('测算概览', `<span style="${st({ fontWeight: 400, fontSize: '11.5px', color: C.text3, marginLeft: '8px' })}">共 ${r.items.length} 项</span>`)}
  <table style="${st({ width: '100%', borderCollapse: 'collapse' })}">
    <thead><tr>${th('序号')}${th('项目名称')}${th('结果数值', true)}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function metaTable(it: ResolvedItem): string {
  const rows: [string, string][] = [];
  if (it.date) rows.push(['时间', it.date]);
  const fmt = (side: 'us' | 'opposite' | 'third') =>
    (it.parties ?? []).filter((p) => p.side === side).map((p) => `${p.name}${p.role ? `（${p.role}）` : ''}`);
  const us = fmt('us');
  const them = fmt('opposite');
  const third = fmt('third');
  if (us.length) rows.push(['我方', us.join('、')]);
  if (them.length) rows.push(['对方', them.join('、')]);
  if (third.length) rows.push(['第三方', third.join('、')]);
  if (it.owner) rows.push(['项目人', it.owner]);
  if (it.agent) rows.push(['代理人', it.agent]);
  if (!rows.length) return '';
  return `<table style="${st({ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' })}">
    <tbody>${rows
      .map(
        ([k, v]) =>
          `<tr>${td(esc(k), { muted: true })}${td(esc(v), { color: C.text2 })}</tr>`,
      )
      .join('')}</tbody>
  </table>`;
}

/** 大号结果块 —— 报告的主角，第一眼要看到 */
function heroBlock(label: string, value: string, unit: string | undefined, sub: string | undefined): string {
  return `<div style="${st({
    background: C.dangerSoft,
    border: `1px solid #fecdc9`,
    borderRadius: '10px',
    padding: '16px 18px',
    marginBottom: '4px',
  })}">
    <div style="${st({ fontSize: '12.5px', color: C.text2, marginBottom: '6px' })}">${esc(label)}</div>
    <div style="${st({ fontSize: '30px', fontWeight: 800, color: C.danger, lineHeight: '1.25', wordBreak: 'break-all' })}">
      ${esc(value)}${unit ? `<span style="${st({ fontSize: '14px', fontWeight: 600, marginLeft: '4px' })}">${esc(unit)}</span>` : ''}
    </div>
    ${sub ? `<div style="${st({ fontSize: '12.5px', color: C.text2, marginTop: '7px', lineHeight: '1.6' })}">${esc(sub)}</div>` : ''}
  </div>`;
}

function blocksGrid(it: ResolvedItem): string {
  const bs = it.output.blocks ?? [];
  if (!bs.length) return '';
  const cells = bs
    .map(
      (b) => `<div style="${st({
        flex: '1 1 46%',
        minWidth: '200px',
        border: `1px solid ${C.border}`,
        borderRadius: '8px',
        padding: '11px 13px',
      })}">
        <div style="${st({ fontSize: '11.5px', color: C.text3, marginBottom: '4px' })}">${esc(b.label)}</div>
        <div style="${st({ fontSize: '16px', fontWeight: 700, color: C.text })}">${esc(b.value)}${
          b.unit ? `<span style="${st({ fontSize: '11.5px', fontWeight: 500, color: C.text2, marginLeft: '3px' })}">${esc(b.unit)}</span>` : ''
        }</div>
        ${b.sub ? `<div style="${st({ fontSize: '11.5px', color: C.text2, marginTop: '4px' })}">${esc(b.sub)}</div>` : ''}
      </div>`,
    )
    .join('');
  return `<div style="${st({ display: 'flex', flexWrap: 'wrap', gap: '8px' })}">${cells}</div>`;
}

function stepsTable(it: ResolvedItem): string {
  if (!it.output.steps.length) return '';
  const rows = it.output.steps
    .map(
      (s) =>
        `<tr>${td(esc(s.label), { color: s.emphasis ? C.text : C.text2, bold: s.emphasis })}${td(
          esc(s.value) + (s.note ? `<span style="${st({ color: C.text3, marginLeft: '6px', fontSize: '11.5px' })}">${esc(s.note)}</span>` : ''),
          { right: true, bold: s.emphasis },
        )}</tr>`,
    )
    .join('');
  return `${sectionTitle('计算明细')}
  <table style="${st({ width: '100%', borderCollapse: 'collapse' })}"><tbody>${rows}</tbody></table>`;
}

function basisList(it: ResolvedItem): string {
  if (!it.output.basis.length) return '';
  const items = it.output.basis
    .map(
      (b) => `<div style="${st({
        background: C.head,
        borderLeft: `3px solid ${C.primary}`,
        padding: '9px 13px',
        marginBottom: '7px',
        fontSize: '12.5px',
        lineHeight: '1.7',
        color: C.text2,
      })}">
        <b style="${st({ color: C.primary })}">${esc(b.law)}${b.article ? ' ' + esc(b.article) : ''}</b>：${esc(b.text)}
      </div>`,
    )
    .join('');
  return `${sectionTitle('法律依据')}${items}`;
}

function tipsList(it: ResolvedItem): string {
  const tips = it.output.tips ?? [];
  if (!tips.length) return '';
  return `${sectionTitle('实务提示')}
  <ul style="${st({ margin: '0', paddingLeft: '20px', fontSize: '12.5px', lineHeight: '1.85', color: C.text2 })}">
    ${tips.map((t) => `<li style="margin-bottom:4px">${esc(t)}</li>`).join('')}
  </ul>`;
}

/** 多方案比对：对比表 + 各方案明细 */
function comparisonBlock(it: ResolvedItem, includeSteps: boolean): string {
  const c = it.comparison!;
  const head = `<tr>${th('对比项')}${c.options.map((o) => th(o.name, true)).join('')}</tr>`;
  const mainRow = `<tr>${td(esc(c.options[0]?.mainLabel ?? '结果'), { bold: true })}${c.options
    .map((o) => {
      const best = c.comparable && !c.uniform && o.amount !== null && o.amount === c.min;
      return td(`${esc(o.mainValue)}${o.mainUnit ? ' ' + esc(o.mainUnit) : ''}${best ? ' <span style="color:' + C.success + ';font-weight:700">最低</span>' : ''}`, {
        right: true,
        bold: true,
        color: best ? C.success : C.text,
      });
    })
    .join('')}</tr>`;
  const diffRow =
    c.comparable && !c.uniform
      ? `<tr>${td('与最低方案差额')}${c.options
          .map((o) =>
            td(o.amount === null ? '—' : o.amount === c.min ? '基准' : `+${money(o.amount - (c.min ?? 0))}`, { right: true, color: C.text2 }),
          )
          .join('')}</tr>`
      : '';
  const paramRows = it.def.fields
    .filter((f) => !isSharedField(it.def, f.key))
    .filter(
      (f) =>
        // 任一方案里该字段可见 → 值得列；所有方案都不带可见条件 → 一律列
        c.options.some((o) => f.visibleWhen?.(o.values)) || c.options.every(() => !f.visibleWhen),
    )
    .map((f) => {
      const vals = c.options.map((o) => o.values[f.key]);
      const show = (v: unknown): string => {
        if (f.type === 'switch') return v === true || v === 'true' ? '是' : '否';
        if (f.type === 'select') return f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v ?? '');
        return `${String(v ?? '')}${f.unit ? ' ' + f.unit : ''}`;
      };
      const same = new Set(vals.map((v) => String(v ?? ''))).size === 1;
      return `<tr>${td(esc(f.label), { muted: same })}${vals.map((v) => td(esc(show(v)), { right: true, muted: same })).join('')}</tr>`;
    })
    .join('');

  const detail =
    includeSteps && c.options.some((o) => o.steps.length)
      ? c.options
          .filter((o) => o.steps.length)
          .map(
            (o) => `${sectionTitle(`${o.name} 计算明细`)}
            <table style="${st({ width: '100%', borderCollapse: 'collapse' })}"><tbody>${o.steps
              .map((s) => `<tr>${td(esc(s.label), { color: C.text2 })}${td(esc(s.value), { right: true })}</tr>`)
              .join('')}</tbody></table>`,
          )
          .join('')
      : '';

  const note = c.comparable && !c.uniform
    ? `<div style="${st({ fontSize: '12.5px', color: C.text2, marginTop: '8px' })}">
        最大差额 <b style="${st({ color: C.danger })}">${money((c.max ?? 0) - (c.min ?? 0))}</b> 元，
        最低方案为「${esc(c.options.find((o) => o.amount === c.min)?.name ?? '')}」。
      </div>`
    : '';

  return `${sectionTitle('方案对比')}
  <table style="${st({ width: '100%', borderCollapse: 'collapse' })}"><thead>${head}</thead><tbody>${mainRow}${diffRow}${paramRows}</tbody></table>
  ${note}${detail}`;
}

function itemBlock(it: ResolvedItem, idx: number, opt: { includeParams: boolean; includeSteps: boolean; includeBasis: boolean; includeTips: boolean }): string {
  const parts: string[] = [];
  parts.push(`<div style="${st({ marginTop: idx === 0 ? '26px' : '34px', pageBreakInside: 'avoid' })}">
    <div style="${st({ fontSize: '17px', fontWeight: 800, color: C.text, lineHeight: '1.4' })}">${idx + 1}. ${esc(it.title)}</div>
    <div style="${st({ fontSize: '12px', color: C.text3, marginTop: '5px', lineHeight: '1.6' })}">${esc(it.def.summary)}</div>
    <div style="${st({ height: '1px', background: C.border, margin: '12px 0 14px' })}"></div>`);

  if (opt.includeParams) parts.push(metaTable(it));
  if (!it.comparison) {
    parts.push(heroBlock(it.output.main.label, it.output.main.value, it.output.main.unit, it.output.main.sub));
    parts.push(blocksGrid(it));
    if (opt.includeSteps) parts.push(stepsTable(it));
  } else {
    parts.push(comparisonBlock(it, opt.includeSteps));
  }
  if (opt.includeBasis) parts.push(basisList(it));
  if (opt.includeTips) parts.push(tipsList(it));
  if (it.note) {
    parts.push(`${sectionTitle('结论备注')}<div style="${st({ fontSize: '12.5px', lineHeight: '1.8', color: C.text2, whiteSpace: 'pre-wrap' })}">${esc(it.note)}</div>`);
  }
  parts.push('</div>');
  return parts.join('');
}

/* ───────────────────────── 对外接口 ───────────────────────── */

/**
 * 生成供栅格化用的**自包含 HTML**（内联样式、无外部资源）。
 * `composePng()` 用它出图；出错时也可以直接把这段 HTML 存成文件给人看。
 */
export function reportToPngHtml(r: ResolvedReport): string {
  const o = r.options;
  const body = r.items
    .map((it, i) =>
      itemBlock(it, i, {
        includeParams: o.includeParams,
        includeSteps: o.includeSteps,
        includeBasis: o.includeBasis,
        includeTips: o.includeTips,
      }),
    )
    .join('');

  const foot = `<div style="${st({
    marginTop: '34px',
    paddingTop: '14px',
    borderTop: `1px solid ${C.border}`,
    fontSize: '11.5px',
    lineHeight: '1.8',
    color: C.text3,
  })}">
    <div>本报告由${esc(PRODUCT_NAME)}生成，仅供参考，不构成法律意见。个案请结合当地最新规定、司法实践口径与专业判断。</div>
    <div style="margin-top:4px">导出时间：${esc(new Date().toLocaleString('zh-CN', { hour12: false }))}</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(o.title)}</title></head>
<body style="${st({ margin: '0', padding: '0', background: '#ffffff' })}">
  <div id="report-root" style="${st({
    width: `${PNG_WIDTH}px`,
    padding: `${PAD}px`,
    background: '#ffffff',
    color: C.text,
    fontFamily: FONT,
    fontSize: '13px',
    lineHeight: '1.6',
    boxSizing: 'border-box',
  })}">
    ${coverHead(r)}
    ${summaryBlock(r)}
    ${overviewTable(r)}
    ${body}
    ${foot}
  </div>
</body></html>`;
}

/**
 * 把自包含 HTML 栅格化为 PNG。
 *
 * 做法：把 #report-root 连同其**计算后样式**一起搬进 `<svg><foreignObject>`，
 * 转成 SVG 图片后画到 canvas，再 toDataURL('image/png')。
 *
 * 关键点（踩过才知道）：
 * - SVG 作为图片加载时读不到外部 CSS，所以必须把每个节点的 computedStyle 内联进去；
 * - 中文换行依赖字体，`font-family` 要显式带上系统中文族，否则可能整段不换行；
 * - canvas 超过浏览器上限（Chrome 约 16384px 单边、约 1.1 亿像素）会被静默截断，
 *   故按像素总量自动降倍率，并在返回值里如实报告实际倍率与是否降级。
 */
export async function composePng(
  html: string,
  opts: { scale?: number; width?: number } = {},
): Promise<{ dataUrl: string; width: number; height: number; scale: number; downscaled: boolean }> {
  const width = opts.width ?? PNG_WIDTH;
  let scale = opts.scale ?? PNG_SCALE;

  /* 用离屏 iframe 渲染：不污染当前文档、不受页面 CSS 影响（报告样式完全内联） */
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:1200px;border:0;opacity:0;`;
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('无法创建渲染容器（iframe 不可用）');
    doc.open();
    doc.write(html);
    doc.close();
    /* 等字体就绪，否则首屏文字可能以回退字体排版、宽度与最终不一致 */
    await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready.catch(() => undefined);

    const root = doc.getElementById('report-root');
    if (!root) throw new Error('报告根节点缺失，版面生成失败');
    const height = Math.ceil(root.getBoundingClientRect().height);
    if (!height || height < 40) throw new Error('报告高度异常，版面生成失败');

    /* 画布像素总量兜底：宁可降低清晰度，也不能出一张被截断的图 */
    const MAX_SIDE = 16000;
    const MAX_PIXELS = 100_000_000;
    let downscaled = false;
    if (height * scale > MAX_SIDE) {
      scale = Math.max(1, Math.floor((MAX_SIDE / height) * 10) / 10);
      downscaled = true;
    }
    if (width * scale * height * scale > MAX_PIXELS) {
      scale = Math.max(1, Math.floor(Math.sqrt(MAX_PIXELS / (width * height)) * 10) / 10);
      downscaled = true;
    }

    /* ── 把 DOM 连同计算后样式序列化进 foreignObject ── */
    const INLINE_PROPS = [
      'display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'max-width',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
      'border-radius', 'border-collapse', 'border-spacing', 'border-left-width', 'border-left-style', 'border-left-color',
      'background', 'background-color', 'color', 'font', 'font-family', 'font-size',
      'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align',
      'text-decoration', 'vertical-align', 'white-space', 'word-break', 'overflow-wrap',
      'list-style', 'list-style-type', 'padding-inline-start', 'flex', 'flex-wrap',
      'flex-direction', 'flex-basis', 'flex-grow', 'flex-shrink', 'gap', 'align-items',
      'justify-content', 'float', 'opacity',
    ];

    const walk = (src: Element, dst: Element, win: Window): void => {
      const cs = win.getComputedStyle(src);
      let cssText = '';
      for (const p of INLINE_PROPS) {
        const v = cs.getPropertyValue(p);
        if (v && v !== 'none' && v !== 'normal' && v !== 'auto') cssText += `${p}:${v};`;
      }
      dst.setAttribute('style', cssText);
      for (let i = 0; i < src.children.length; i++) {
        const sc = src.children[i];
        const dc = doc.createElement(sc.tagName.toLowerCase());
        walk(sc, dc, win);
        if (sc.children.length === 0) dc.textContent = sc.textContent;
        dst.appendChild(dc);
      }
      /* 文本节点单独拷贝（元素自身既有文字又有子元素时，文字会丢——报告里没有这种结构，
         但保底处理：若源无子元素则上面已拷；有子元素则补一次前导文本） */
      if (src.children.length > 0 && src.firstChild?.nodeType === Node.TEXT_NODE) {
        const t = (src.firstChild as Text).textContent ?? '';
        if (t.trim()) dst.insertBefore(doc.createTextNode(t), dst.firstChild);
      }
    };

    /* 关键：字体必须显式写进根节点，否则 SVG 渲染时回退到默认衬线字体 */
    const cloned = doc.createElement('div');
    walk(root, cloned, frame.contentWindow as Window);
    cloned.setAttribute(
      'style',
      `${cloned.getAttribute('style') ?? ''}font-family:${FONT};`,
    );
    cloned.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');

    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject x="0" y="0" width="${width}" height="${height}">${cloned.outerHTML}</foreignObject></svg>`;

    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image();
    img.decoding = 'sync';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('位图渲染失败：浏览器拒绝加载 SVG（可能不支持 foreignObject）'));
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画布不可用（2D context 获取失败）');
    /* 白底：透明底图发到微信／贴进文档会变成黑底或灰底 */
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl.startsWith('data:image/png')) throw new Error('PNG 编码失败');
    return { dataUrl, width: canvas.width, height: canvas.height, scale, downscaled };
  } finally {
    frame.remove();
  }
}

/** dataURL → Blob（浏览器端下载用；比 a[href] 直接挂 dataURL 更省内存） */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
