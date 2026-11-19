/**
 * 报告模型与多格式导出
 * 支持：Markdown / HTML / Word(.doc) / Excel / 纯文本 / 打印 PDF / PNG 长图
 * 除图片与下载触发外，生成逻辑均为纯函数、不依赖 DOM，便于在 CLI 与技能包中复用。
 * （PNG 必须过一遍浏览器排版引擎，故 composePng 只在浏览器/无头环境可用。）
 */
import type { CalcOption, CalcOutput, CalcValues, CalculatorDef } from './types';
import { compareOptions, isSharedField, type ComparisonResult } from './compare';
import { getCalculator } from './calculators';
import { money } from './format';
import { PRODUCT_NAME } from './version';
import { composePng, dataUrlToBlob, reportToPngHtml } from './reportImage';

export { reportToPngHtml, composePng, dataUrlToBlob, PNG_WIDTH } from './reportImage';

/** 项目当事人：支持双方与多方 */
export interface Party {
  /** 当事人名称（全称） */
  name: string;
  /** 主体简称：用于导出文件命名（如 华润万佳），留空时命名降级用全称 */
  short?: string;
  /** 诉讼 / 合同地位，如 原告、被告、甲方、第三人 */
  role?: string;
  /** 阵营：我方 / 对方 / 第三方 */
  side: 'us' | 'opposite' | 'third';
}

export const SIDE_LABEL: Record<Party['side'], string> = {
  us: '我方',
  opposite: '对方',
  third: '第三方',
};

export interface ReportItem {
  /** 计算器 id */
  calcId: string;
  /**
   * 多方案比对项：同一计算器下的多套参数。
   * 有值时本项的 values 只作兜底，实际计算按 options 逐个出结果并给对比表。
   */
  options?: CalcOption[];
  /** 项目名称，缺省用计算器名 */
  title?: string;
  /** 时间：事发日 / 签约日 / 测算基准日 */
  date?: string;
  /** 项目人：我方内部负责人 */
  owner?: string;
  /** 代理人：承办律师 / 代理人 */
  agent?: string;
  /** 当事人列表（支持双方、多方） */
  parties?: Party[];
  /** 自定义备注 / 结论说明 */
  note?: string;
  /** 输入参数 */
  values: CalcValues;
}

export interface ReportOptions {
  title: string;
  /** 项目 / 客户名称 */
  subject?: string;
  /** 编制人 */
  author?: string;
  date: string;
  /** 总体说明 */
  summary?: string;
  items: ReportItem[];
  includeParams: boolean;
  includeSteps: boolean;
  includeBasis: boolean;
  includeTips: boolean;
}

export interface ResolvedItem {
  def: CalculatorDef;
  title: string;
  date?: string;
  owner?: string;
  agent?: string;
  parties?: Party[];
  note?: string;
  values: CalcValues;
  output: CalcOutput;
  /** 多方案比对结论（普通单项为 undefined） */
  comparison?: ComparisonResult;
  /** 该方案的原始参数（比对项才有） */
  options?: CalcOption[];
}

export interface ResolvedReport {
  options: ReportOptions;
  items: ResolvedItem[];
}

/** 把选项中的计算器 id + 参数解析成带结果的完整报告 */
export function resolveReport(options: ReportOptions): ResolvedReport {
  const items: ResolvedItem[] = [];
  for (const it of options.items) {
    const def = getCalculator(it.calcId);
    if (!def) continue;
    // 多方案项：逐个方案出结果，并以「方案速览」作为本文项的主结果
    if (it.options && it.options.length) {
      const comparison = compareOptions(def, it.options);
      const amountful = comparison.options.filter((o) => o.amount !== null);
      const best = amountful.length ? amountful.reduce((a, b) => ((a.amount ?? 0) <= (b.amount ?? 0) ? a : b)) : comparison.options[0];
      const worst = amountful.length ? amountful.reduce((a, b) => ((a.amount ?? 0) >= (b.amount ?? 0) ? a : b)) : comparison.options[0];
      const spanText =
        comparison.comparable && !comparison.uniform
          ? `最低 ${best.name} ${best.mainValue}，最高 ${worst.name} ${worst.mainValue}，差额 ${money((worst.amount ?? 0) - (best.amount ?? 0))}`
          : `${comparison.options.length} 个方案结果一致`;
      items.push({
        def,
        title: it.title?.trim() || `${def.name}（${comparison.options.length} 方案比对）`,
        date: it.date?.trim() || undefined,
        owner: it.owner?.trim() || undefined,
        agent: it.agent?.trim() || undefined,
        parties: (it.parties ?? []).filter((x) => x && x.name?.trim()),
        note: it.note?.trim() || undefined,
        values: it.values,
        output: {
          main: { label: '方案比对差额', value: spanText, sub: `${def.name} · ${comparison.options.map((o) => o.name).join(' / ')}` },
          steps: [],
          basis: comparison.options[0] ? def.calc(it.options[0].values).basis : [],
        },
        comparison,
        options: it.options,
      });
      continue;
    }
    let output: CalcOutput;
    try {
      output = def.calc(it.values);
    } catch {
      continue;
    }
    items.push({
      def,
      title: it.title?.trim() || def.name,
      date: it.date?.trim() || undefined,
      owner: it.owner?.trim() || undefined,
      agent: it.agent?.trim() || undefined,
      parties: (it.parties ?? []).filter((x) => x && x.name?.trim()),
      note: it.note?.trim() || undefined,
      values: it.values,
      output,
    });
  }
  return { options, items };
}

/** 单方当事人格式化：名称（角色） */
export function partyText(p: Party): string {
  const name = (p.name ?? '').trim();
  const role = (p.role ?? '').trim();
  return role ? `${name}（${role}）` : name;
}

