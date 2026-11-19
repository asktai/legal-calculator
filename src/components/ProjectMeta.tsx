import type { Party } from '../core/report';
import { SIDE_LABEL } from '../core/report';

export interface ProjectMetaValue {
  title?: string;
  date?: string;
  owner?: string;
  agent?: string;
  parties?: Party[];
}

interface Props {
  value: ProjectMetaValue;
  onChange: (patch: ProjectMetaValue) => void;
  /** 计算器名称，用于占位提示 */
  fallbackTitle: string;
  compact?: boolean;
}

const SIDE_OPTIONS: { label: string; value: Party['side'] }[] = [
  { label: '我方', value: 'us' },
  { label: '对方', value: 'opposite' },
  { label: '第三方', value: 'third' },
];

const SIDE_COLOR: Record<Party['side'], string> = {
  us: '#039855',
  opposite: '#d92d20',
  third: '#b54708',
};

export function ProjectMeta({ value, onChange, fallbackTitle, compact }: Props) {
  const parties = value.parties ?? [];

  const setParty = (idx: number, patch: Partial<Party>) => {
    const next = parties.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ parties: next });
  };

  const addParty = () => {
    // 默认补齐一方"我方"与一方"对方"，之后按需加第三方
    const side: Party['side'] = parties.length === 0 ? 'us' : parties.length === 1 ? 'opposite' : 'third';
    onChange({ parties: [...parties, { name: '', role: '', side }] });
  };

  const removeParty = (idx: number) => onChange({ parties: parties.filter((_, i) => i !== idx) });

  return (
    <div className="panel">
      <div className="panel-head">
        <span>项目档案</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>
          写入报告，便于汇报沟通
        </span>
      </div>
      <div className="panel-body">
        <div className="field">
          <label className="field-label">项目名称</label>
          <div className="field-control">
            <input
              type="text"
              value={value.title ?? ''}
              placeholder={`如：${fallbackTitle}（XX 项目）`}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          {!compact && <div className="field-hint">留空则使用计算器名称，将作为报告中该章节的标题。</div>}
        </div>

        <div className="field">
          <label className="field-label">时间</label>
          <div className="field-control">
            <input type="date" value={value.date ?? ''} onChange={(e) => onChange({ date: e.target.value })} />
          </div>
          <div className="field-hint">事发日 / 签约日 / 测算基准日</div>
        </div>

        <div className="field-group-title">当事人（支持双方与多方）</div>

        {parties.map((p, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <select
              value={p.side}
              onChange={(e) => setParty(idx, { side: e.target.value as Party['side'] })}
              style={{
                width: 78,
                flexShrink: 0,
                padding: '8px 6px',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                background: '#fff',
                color: SIDE_COLOR[p.side],
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              {SIDE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              value={p.short ?? ''}
              placeholder="简称"
              onChange={(e) => setParty(idx, { short: e.target.value })}
              style={{
                width: 96,
                flexShrink: 0,
                padding: '8px 8px',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
              }}
            />
            <input
              value={p.name}
              placeholder="当事人全称"
              onChange={(e) => setParty(idx, { name: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px 10px',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
              }}
            />
            <input
              value={p.role ?? ''}
              placeholder="角色"
              onChange={(e) => setParty(idx, { role: e.target.value })}
              style={{
                width: 84,
                flexShrink: 0,
                padding: '8px 8px',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
              }}
            />
            <button
              className="btn"
              style={{ padding: '5px 8px', fontSize: 12, color: 'var(--danger)', flexShrink: 0 }}
              onClick={() => removeParty(idx)}
            >
              ✕
            </button>
          </div>
        ))}

        <button className="btn" style={{ width: '100%', fontSize: 12 }} onClick={addParty}>
          + 添加当事人
        </button>
        <div className="field-hint">
          简称用于导出文件命名（如 华润万佳），留空时文件名使用全称；角色可填原告、被告、申请人、被申请人、甲方、乙方、第三人等。
          {SIDE_LABEL.us}与{SIDE_LABEL.opposite}会显示在项目档案与测算概览表中。
        </div>

        <div className="field-group-title">经办信息</div>

        <div className="field">
          <label className="field-label">项目人</label>
          <div className="field-control">
            <input
              type="text"
              value={value.owner ?? ''}
              placeholder="我方内部负责人，如 法务经理 李某"
              onChange={(e) => onChange({ owner: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label">代理人</label>
          <div className="field-control">
            <input
              type="text"
              value={value.agent ?? ''}
              placeholder="承办律师或代理人，如 张某律师"
              onChange={(e) => onChange({ agent: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
