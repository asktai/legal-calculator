import { useMemo, useRef, useState } from 'react';
import type { CalcValues, CalculatorDef } from '../core/types';
import { CATEGORIES, ALL_CALCULATORS, defaultValues, getCalculator } from '../core/calculators';
import type { ExportFormat, ExportOutcome, ReportItem, ReportOptions } from '../core/report';
import {
  EXPORT_FORMATS,
  exportBaseName,
  resolveReport,
  reportToMarkdown,
  reportToPlainText,
  reportToHtmlFile,
  exportSelected,
  copyText,
  safeFilename,
} from '../core/report';
import { CalcForm } from './CalcForm';
import { ProjectMeta, type ProjectMetaValue } from './ProjectMeta';

interface Props {
  items: ReportItem[];
  onChange: (items: ReportItem[]) => void;
  onBack: () => void;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ReportBuilder({ items, onChange, onBack }: Props) {
  const [title, setTitle] = useState('法务测算报告');
  const [subject, setSubject] = useState('');
  const [author, setAuthor] = useState('');
  const [summary, setSummary] = useState('');
  const [includeParams, setIncludeParams] = useState(true);
  const [includeSteps, setIncludeSteps] = useState(true);
  const [includeBasis, setIncludeBasis] = useState(true);
  const [includeTips, setIncludeTips] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const options: ReportOptions = useMemo(
    () => ({
      title,
      subject,
      author,
      date: today(),
      summary,
      items,
      includeParams,
      includeSteps,
      includeBasis,
      includeTips,
    }),
    [title, subject, author, summary, items, includeParams, includeSteps, includeBasis, includeTips],
  );

  const resolved = useMemo(() => resolveReport(options), [options]);
  const htmlFile = useMemo(() => reportToHtmlFile(resolved), [resolved]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const addCalc = (def: CalculatorDef) => {
    const exists = items.some((i) => i.calcId === def.id);
    if (exists) {
      flash('该项目已在报告中');
      return;
    }
    onChange([...items, { calcId: def.id, values: defaultValues(def), title: def.name }]);
    flash(`已添加「${def.name}」`);
  };

  const updateItem = (idx: number, patch: Partial<ReportItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const base = () => safeFilename(exportBaseName(resolved), '');

  /* ── 多选导出（自选格式 + 一键批量 + 导出即校验） ── */
  const DEFAULT_FORMATS: ExportFormat[] = ['md', 'word', 'excel', 'html', 'pdf'];
  const [selected, setSelected] = useState<ExportFormat[]>(DEFAULT_FORMATS);
  const [outcomes, setOutcomes] = useState<ExportOutcome[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const toggleFormat = (id: ExportFormat) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]));

  const handleExportSelected = async () => {
    if (!selected.length) {
      flash('请先勾选至少一种导出格式');
      return;
    }
    if (!resolved.items.length) {
      flash('报告还没有计算项目，先在左侧添加');
      return;
    }
    setExporting(true);
    setOutcomes(null);
    const doPrint = () => {
      const frame = previewRef.current;
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } else {
        window.print();
      }
    };
    const results = await exportSelected(selected, resolved, exportBaseName(resolved), { print: doPrint });
    setOutcomes(results);
    setExporting(false);
    const okCount = results.filter((r) => r.ok).length;
    flash(
      okCount === results.length
        ? `已导出 ${okCount} 种格式，校验全部通过`
        : `导出完成：${okCount} 项通过，${results.length - okCount} 项未通过，详见校验报告`,
    );
  };

  const handleCopyMarkdown = async () => {
    const ok = await copyText(reportToMarkdown(resolved));
    flash(ok ? 'Markdown 已复制，可粘贴到飞书 / 钉钉文档' : '复制失败，请手动选择');
  };

  const handleCopyPlain = async () => {
    const ok = await copyText(reportToPlainText(resolved));
    flash(ok ? '精简文本已复制，可直接发到微信 / 钉钉' : '复制失败，请手动选择');
  };

