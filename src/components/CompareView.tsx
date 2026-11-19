import { useMemo } from 'react';
import type { CalculatorDef, CalcOption, CalcValues } from '../core/types';
import { compareOptions, diffText, isSharedField, differingKeys, mergeValues } from '../core/compare';
import { defaultValues } from '../core/calculators';
import { CalcForm } from './CalcForm';
import { ProjectMeta, type ProjectMetaValue } from './ProjectMeta';

/** 新建一个空方案：除共用参数外，其余取计算器默认值 */
export function makeOption(def: CalculatorDef, index: number, base?: CalcValues, seed?: CalcValues): CalcOption {
  const values: CalcValues = {};
  for (const f of def.fields) {
    if (isSharedField(def, f.key)) continue;
    const v = seed?.[f.key] ?? base?.[f.key] ?? f.defaultValue ?? (f.type === 'switch' ? false : '');
    values[f.key] = v;
  }
  if (base) {
    for (const f of def.fields) {
      if (isSharedField(def, f.key) && base[f.key] !== undefined) values[f.key] = base[f.key];
    }
  }
  const letter = String.fromCharCode(65 + (index % 26));
  return { name: `方案 ${letter}`, values };
}

interface Props {
  def: CalculatorDef;
  options: CalcOption[];
  onChange: (options: CalcOption[]) => void;
  /** 共用参数（各方案共用的字段取值） */
  shared: CalcValues;
  onSharedChange: (shared: CalcValues) => void;
  meta: ProjectMetaValue;
  onMetaChange: (patch: Partial<ProjectMetaValue>) => void;
}