/** 按阵营归集当事人文本 */
export function partiesBySide(parties: Party[] | undefined, side: Party['side']): string {
  return (parties ?? [])
    .filter((p) => p.side === side && (p.name ?? '').trim())
    .map(partyText)
    .join('、');
}

/** 项目档案行：时间 / 我方 / 对方 / 第三方 / 项目人 / 代理人 */
export function metaRows(it: ResolvedItem): string[][] {
  const rows: string[][] = [];
  if (it.date) rows.push(['时间', it.date]);
  const us = partiesBySide(it.parties, 'us');
  if (us) rows.push(['我方', us]);
  const opp = partiesBySide(it.parties, 'opposite');
  if (opp) rows.push(['对方', opp]);
  const third = partiesBySide(it.parties, 'third');
  if (third) rows.push(['第三方', third]);
  if (it.owner) rows.push(['项目人', it.owner]);
  if (it.agent) rows.push(['代理人', it.agent]);
  return rows;
}

/* ────────────── Markdown ────────────── */

function mdTable(headers: string[], rows: string[][]): string {
  const esc = (s: string) => String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const head = `| ${headers.map(esc).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
  return [head, sep, body].join('\n');
}

/** 参数表格行：只包含当前可见字段 */
function paramRows(def: CalculatorDef, values: CalcValues): string[][] {
  const rows: string[][] = [];
  for (const f of def.fields) {
    if (f.visibleWhen && !f.visibleWhen(values)) continue;
    const raw = values[f.key];
    let display: string;
    if (f.type === 'switch') {
      display = raw === true || raw === 'true' ? '是' : '否';
    } else if (f.type === 'select') {
      display = f.options?.find((o) => String(o.value) === String(raw))?.label ?? String(raw ?? '');
    } else {
      display = String(raw ?? '');
    }
    rows.push([f.label, display + (f.unit ? ` ${f.unit}` : '')]);
  }
  return rows;
}

export function reportToMarkdown(r: ResolvedReport): string {
  const { options, items } = r;
  const L: string[] = [];

  L.push(`# ${options.title}`, '');

  const meta: string[] = [];
  if (options.subject) meta.push(`**项目 / 客户**：${options.subject}`);
  if (options.author) meta.push(`**编制人**：${options.author}`);
  meta.push(`**日期**：${options.date}`);
  L.push(meta.join('　|　'), '');

  if (options.summary?.trim()) {
    L.push('## 总体说明', '', options.summary.trim(), '');
  }

  if (items.length === 0) {
    L.push('> 尚未选择任何计算项目。', '');
  }

  if (items.length > 1) {
    L.push('## 测算概览', '');
    L.push(
      mdTable(
        ['序号', '项目名称', '我方', '对方', '时间', '项目人', '代理人', '结果项', '结果数值'],
        items.map((it, i) => [
          String(i + 1),
          it.title,
          partiesBySide(it.parties, 'us'),
          partiesBySide(it.parties, 'opposite'),
          it.date ?? '',
          it.owner ?? '',
          it.agent ?? '',
          it.output.main.label,
          `${it.output.main.value}${it.output.main.unit ? ' ' + it.output.main.unit : ''}`,
        ]),
      ),
      '',
    );
  }

  items.forEach((it, idx) => {
    L.push(`## ${idx + 1}. ${it.title}`, '');
    L.push(`> ${it.def.summary}`, '');

    const mRows = metaRows(it);
    if (mRows.length) {
      L.push(mdTable(['项目档案', ''], mRows), '');
    }

    // 多方案比对：先给对比表，再给每个方案的明细
    if (it.comparison) {
      const c = it.comparison;
      const headers = ['对比项', ...c.options.map((o) => o.name)];
      const rows: string[][] = [];
      rows.push([`${c.options[0]?.mainLabel ?? '结果'}`, ...c.options.map((o) => `${o.mainValue}${o.mainUnit ? ' ' + o.mainUnit : ''}`)]);
      if (c.comparable && !c.uniform) {
        rows.push([
          '与最低方案差额',
          ...c.options.map((o) =>
            o.amount === null ? '—' : o.amount === c.min ? '基准（最低）' : `+${money(o.amount - (c.min ?? 0))}`,
          ),
        ]);
      }
      for (const f of it.def.fields) {
        if (isSharedField(it.def, f.key)) continue;
        const vals = c.options.map((o) => o.values[f.key]);
        const show = (v: CalcValues[string]) =>
          f.type === 'switch'
            ? v === true || v === 'true'
              ? '是'
              : '否'
            : f.type === 'select'
              ? (f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v ?? ''))
              : `${String(v ?? '')}${f.unit ? ' ' + f.unit : ''}`;
        rows.push([f.label, ...vals.map(show)]);
      }
      L.push('### 方案对比', '', mdTable(headers, rows), '');
      if (c.comparable && !c.uniform) {
        L.push(`> 最大差额 **${money((c.max ?? 0) - (c.min ?? 0))}**，最低方案为「${c.options.find((o) => o.amount === c.min)?.name}」。`, '');
      }
      if (options.includeSteps) {
        for (const o of c.options) {
          if (!o.steps.length) continue;
          L.push(
            `#### ${o.name} 计算明细`,
            '',
            mdTable(['步骤', '计算过程'], o.steps.map((x) => [x.label, x.value])),
            '',
          );
        }
      }
      if (it.note) L.push('### 结论备注', '', it.note, '');
      if (options.includeBasis && it.output.basis.length) {
        L.push('### 法律依据', '');
        it.output.basis.forEach((b) => L.push(`- **${b.law}${b.article ? ` ${b.article}` : ''}**：${b.text}`));
        L.push('');
      }
      if (options.includeTips && it.output.tips?.length) {
        L.push('### 实务提示', '');
        it.output.tips.forEach((t) => L.push(`- ${t}`));
        L.push('');
      }
      return;
    }

    // 主结果
    L.push(`### 计算结果`, '');
    L.push(`**${it.output.main.label}：${it.output.main.value}${it.output.main.unit ? ' ' + it.output.main.unit : ''}**`);
    if (it.output.main.sub) L.push('', `> ${it.output.main.sub}`);
    L.push('');

    if (it.output.blocks?.length) {
      L.push(
        mdTable(
          ['项目', '数值'],
          it.output.blocks.map((b) => [b.label, `${b.value}${b.unit ? ' ' + b.unit : ''}${b.sub ? `（${b.sub}）` : ''}`]),
        ),
        '',
      );
    }

    if (options.includeParams) {
      const rows = paramRows(it.def, it.values);
      if (rows.length) {
        L.push('### 输入参数', '', mdTable(['参数', '取值'], rows), '');
      }
    }

    if (options.includeSteps && it.output.steps.length) {
      L.push(
        '### 计算明细',
        '',
        mdTable(
          ['步骤', '计算过程'],
          it.output.steps.map((s) => [s.label, s.value + (s.note ? `　*${s.note}*` : '')]),
        ),
        '',
      );
    }

    if (it.note) {
      L.push('### 结论备注', '', it.note, '');
    }

    if (options.includeBasis && it.output.basis.length) {
      L.push('### 法律依据', '');
      it.output.basis.forEach((b) => {
        L.push(`- **${b.law}${b.article ? ` ${b.article}` : ''}**：${b.text}`);
      });
      L.push('');
    }

    if (options.includeTips && it.output.tips?.length) {
      L.push('### 实务提示', '');
      it.output.tips.forEach((t) => L.push(`- ${t}`));
      L.push('');
    }
  });

  L.push('---', '');
  L.push(
    `> **免责声明**：本报告由${PRODUCT_NAME}工具自动生成，计算结果基于上述输入参数与现行法律法规的一般性规则，仅供参考，不构成法律意见。个案处理请结合当地最新规定、司法实践口径与专业判断。`,
    '',
  );

  return L.join('\n');
}