  const handleShare = async () => {
    const text = reportToPlainText(resolved);
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        /* 用户取消或不支持文件分享 */
      }
    }
    const ok = await copyText(text);
    flash(ok ? '当前环境不支持直接分享，内容已复制，请粘贴到微信 / 钉钉' : '分享不可用，请手动复制');
  };

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <button onClick={onBack}>全部计算器</button>
          <span> / 报告中心</span>
        </div>
        <h2>报告中心</h2>
        <p>勾选需要的计算项目，调整参数与顺序，一键生成可汇报的测算报告并导出多种格式。</p>
      </div>

      <div className="calc-layout">
        {/* ── 左：配置区 ── */}
        <div>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">报告信息</div>
            <div className="panel-body">
              <div className="field">
                <label className="field-label">报告标题</label>
                <div className="field-control">
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">项目 / 客户名称</label>
                <div className="field-control">
                  <input type="text" value={subject} placeholder="如：XX 公司劳动争议专项" onChange={(e) => setSubject(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">编制人</label>
                <div className="field-control">
                  <input type="text" value={author} placeholder="选填" onChange={(e) => setAuthor(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">总体说明</label>
                <div className="field-control" style={{ alignItems: 'stretch' }}>
                  <textarea
                    value={summary}
                    rows={3}
                    placeholder="选填，如测算背景、假设前提、结论摘要"
                    onChange={(e) => setSummary(e.target.value)}
                    style={{ border: 'none', outline: 'none', padding: '9px 12px', resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
                  />
                </div>
              </div>

              <div className="field-group-title">导出内容</div>
              {[
                ['输入参数', includeParams, setIncludeParams, '列出计算所用的每一项参数，便于复核'],
                ['计算明细', includeSteps, setIncludeSteps, '分步算式，对方质疑时可逐步核对'],
                ['法律依据', includeBasis, setIncludeBasis, '关掉则只留数字与算式，适合对外简版'],
                ['实务提示', includeTips, setIncludeTips, '风险点与后续动作建议，内部汇报常留'],
              ].map(([label, val, setter, hint]: any) => (
                <div className="field-switch" key={label}>
                  <button
                    type="button"
                    className={`switch${val ? ' on' : ''}`}
                    aria-pressed={val}
                    onClick={() => setter(!val)}
                  />
                  <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span>
                </div>
              ))}
              <div className="field-hint" style={{ marginTop: 2 }}>
                这里的开关决定<b>写不写进报告</b>；计算器结果页上的「法律依据」开关只管当页看不看，
                两者互不影响——收起只是为了看清结果，报告该有的依据照样在。
              </div>
            </div>
          </div>

          {/* ── 项目选择 ── */}
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <span>计算项目（已选 {items.length} 项）</span>
              <button
                className="btn btn-primary"
                style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? '收起' : '+ 添加项目'}
              </button>
            </div>
            <div className="panel-body">
              {pickerOpen && (
                <div style={{ marginBottom: 16, maxHeight: 340, overflowY: 'auto' }}>
                  {CATEGORIES.map((cat) => {
                    const list = ALL_CALCULATORS.filter((c) => c.category === cat.id);
                    return (
                      <div key={cat.id} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="nav-dot" style={{ background: cat.accent }} />
                          {cat.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {list.map((c) => {
                            const on = items.some((i) => i.calcId === c.id);
                            return (
                              <button
                                key={c.id}
                                className="tag-mini"
                                onClick={() => (on ? removeItem(items.findIndex((i) => i.calcId === c.id)) : addCalc(c))}
                                style={{
                                  cursor: 'pointer',
                                  background: on ? cat.accent : 'var(--surface-2)',
                                  color: on ? '#fff' : 'var(--text-2)',
                                  borderColor: on ? cat.accent : 'var(--border)',
                                  fontWeight: on ? 600 : 400,
                                }}
                              >
                                {on ? '✓ ' : '+ '}
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: 13 }}>
                  还没有选择计算项目
                  <br />
                  <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setPickerOpen(true)}>
                    选择计算项目
                  </button>
                </div>
              ) : (
                items.map((it, idx) => {
                  const def = getCalculator(it.calcId);
                  if (!def) return null;
                  const cat = CATEGORIES.find((c) => c.id === def.category);
                  const isOpen = expanded === `${idx}`;
                  return (
                    <div
                      key={`${it.calcId}-${idx}`}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--surface-2)' }}>
                        <span className="nav-dot" style={{ background: cat?.accent }} />
                        <input
                          type="text"
                          value={it.title ?? def.name}
                          placeholder={`项目名称，如：${def.name}（XX 项目）`}
                          onChange={(e) => updateItem(idx, { title: e.target.value })}
                          style={{
                            flex: 1,
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            fontWeight: 600,
                            fontSize: 13,
                            minWidth: 0,
                          }}
                        />
                        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => moveItem(idx, -1)} disabled={idx === 0}>
                          ↑
                        </button>
                        <button
                          className="btn"
                          style={{ padding: '2px 7px', fontSize: 11 }}
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === items.length - 1}
                        >
                          ↓
                        </button>
                        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => setExpanded(isOpen ? null : `${idx}`)}>
                          {isOpen ? '收起' : '参数'}
                        </button>
                        <button className="btn" style={{ padding: '2px 7px', fontSize: 11, color: 'var(--danger)' }} onClick={() => removeItem(idx)}>
                          ✕
                        </button>
                      </div>
                      {isOpen && (
                        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                          <div style={{ marginBottom: 12 }}>
                            <ProjectMeta
                              value={{
                                date: it.date,
                                owner: it.owner,
                                agent: it.agent,
                                parties: it.parties,
                              }}
                              onChange={(patch) => updateItem(idx, patch)}
                              fallbackTitle={def.name}
                              compact
                            />
                          </div>
                          <CalcForm
                            def={def}
                            values={it.values}
                            onChange={(k, v) => updateItem(idx, { values: { ...it.values, [k]: v } })}
                            onReset={() => updateItem(idx, { values: defaultValues(def) })}
                          />
                          <div className="field" style={{ marginTop: 12 }}>
                            <label className="field-label">结论备注（写入报告）</label>
                            <div className="field-control" style={{ alignItems: 'stretch' }}>
                              <textarea
                                value={it.note ?? ''}
                                rows={2}
                                placeholder="选填，如对该项测算的特别说明或结论"
                                onChange={(e) => updateItem(idx, { note: e.target.value })}
                                style={{ border: 'none', outline: 'none', padding: '9px 12px', resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── 右：预览与导出 ── */}
        <div className="result-panel">
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-head">
              <span>导出与分享</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>
                共 {resolved.items.length} 项
              </span>
            </div>
            <div className="panel-body">
              <div className="field-group-title" style={{ marginTop: 0 }}>复制粘贴</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleCopyMarkdown}>
                  复制 Markdown
                </button>
                <button className="btn" onClick={handleCopyPlain}>
                  复制精简文本
                </button>
                <button className="btn" onClick={handleShare}>
                  分享到微信 / 钉钉
                </button>
              </div>
              <div className="field-hint" style={{ marginTop: 6 }}>
                Markdown 适合粘贴到飞书文档、钉钉文档、Notion；精简文本适合直接发到微信 / 钉钉会话。
              </div>

              <div className="field-group-title">导出格式（可多选）</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EXPORT_FORMATS.map((f) => {
                  const on = selected.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      className="tag-mini"
                      title={f.hint}
                      onClick={() => toggleFormat(f.id)}
                      style={{
                        cursor: 'pointer',
                        background: on ? 'var(--primary, #2f6fed)' : 'var(--surface-2)',
                        color: on ? '#fff' : 'var(--text-2)',
                        borderColor: on ? 'var(--primary, #2f6fed)' : 'var(--border)',
                        fontWeight: on ? 600 : 400,
                      }}
                    >
                      {on ? '✓ ' : ''}
                      {f.label}（.{f.ext}）
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <button className="btn btn-primary" onClick={handleExportSelected} disabled={exporting}>
                  {exporting ? '导出中…' : `导出所选（${selected.length}）`}
                </button>
                <button className="btn" onClick={() => setSelected(EXPORT_FORMATS.map((f) => f.id))} disabled={exporting}>
                  全选
                </button>
                <button className="btn" onClick={() => setSelected([])} disabled={exporting}>
                  清空
                </button>
              </div>
              <div className="field-hint" style={{ marginTop: 6 }}>
                文件名按「
                <b>当事方简称_事项_费用类型_生成时间</b>
                」四段式自动生成，当前将导出为：
                <span style={{ color: 'var(--primary, #2f6fed)', fontWeight: 600, wordBreak: 'break-all' }}>
                  {exportBaseName(resolved)}_〔扩展名〕
                </span>
                <br />
                简称在项目档案的当事人里填写；事项取「项目 / 客户名称」（未填用报告标题）；多项报告的费用类型为「首项费用等N项」。
              </div>
              <div className="field-hint" style={{ marginTop: 6 }}>
                勾选需要的格式，一键批量导出；每种格式导出后自动做结构校验并在下方给出核对结论。PDF 通过浏览器打印对话框选择「另存为 PDF」；Word 为 .doc，Word / WPS 打开后可另存 docx。
              </div>

              {outcomes && (
                <div style={{ marginTop: 12 }}>
                  <div className="field-group-title">导出校验报告</div>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    {outcomes.map((o, i) => (
                      <div
                        key={o.format}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '8px 12px',
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          borderTop: i ? '1px solid var(--border)' : 'none',
                          background: o.ok ? 'transparent' : 'var(--danger-bg, rgba(220,38,38,.06))',
                        }}
                      >
                        <span style={{ color: o.ok ? 'var(--ok, #16a34a)' : 'var(--danger)', fontWeight: 700 }}>
                          {o.ok ? '✓' : '✗'}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>
                            {o.label}
                            {o.viaPrint ? '（打印导出）' : `：${o.filename}`}
                          </div>
                          <div style={{ color: 'var(--text-3)' }}>{o.check}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span>报告预览</span>
              <a
                href={URL.createObjectURL(new Blob([htmlFile], { type: 'text/html' }))}
                download={base() + 'html'}
                className="btn"
                style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12, textDecoration: 'none', lineHeight: 1.8 }}
              >
                新窗口打开
              </a>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <iframe
                ref={previewRef}
                title="报告预览"
                srcDoc={htmlFile}
                style={{ width: '100%', height: 620, border: 'none', borderRadius: '0 0 12px 12px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  );
}

/** 供 App 侧构建初始项 */
export function makeReportItem(calcId: string, values: CalcValues, meta?: ProjectMetaValue): ReportItem {
  const def = getCalculator(calcId);
  return {
    calcId,
    values,
    title: meta?.title?.trim() || def?.name,
    date: meta?.date,
    owner: meta?.owner,
    agent: meta?.agent,
    parties: meta?.parties,
  };
}