export function CompareView({ def, options, onChange, shared, onSharedChange, meta, onMetaChange }: Props) {
  /** 方案实际参与计算的值 = 共用参数 ⊕ 本方案参数 */
  const merged = useMemo(
    () => options.map((o) => ({ ...o, values: mergeValues(def, shared, o.values) })),
    [def, options, shared],
  );
  const resultMerged = useMemo(() => compareOptions(def, merged), [def, merged]);
  const diffs = useMemo(() => differingKeys(def, merged), [def, merged]);

  const sharedFields = def.fields.filter((f) => isSharedField(def, f.key));

  const update = (idx: number, key: string, value: string | number | boolean) => {
    const next = options.map((o, i) => (i === idx ? { ...o, values: { ...o.values, [key]: value } } : o));
    onChange(next);
  };

  const setName = (idx: number, name: string) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, name } : o)));
  };

  const addOption = () => {
    const last = options[options.length - 1];
    onChange([...options, makeOption(def, options.length, shared, last?.values)]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 1) return;
    onChange(options.filter((_, i) => i !== idx));
  };

  const duplicate = (idx: number) => {
    const src = options[idx];
    const copy: CalcOption = {
      name: `${src.name} 副本`,
      note: src.note,
      values: { ...src.values },
    };
    onChange([...options.slice(0, idx + 1), copy, ...options.slice(idx + 1)]);
  };

  const rm = resultMerged;
  const minAmount = rm.min ?? 0;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <ProjectMeta value={meta} onChange={onMetaChange} fallbackTitle={def.name} />
      </div>

      {sharedFields.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <span>案件共用参数</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>
              各方案共用，只填一次
            </span>
          </div>
          <div className="panel-body">
            <CalcForm
              def={{ ...def, fields: sharedFields }}
              values={{ ...defaultValues({ ...def, fields: sharedFields }), ...shared }}
              onChange={(k, v) => onSharedChange({ ...shared, [k]: v })}
              onReset={() => onSharedChange({})}
              bare
            />
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <span>主张 / 测算方案（{options.length} 个）</span>
          <button
            className="btn btn-primary"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
            onClick={addOption}
          >
            + 增加方案
          </button>
        </div>
        <div className="panel-body">
          {options.map((opt, idx) => {
            const r = rm.options[idx];
            const isBest = rm.comparable && !rm.uniform && r.amount !== null && r.amount === rm.min;
            const isWorst = rm.comparable && !rm.uniform && r.amount !== null && r.amount === rm.max;
            return (
              <div
                key={idx}
                style={{
                  border: `1px solid ${isBest ? 'var(--success)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px',
                    background: isBest ? 'var(--success-soft)' : 'var(--surface-2)',
                  }}
                >
                  <input
                    type="text"
                    value={opt.name}
                    onChange={(e) => setName(idx, e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontWeight: 700,
                      fontSize: 13,
                      minWidth: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                    {r.mainValue}
                    {r.mainUnit ? ` ${r.mainUnit}` : ''}
                  </span>
                  {isBest && !isWorst && (
                    <span className="opt-tag opt-tag-best">最低</span>
                  )}
                  {isWorst && !isBest && (
                    <span className="opt-tag opt-tag-worst">最高</span>
                  )}
                  <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }} onClick={() => duplicate(idx)}>
                    复制
                  </button>
                  <button
                    className="btn"
                    style={{ padding: '2px 7px', fontSize: 11, color: 'var(--danger)' }}
                    onClick={() => removeOption(idx)}
                    disabled={options.length <= 1}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
                  <CalcForm
                    def={{ ...def, fields: def.fields.filter((f) => !isSharedField(def, f.key)) }}
                    values={opt.values}
                    onChange={(k, v) => update(idx, k, v)}
                    onReset={() => onChange(options.map((o, i) => (i === idx ? makeOption(def, i, shared) : o)))}
                    bare
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 对比结论 ── */}
      <div className="panel">
        <div className="panel-head">
          <span>方案对比</span>
          {rm.comparable && !rm.uniform && (
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-2)' }}>
              差额 <b style={{ color: 'var(--danger)' }}>{diffText((rm.max ?? 0) - (rm.min ?? 0))}</b> 元
            </span>
          )}
        </div>
        <div className="panel-body">
          {options.length < 2 ? (
            <div className="field-hint">至少填两个方案才能比对；点上方「+ 增加方案」。</div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>项目</th>
                      {rm.options.map((r, i) => (
                        <th key={i} style={{ textAlign: 'right' }}>
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="cmp-main">
                      <td>{rm.options[0]?.mainLabel}</td>
                      {rm.options.map((r, i) => {
                        const best = rm.comparable && !rm.uniform && r.amount !== null && r.amount === rm.min;
                        return (
                          <td key={i} style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: best ? 'var(--success)' : undefined }}>
                              {r.mainValue}
                              {r.mainUnit ? ` ${r.mainUnit}` : ''}
                            </span>
                            {best && <span className="opt-tag opt-tag-best" style={{ marginLeft: 6 }}>最低</span>}
                          </td>
                        );
                      })}
                    </tr>
                    {rm.comparable && !rm.uniform && (
                      <tr>
                        <td>与最低方案差额</td>
                        {rm.options.map((r, i) => (
                          <td key={i} style={{ textAlign: 'right' }}>
                            {r.amount === null ? '—' : r.amount === minAmount ? '基准' : diffText(r.amount - minAmount)}
                          </td>
                        ))}
                      </tr>
                    )}
                    {def.fields
                      .filter((f) => !isSharedField(def, f.key))
                      .filter((f) => merged.every((o) => !f.visibleWhen || f.visibleWhen(o.values)))
                      .map((f) => {
                        const vals = merged.map((o) => o.values[f.key]);
                        const same = new Set(vals.map((v) => String(v ?? ''))).size === 1;
                        return (
                          <tr key={f.key} style={{ opacity: same ? 0.55 : 1 }}>
                            <td>{f.label}</td>
                            {vals.map((v, i) => (
                              <td key={i} style={{ textAlign: 'right' }}>
                                {f.type === 'switch'
                                  ? v === true || v === 'true'
                                    ? '是'
                                    : '否'
                                  : f.type === 'select'
                                    ? (f.options?.find((o) => String(o.value) === String(v))?.label ?? String(v ?? ''))
                                    : String(v ?? '')}
                                {f.type !== 'switch' && f.type !== 'select' && f.unit ? ` ${f.unit}` : ''}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="field-hint" style={{ marginTop: 10 }}>
                {diffs.length === 0
                  ? '各方案参数完全相同，仅并列展示。改动某一方案的参数即可看到差异。'
                  : `差异项：${diffs.map((d) => d.label).join('、')}——其余参数各方案相同（灰显）。`}
                {!rm.comparable && options.length >= 2 && ' 主结果不是金额，只并列展示、不比较大小。'}
                {rm.uniform && rm.comparable && ' 各方案结果相同，无差额可比。'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