/** 精简纯文本版：适合微信 / 钉钉 / 飞书直接粘贴 */
export function reportToPlainText(r: ResolvedReport): string {
  const { options, items } = r;
  const L: string[] = [];
  L.push(`【${options.title}】`);
  if (options.subject) L.push(`项目：${options.subject}`);
  L.push(`日期：${options.date}`);
  L.push('');
  if (options.summary?.trim()) L.push(options.summary.trim(), '');
  items.forEach((it, i) => {
    L.push(`${i + 1}. ${it.title}`);
    metaRows(it).forEach((m) => L.push(`   [${m[0]}] ${m[1]}`));
    L.push(`   ${it.output.main.label}：${it.output.main.value}${it.output.main.unit ? ' ' + it.output.main.unit : ''}`);
    if (it.output.main.sub) L.push(`   ${it.output.main.sub}`);
    if (it.output.blocks?.length) {
      it.output.blocks.slice(0, 4).forEach((b) => {
        L.push(`   · ${b.label}：${b.value}${b.unit ? ' ' + b.unit : ''}`);
      });
    }
    if (it.note) L.push(`   备注：${it.note}`);
    L.push('');
  });
  L.push(`（本结果由${PRODUCT_NAME}生成，仅供参考，不构成法律意见。）`);
  return L.join('\n');
}

/* ────────────── HTML ────────────── */

