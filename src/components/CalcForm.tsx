import { useMemo } from 'react';
import { QUICK_AMOUNT_PRESETS } from '../core/types';
import type { CalculatorDef, CalcValues, FieldDef } from '../core/types';

interface Props {
  def: CalculatorDef;
  values: CalcValues;
  onChange: (key: string, value: string | number | boolean) => void;
  onReset: () => void;
  /** 该「争议标的额」是否沿用自上一个计算器（跨计算器复用提示） */
  amountCarried?: boolean;
  /** 点「改回本计算器默认值」时调用 */
  onResetSharedAmount?: () => void;
  /** 只渲染字段、不套面板外壳（方案比对里一处面板下放多个表单时用） */
  bare?: boolean;
}

export function CalcForm({ def, values, onChange, onReset, amountCarried, onResetSharedAmount, bare }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, FieldDef[]>();
    for (const f of def.fields) {
      const key = f.group ?? '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries());
  }, [def.fields]);

  const renderField = (f: FieldDef) => {
    if (f.visibleWhen && !f.visibleWhen(values)) return null;
    const val = values[f.key];

    if (f.type === 'switch') {
      const checked = val === true || val === 'true';
      return (
        <div className="field" key={f.key}>
          <div className="field-switch">
            <button
              type="button"
              className={`switch${checked ? ' on' : ''}`}
              aria-pressed={checked}
              onClick={() => onChange(f.key, !checked)}
            />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
          </div>
          {f.hint && <div className="field-hint">{f.hint}</div>}
        </div>
      );
    }

    return (
      <div className={f.emphasis ? 'field field-emphasis' : 'field'} key={f.key}>
        <label className="field-label">
          {f.label}
          {f.emphasis && <span className="field-badge">主参数</span>}
        </label>
        {f.type === 'select' ? (
          <div className="field-control">
            <select value={String(val ?? '')} onChange={(e) => onChange(f.key, e.target.value)}>
              {f.options?.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field-control">
            <input
              type={f.type === 'date' ? 'date' : 'number'}
              value={String(val ?? '')}
              step={f.step ?? (f.type === 'money' || f.type === 'percent' ? 0.01 : 1)}
              min={f.min}
              max={f.max}
              placeholder={f.placeholder}
              onChange={(e) => {
                const raw = e.target.value;
                onChange(f.key, raw === '' ? '' : f.type === 'date' ? raw : Number(raw));
              }}
            />
            {f.unit && <span className="field-unit">{f.unit}</span>}
          </div>
        )}
        {f.hint && <div className="field-hint">{f.hint}</div>}
        {f.emphasis && f.type === 'money' && (
          <div className="quick-amounts">
            <span className="qa-label">试算</span>
            {QUICK_AMOUNT_PRESETS.map((p) => {
              const active = Number(val) === p.value;
              return (
                <button
                  type="button"
                  key={p.value}
                  className={`qa-chip${active ? ' on' : ''}`}
                  title={`按 ${p.label} 元试算，看结果落在哪个档位`}
                  onClick={() => onChange(f.key, p.value)}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
        {f.emphasis && amountCarried && (
          <div className="field-carry">
            <span>已沿用上一个计算器填写的标的额，本页各处测算都用它</span>
            <button type="button" onClick={onResetSharedAmount}>
              改回默认值
            </button>
          </div>
        )}
      </div>
    );
  };

  const body = (
    <div className={bare ? undefined : 'panel-body'}>
      {groups.map(([groupName, fields]) => (
        <div key={groupName}>
          {groupName && <div className="field-group-title">{groupName}</div>}
          {fields.map(renderField)}
        </div>
      ))}
    </div>
  );

  if (bare) return body;

  return (
    <div className="panel">
      <div className="panel-head">
        <span>计算参数</span>
        <button
          className="btn"
          style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
          onClick={onReset}
        >
          重置
        </button>
      </div>
      {body}
    </div>
  );
}