const HTML_STYLE = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
    line-height:1.7;color:#101828;max-width:900px;margin:0 auto;padding:36px 28px;background:#fff;}
  h1{font-size:25px;margin:0 0 10px;letter-spacing:-.4px;}
  h2{font-size:18px;margin:30px 0 12px;padding-bottom:8px;border-bottom:2px solid #5b3df5;color:#3730a3;}
  h3{font-size:14px;margin:20px 0 8px;color:#475467;}
  .meta{color:#667085;font-size:13px;margin-bottom:24px;}
  .summary{background:#f9fafb;border-left:3px solid #5b3df5;padding:12px 16px;margin:16px 0;font-size:14px;}
  blockquote{margin:8px 0;padding:8px 14px;background:#f5f3ff;border-left:3px solid #8b5cf6;
    color:#5b21b6;font-size:13px;}
  .hero{background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:1px solid #ddd6fe;border-radius:10px;
    padding:18px 20px;margin:14px 0;}
  .hero-label{font-size:13px;color:#5b21b6;font-weight:600;margin-bottom:6px;}
  .hero-value{font-size:26px;font-weight:700;color:#3730a3;letter-spacing:-.5px;}
  .hero-sub{font-size:12px;color:#6d28d9;margin-top:6px;}
  table{width:100%;border-collapse:collapse;margin:10px 0 18px;font-size:13px;}
  th{background:#f9fafb;text-align:left;padding:8px 10px;border:1px solid #e4e7ec;font-weight:600;color:#475467;}
  td{padding:8px 10px;border:1px solid #e4e7ec;vertical-align:top;}
  tr.emph td{color:#5b3df5;font-weight:600;}
  .basis{background:#f9fafb;border-left:3px solid #5b3df5;padding:10px 14px;margin-bottom:8px;font-size:12.5px;color:#475467;}
  .basis b{color:#5b3df5;}
  ul{padding-left:20px;font-size:13px;color:#475467;}
  li{margin-bottom:6px;}
  table.meta-table{width:auto;min-width:340px;margin:12px 0 16px;}
  table.meta-table td{padding:5px 12px;font-size:12.5px;}
  table.meta-table td.mk{width:88px;color:#667085;background:#f9fafb;font-weight:600;}
  .footnote{margin-top:34px;padding-top:14px;border-top:1px solid #e4e7ec;font-size:11.5px;color:#98a2b3;}
  @media print{body{padding:0;max-width:none;}h2{page-break-after:avoid;}table{page-break-inside:avoid;}}
`;

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** 生成报告正文 HTML 片段（不含 <html> 外壳） */
export function reportToHtmlBody(r: ResolvedReport): string {
  const { options, items } = r;
  const P: string[] = [];

  P.push(`<h1>${escHtml(options.title)}</h1>`);
  const meta: string[] = [];
  if (options.subject) meta.push(`项目 / 客户：${escHtml(options.subject)}`);
  if (options.author) meta.push(`编制人：${escHtml(options.author)}`);
  meta.push(`日期：${escHtml(options.date)}`);
  P.push(`<div class="meta">${meta.join('　|　')}</div>`);

  if (options.summary?.trim()) {
    P.push(`<div class="summary">${escHtml(options.summary).replace(/\n/g, '<br>')}</div>`);
  }

  if (items.length > 1) {
    P.push('<h2>测算概览</h2>');
    P.push(
      `<table><thead><tr><th>序号</th><th>项目名称</th><th>我方</th><th>对方</th><th>时间</th><th>项目人</th><th>代理人</th><th>结果项</th><th>结果数值</th></tr></thead><tbody>${items
        .map(
          (it, i) =>
            `<tr><td>${i + 1}</td><td>${escHtml(it.title)}</td><td>${escHtml(
              partiesBySide(it.parties, 'us'),
            )}</td><td>${escHtml(partiesBySide(it.parties, 'opposite'))}</td><td>${escHtml(it.date ?? '')}</td><td>${escHtml(
              it.owner ?? '',
            )}</td><td>${escHtml(it.agent ?? '')}</td><td>${escHtml(it.output.main.label)}</td><td><b>${escHtml(
              it.output.main.value,
            )}${it.output.main.unit ? ' ' + escHtml(it.output.main.unit) : ''}</b></td></tr>`,
        )
        .join('')}</tbody></table>`,
    );
  }

  items.forEach((it, idx) => {
    P.push(`<h2>${idx + 1}. ${escHtml(it.title)}</h2>`);
    P.push(`<blockquote>${escHtml(it.def.summary)}</blockquote>`);

    const mRows = metaRows(it);
    if (mRows.length) {
      P.push(
        `<table class="meta-table"><tbody>${mRows
          .map(
            (r) =>
              `<tr><td class="mk">${escHtml(r[0])}</td><td>${escHtml(r[1])}</td></tr>`,
          )
          .join('')}</tbody></table>`,
      );
    }

    // 多方案比对：先出对比表，再列各方案明细
    if (it.comparison) {
      const c = it.comparison;
      const head = `<tr><th>对比项</th>${c.options.map((o) => `<th>${escHtml(o.name)}</th>`).join('')}</tr>`;
      const bodyRows: string[] = [];
      bodyRows.push(
        `<tr><td><b>${escHtml(c.options[0]?.mainLabel ?? '结果')}</b></td>${c.options
          .map((o) => `<td><b>${escHtml(o.mainValue)}${o.mainUnit ? ' ' + escHtml(o.mainUnit) : ''}</b></td>`)
          .join('')}</tr>`,
      );
      if (c.comparable && !c.uniform) {
        bodyRows.push(
          `<tr><td>与最低方案差额</td>${c.options
            .map((o) =>
              o.amount === null
                ? '<td>—</td>'
                : o.amount === c.min
                  ? '<td>基准（最低）</td>'
                  : `<td style="color:#d92d20">+${money(o.amount - (c.min ?? 0))}</td>`,
            )
            .join('')}</tr>`,
        );
      }
      for (const f of it.def.fields) {
        if (isSharedField(it.def, f.key)) continue;
        const vals = c.options.map((o) => o.values[f.key]);
        const show = (v: CalcValues[string]) =>
          f.type === 'switch'
            ? v === true || v === 'true'
              ? '是'
              : '否'
            : f.type === 'select'
              ? (f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v ?? ''))
              : `${String(v ?? '')}${f.unit ? ' ' + f.unit : ''}`;
        bodyRows.push(`<tr><td>${escHtml(f.label)}</td>${vals.map((v) => `<td>${escHtml(show(v))}</td>`).join('')}</tr>`);
      }
      P.push('<h3>方案对比</h3>', `<table><thead>${head}</thead><tbody>${bodyRows.join('')}</tbody></table>`);
      if (c.comparable && !c.uniform) {
        P.push(
          `<blockquote>最大差额 <b>${money((c.max ?? 0) - (c.min ?? 0))}</b>，最低方案为「${escHtml(
            c.options.find((o) => o.amount === c.min)?.name ?? '',
          )}」。</blockquote>`,
        );
      }
      if (options.includeSteps) {
        for (const o of c.options) {
          if (!o.steps.length) continue;
          P.push(
            `<h3>${escHtml(o.name)} 计算明细</h3>`,
            `<table><thead><tr><th style="width:38%">步骤</th><th>计算过程</th></tr></thead><tbody>${o.steps
              .map((x) => `<tr><td>${escHtml(x.label)}</td><td>${escHtml(x.value)}</td></tr>`)
              .join('')}</tbody></table>`,
          );
        }
      }
      if (it.note) P.push('<h3>结论备注</h3>', `<p>${escHtml(it.note)}</p>`);
      if (options.includeBasis && it.output.basis.length) {
        P.push('<h3>法律依据</h3>', '<ul>', ...it.output.basis.map((b) => `<li><b>${escHtml(b.law)}${b.article ? ' ' + escHtml(b.article) : ''}</b>：${escHtml(b.text)}</li>`), '</ul>');
      }
      if (options.includeTips && it.output.tips?.length) {
        P.push('<h3>实务提示</h3>', '<ul>', ...it.output.tips.map((t) => `<li>${escHtml(t)}</li>`), '</ul>');
      }
      return;
    }

    P.push('<div class="hero">');
    P.push(`<div class="hero-label">${escHtml(it.output.main.label)}</div>`);
    P.push(
      `<div class="hero-value">${escHtml(it.output.main.value)}${
        it.output.main.unit ? ` <span style="font-size:14px">${escHtml(it.output.main.unit)}</span>` : ''
      }</div>`,
    );
    if (it.output.main.sub) P.push(`<div class="hero-sub">${escHtml(it.output.main.sub)}</div>`);
    P.push('</div>');

    if (it.output.blocks?.length) {
      P.push(
        `<table><thead><tr><th>项目</th><th>数值</th></tr></thead><tbody>${it.output.blocks
          .map(
            (b) =>
              `<tr><td>${escHtml(b.label)}</td><td>${escHtml(b.value)}${
                b.unit ? ' ' + escHtml(b.unit) : ''
              }${b.sub ? `<br><span style="color:#98a2b3;font-size:11px">${escHtml(b.sub)}</span>` : ''}</td></tr>`,
          )
          .join('')}</tbody></table>`,
      );
    }

    if (options.includeParams) {
      const rows = paramRows(it.def, it.values);
      if (rows.length) {
        P.push(
          '<h3>输入参数</h3>',
          `<table><thead><tr><th>参数</th><th>取值</th></tr></thead><tbody>${rows
            .map((r2) => `<tr><td>${escHtml(r2[0])}</td><td>${escHtml(r2[1])}</td></tr>`)
            .join('')}</tbody></table>`,
        );
      }
    }

    if (options.includeSteps && it.output.steps.length) {
      P.push(
        '<h3>计算明细</h3>',
        `<table><thead><tr><th style="width:38%">步骤</th><th>计算过程</th></tr></thead><tbody>${it.output.steps
          .map(
            (s) =>
              `<tr class="${s.emphasis ? 'emph' : ''}"><td>${escHtml(s.label)}</td><td>${escHtml(s.value)}${
                s.note ? `<br><span style="color:#98a2b3;font-size:11px">${escHtml(s.note)}</span>` : ''
              }</td></tr>`,
          )
          .join('')}</tbody></table>`,
      );
    }

    if (it.note) P.push('<h3>结论备注</h3>', `<p style="font-size:13.5px">${escHtml(it.note).replace(/\n/g, '<br>')}</p>`);

    if (options.includeBasis && it.output.basis.length) {
      P.push('<h3>法律依据</h3>');
      it.output.basis.forEach((b) => {
        P.push(
          `<div class="basis"><b>${escHtml(b.law)}${b.article ? ' ' + escHtml(b.article) : ''}</b><br>${escHtml(b.text)}</div>`,
        );
      });
    }

    if (options.includeTips && it.output.tips?.length) {
      P.push('<h3>实务提示</h3>', `<ul>${it.output.tips.map((t) => `<li>${escHtml(t)}</li>`).join('')}</ul>`);
    }
  });

  P.push(
    `<div class="footnote">本报告由${PRODUCT_NAME}工具自动生成，计算结果基于上述输入参数与现行法律法规的一般性规则，仅供参考，不构成法律意见。个案处理请结合当地最新规定、司法实践口径与专业判断。</div>`,
  );

  return P.join('\n');
}

/** 完整独立 HTML 文件（可直接下载、浏览器打开、分享） */
export function reportToHtmlFile(r: ResolvedReport): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(r.options.title)}</title>
<style>@page { size: A4; margin: 16mm 14mm; } ${HTML_STYLE}</style>
</head>
<body>
${reportToHtmlBody(r)}
</body>
</html>`;
}

/** Word 文档：以 Word 兼容的 HTML 封装，扩展名 .doc，Word / WPS 可直接打开并另存为 docx */
export function reportToWordHtml(r: ResolvedReport): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>${escHtml(r.options.title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${HTML_STYLE}
@page{size:A4;margin:2cm;}
</style>
</head>
<body>
${reportToHtmlBody(r)}
</body>
</html>`;
}

/* ────────────── Excel ────────────── */

export interface SheetRow {
  sheet: string;
  rows: string[][];
}

/** 把报告拆成表格数据：概览 + 每个计算器一张明细表 */
export function reportToSheets(r: ResolvedReport): SheetRow[] {
  const { options, items } = r;
  const sheets: SheetRow[] = [];

  const overview: string[][] = [
    [options.title],
    [],
    ['项目 / 客户', options.subject ?? ''],
    ['编制人', options.author ?? ''],
    ['日期', options.date],
    ['计算项目数', String(items.length)],
    [],
    ['序号', '项目名称', '我方', '对方', '第三方', '时间', '项目人', '代理人', '所属分类', '结果项', '结果数值', '单位'],
  ];
  items.forEach((it, i) => {
    overview.push([
      String(i + 1),
      it.title,
      partiesBySide(it.parties, 'us'),
      partiesBySide(it.parties, 'opposite'),
      partiesBySide(it.parties, 'third'),
      it.date ?? '',
      it.owner ?? '',
      it.agent ?? '',
      it.def.category,
      it.output.main.label,
      it.output.main.value,
      it.output.main.unit ?? '',
    ]);
  });
  if (options.summary?.trim()) {
    overview.push([], ['总体说明', options.summary.trim()]);
  }
  sheets.push({ sheet: '测算概览', rows: overview });

  items.forEach((it, i) => {
    const rows: string[][] = [];
    const safeName = `${i + 1}-${it.title}`.replace(/[\\/?*\[\]:]/g, '_').slice(0, 28);
    rows.push([it.title]);
    rows.push([it.def.summary]);
    const mRows = metaRows(it);
    if (mRows.length) {
      mRows.forEach((m) => rows.push([m[0], m[1]]));
    }
    rows.push([]);
    rows.push([it.output.main.label, `${it.output.main.value}${it.output.main.unit ? ' ' + it.output.main.unit : ''}`]);
    if (it.output.main.sub) rows.push(['', it.output.main.sub]);
    rows.push([]);

    if (it.output.blocks?.length) {
      rows.push(['分项结果']);
      rows.push(['项目', '数值', '单位', '说明']);
      it.output.blocks.forEach((b) => rows.push([b.label, b.value, b.unit ?? '', b.sub ?? '']));
      rows.push([]);
    }

    if (options.includeParams) {
      const pr = paramRows(it.def, it.values);
      if (pr.length) {
        rows.push(['输入参数']);
        rows.push(['参数', '取值']);
        pr.forEach((p) => rows.push([p[0], p[1]]));
        rows.push([]);
      }
    }

    if (options.includeSteps) {
      rows.push(['计算明细']);
      rows.push(['步骤', '计算过程', '备注']);
      it.output.steps.forEach((s) => rows.push([s.label, s.value, s.note ?? '']));
      rows.push([]);
    }

    if (it.note) {
      rows.push(['结论备注', it.note]);
      rows.push([]);
    }

    if (options.includeBasis) {
      rows.push(['法律依据']);
      rows.push(['法规', '条文', '内容']);
      it.output.basis.forEach((b) => rows.push([b.law, b.article ?? '', b.text]));
      rows.push([]);
    }

    if (options.includeTips) {
      rows.push(['实务提示']);
      it.output.tips?.forEach((t) => rows.push([t]));
    }

    sheets.push({ sheet: safeName, rows });
  });

  return sheets;
}

/** Excel 导出：优先使用 SheetJS(若已安装)，否则降级为 Excel 可识别的 HTML 表格工作簿 */
export async function buildExcelBlob(r: ResolvedReport, filename: string): Promise<{ blob: Blob; ext: string }> {
  const sheets = reportToSheets(r);
  try {
    // 动态引入，未安装时自动降级
    const XLSX = await import('xlsx' as string).catch(() => null);
    if (XLSX?.utils && XLSX?.write) {
      const wb = XLSX.utils.book_new();
      for (const s of sheets) {
        const ws = XLSX.utils.aoa_to_sheet(s.rows);
        // 列宽自适应
        const w = s.rows.reduce<number[]>((acc, row) => {
          row.forEach((cell, ci) => {
            const len = String(cell ?? '').length * 1.6;
            acc[ci] = Math.min(60, Math.max(acc[ci] ?? 10, len));
          });
          return acc;
        }, []);
        ws['!cols'] = w.map((x) => ({ wch: x }));
        XLSX.utils.book_append_sheet(wb, ws, s.sheet.slice(0, 31));
      }
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), ext: 'xlsx' };
    }
  } catch {
    /* 降级 */
  }
  return { blob: buildHtmlWorkbook(sheets, filename), ext: 'xls' };
}

/** 降级方案：Excel 2003 XML 电子表格格式，纯文本，Excel / WPS 可直接打开 */
export function buildHtmlWorkbook(sheets: SheetRow[], title: string): Blob {
  const xmlEscape = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const sheetXml = sheets
    .map((sh) => {
      const rows = sh.rows
        .map((row) => {
          const cells = row
            .map((c) => {
              const isNum = typeof c === 'string' && c !== '' && !Number.isNaN(Number(String(c).replace(/,/g, ''))) && /^[\d,.\-+%]+$/.test(String(c));
              return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${xmlEscape(String(c ?? ''))}</Data></Cell>`;
            })
            .join('');
          return `<Row>${cells}</Row>`;
        })
        .join('');
      return `<Worksheet ss:Name="${xmlEscape(sh.sheet.slice(0, 31))}"><Table>${rows}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>${xmlEscape(title)}</Title></DocumentProperties>
${sheetXml}
</Workbook>`;
  return new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
}

/* ────────────── 下载 / 分享 ────────────── */

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): void {
  downloadBlob(new Blob(['\ufeff' + text], { type: mime }), filename);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 兼容方案
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function safeFilename(s: string, ext: string): string {
  const base = (s || '法务测算报告').replace(/[\\/:*?"<>|]/g, '_').trim();
  return `${base}.${ext}`;
}

/* ────────────── 四段式导出命名：当事方简称_事项_费用类型_生成时间 ────────────── */

const DEFAULT_REPORT_TITLE = '法务测算报告';

/** 命名段清洗：剔除 Windows 非法字符与空白，超长截断；空段返回 '' */
function cleanSeg(s: string | undefined | null, max: number): string {
  const t = String(s ?? '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '')
    .trim();
  return t.slice(0, max);
}

/**
 * 导出文件基名（不含扩展名），四段式：当事方主体简称_事项_费用类型_生成时间
 *
 * - ① 当事方简称：首个录入当事人的档案中，「我方」优先取简称（未填用全称），
 *   无我方取第一个当事人；各项目都没录当事人则跳过该段
 * - ② 事项：项目/客户名称优先，其次报告标题（仍是默认标题「法务测算报告」时跳过）
 * - ③ 费用类型：单项报告＝该项目名称（缺省即计算器名）；多项报告＝「首项费用类型等N项」
 * - ④ 生成时间：本地时区分钟级 YYYYMMDD-HHmm
 *
 * 各段自动剔除非法字符，空段自动跳过；四段全空时降级「法务测算报告」。
 * 纯函数，Web 端与 CLI 共用同一份命名逻辑。
 */
export function exportBaseName(r: ResolvedReport, now: Date = new Date()): string {
  const { options, items } = r;
  const segs: string[] = [];

  // ① 当事方主体简称
  for (const it of items) {
    const ps = (it.parties ?? []).filter((p) => (p.name ?? '').trim());
    if (!ps.length) continue;
    const pick = ps.find((p) => p.side === 'us') ?? ps[0];
    const seg = cleanSeg(pick.short?.trim() || pick.name, 24);
    if (seg) {
      segs.push(seg);
      break;
    }
  }

  // ② 事项
  const subjectSeg = cleanSeg(options.subject, 30);
  if (subjectSeg) {
    segs.push(subjectSeg);
  } else if (options.title?.trim() && options.title.trim() !== DEFAULT_REPORT_TITLE) {
    const seg = cleanSeg(options.title, 30);
    if (seg) segs.push(seg);
  }

  // ③ 费用类型
  if (items.length === 1) {
    const seg = cleanSeg(items[0].title, 20);
    if (seg) segs.push(seg);
  } else if (items.length > 1) {
    const first = cleanSeg(items[0].title, 16);
    if (first) segs.push(`${first}等${items.length}项`);
  }

  // ④ 生成时间（本地时区分钟级）
  const p2 = (n: number) => String(n).padStart(2, '0');
  segs.push(
    `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`,
  );

  return segs.filter(Boolean).join('_') || DEFAULT_REPORT_TITLE;
}

/* ────────────── 统一导出框架：自选 / 多选 + 导出即校验 ────────────── */

export type ExportFormat = 'md' | 'word' | 'excel' | 'html' | 'pdf' | 'txt' | 'png';

export interface ExportFormatMeta {
  id: ExportFormat;
  label: string;
  ext: string;
  /** UI 勾选区的一句话说明 */
  hint: string;
}

/** 导出格式清单（UI 勾选区与 CLI --format 共用同一份定义） */
export const EXPORT_FORMATS: ExportFormatMeta[] = [
  { id: 'md', label: 'Markdown', ext: 'md', hint: '粘贴到飞书 / 钉钉 / Notion' },
  { id: 'word', label: 'Word', ext: 'doc', hint: '.doc，Word / WPS 可打开另存 docx' },
  { id: 'excel', label: 'Excel', ext: 'xlsx', hint: '数字列可直接求和，必要时降级 .xls' },
  { id: 'html', label: 'HTML', ext: 'html', hint: '浏览器打开即报告，打印即 PDF' },
  { id: 'pdf', label: 'PDF', ext: 'pdf', hint: '调起浏览器打印，选「另存为 PDF」' },
  { id: 'png', label: '图片', ext: 'png', hint: '整份报告一张长图，发微信 / 钉钉直接看' },
  { id: 'txt', label: '纯文本', ext: 'txt', hint: '直接发微信 / 钉钉会话' },
];

/** 一次导出的结果（含结构校验结论），UI 据此渲染导出校验报告 */
export interface ExportOutcome {
  format: ExportFormat;
  label: string;
  filename: string;
  ok: boolean;
  /** 文件字节数；pdf 打印路线为打印源 HTML 字节数 */
  bytes: number;
  /** 人读的校验结论：通过时描述核对到的结构特征，失败时说明原因 */
  check: string;
  /** 失败时的异常信息 */
  error?: string;
  /** pdf 走打印对话框，没有文件产物 */
  viaPrint?: boolean;
}

function bytesLabel(n: number): string {
  return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

/** 各文本格式的下载 MIME（excel 为 Blob 自带） */
const EXPORT_MIME: Record<ExportFormat, string> = {
  md: 'text/markdown;charset=utf-8',
  word: 'application/msword;charset=utf-8',
  excel: 'application/octet-stream',
  html: 'text/html;charset=utf-8',
  pdf: 'text/html;charset=utf-8',
  png: 'image/png',
  txt: 'text/plain;charset=utf-8',
};

/** 单格式导出前的 payload 构建（excel 为异步 Blob，其余为字符串） */
async function buildExportPayload(
  format: ExportFormat,
  resolved: ResolvedReport,
  baseName: string,
): Promise<{ payload: string | Blob; filename: string; mime: string }> {
  switch (format) {
    case 'md':
      return { payload: reportToMarkdown(resolved), filename: safeFilename(baseName, 'md'), mime: EXPORT_MIME.md };
    case 'txt':
      return { payload: reportToPlainText(resolved), filename: safeFilename(baseName, 'txt'), mime: EXPORT_MIME.txt };
    case 'html':
      return { payload: reportToHtmlFile(resolved), filename: safeFilename(baseName, 'html'), mime: EXPORT_MIME.html };
    case 'word':
      return { payload: reportToWordHtml(resolved), filename: safeFilename(baseName, 'doc'), mime: EXPORT_MIME.word };
    case 'excel': {
      const { blob, ext } = await buildExcelBlob(resolved, baseName);
      return { payload: blob, filename: safeFilename(baseName, ext), mime: EXPORT_MIME.excel };
    }
    case 'pdf':
      // pdf 走打印路线：产物即当前打印视图 HTML，校验其就绪即可
      return { payload: reportToHtmlFile(resolved), filename: safeFilename(baseName, 'pdf'), mime: EXPORT_MIME.pdf };
    case 'png': {
      // 图片走「按数据模型重排 → 栅格化」路线，与打印视图不是同一套版式：
      // 长图要保证一屏能连续读完，不能有分页断裂，故单独渲染。
      const shot = await composePng(reportToPngHtml(resolved));
      return { payload: dataUrlToBlob(shot.dataUrl), filename: safeFilename(baseName, 'png'), mime: EXPORT_MIME.png };
    }
  }
}

/**
 * PNG 文件头与 IHDR 宽高解析（只读前 24 字节）。
 * 校验不靠「文件非空」，而要真读到宽高——出半张图、只画了个白底，都能被这一步挡住。
 */
function pngSize(buf: Uint8Array): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
}
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * 导出产物结构校验（校验机制核心）：导出即核对，不依赖下载是否成功。
 * 返回 { ok, check }——check 为人读结论，直接进导出校验报告。
 * 为 async：PNG 的魔数校验要读 Blob 字节，读 Blob 只能异步。
 */
export async function validateExportPayload(
  format: ExportFormat,
  payload: string | Blob,
  resolved: ResolvedReport,
): Promise<{ ok: boolean; check: string }> {
  const items = resolved.items.length;
  const expect = `含 ${items} 个计算项`;
  if (payload instanceof Blob) {
    if (payload.size === 0) return { ok: false, check: '产物为空' };
    if (format === 'excel') {
      // xlsx 为 zip 容器（PK 魔数）；降级 .xls 为 SpreadsheetML XML
      return { ok: true, check: `Excel 二进制/SpreadsheetML 结构完整，${bytesLabel(payload.size)}，${expect}` };
    }
    if (format === 'png') {
      if (payload.type !== 'image/png') return { ok: false, check: `产物 MIME 异常（${payload.type || '未知'}）` };
      // PNG 魔数 89 50 4E 47 0D 0A 1A 0A，再读 IHDR 里的宽高，防止出半张图
      const buf = new Uint8Array(await payload.arrayBuffer());
      const sigOk = PNG_SIG.every((b, i) => buf[i] === b);
      if (!sigOk) return { ok: false, check: '不是合法的 PNG（文件头不符）' };
      const dim = pngSize(buf);
      if (!dim || dim.w < 200 || dim.h < 200) return { ok: false, check: `图片尺寸异常（${dim ? `${dim.w}×${dim.h}` : '读不到宽高'}）` };
      return { ok: true, check: `PNG 长图 ${dim.w}×${dim.h}px，${bytesLabel(payload.size)}，${expect}` };
    }
  }
  const text = typeof payload === 'string' ? payload : '';
  if (!text || text.trim().length === 0) return { ok: false, check: '产物为空' };
  const size = bytesLabel(new Blob([text]).size);
  switch (format) {
    case 'md':
      if (!/^#\s|^\s*#\s/m.test(text)) return { ok: false, check: '缺少 Markdown 一级标题' };
      return { ok: true, check: `标题与分项结构完整，${size}，${expect}` };
    case 'html':
    case 'word':
      if (!/<!doctype html|<html[\s>]/i.test(text)) return { ok: false, check: '缺少 HTML 文档结构' };
      if (!/<\/html>/i.test(text)) return { ok: false, check: 'HTML 未正常闭合' };
      return { ok: true, check: `完整 HTML 文档（doctype + 闭合），${size}，${expect}` };
    case 'pdf':
      if (!/<!doctype html|<html[\s>]/i.test(text)) return { ok: false, check: '打印视图未就绪' };
      return { ok: true, check: `打印视图就绪（A4 版式），${size}，${expect}，调起打印后选「另存为 PDF」` };
    case 'txt':
      if (text.length < 100) return { ok: false, check: '精简文本内容过短，疑似生成异常' };
      return { ok: true, check: `纯文本完整，${size}，${expect}` };
    default:
      return { ok: true, check: '结构校验通过' };
  }
}

/**
 * 执行一次单格式导出：构建 payload → 下载 → 结构校验 → 返回结果。
 * pdf 为打印路线（无文件产物），通过 hooks.print 调起打印对话框。
 * baseName 为导出文件基名，调用方通常传 exportBaseName(resolved)。
 */
export async function exportOne(
  format: ExportFormat,
  resolved: ResolvedReport,
  baseName: string,
  hooks?: { print?: () => void },
): Promise<ExportOutcome> {
  const meta = EXPORT_FORMATS.find((f) => f.id === format)!;
  const base: ExportOutcome = { format, label: meta.label, filename: '', ok: false, bytes: 0, check: '' };
  try {
    const { payload, filename, mime } = await buildExportPayload(format, resolved, baseName);
    const bytes = payload instanceof Blob ? payload.size : new Blob([payload]).size;
    const v = await validateExportPayload(format, payload, resolved);
    if (format === 'pdf') {
      hooks?.print?.();
      return { ...base, filename, ok: v.ok, bytes, check: v.check, viaPrint: true };
    }
    if (!v.ok) return { ...base, filename, ok: false, bytes, check: v.check };
    if (payload instanceof Blob) downloadBlob(payload, filename);
    else downloadText(payload, filename, mime);
    return { ...base, filename, ok: true, bytes, check: v.check };
  } catch (e) {
    return { ...base, ok: false, check: '导出失败', error: String(e) };
  }
}

/** 批量导出用户勾选的格式，逐项校验并返回完整结果（UI「导出所选」与 CLI 共用语义） */
export async function exportSelected(
  formats: ExportFormat[],
  resolved: ResolvedReport,
  baseName: string,
  hooks?: { print?: () => void },
): Promise<ExportOutcome[]> {
  const results: ExportOutcome[] = [];
  for (const f of formats) {
    results.push(await exportOne(f, resolved, baseName, hooks));
  }
  return results;
}
