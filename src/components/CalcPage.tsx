import { useMemo, useState } from 'react';
import { REUSABLE_AMOUNT_KEYS } from '../core/types';
import type { CalcValues } from '../core/types';
import { getCalculator, defaultValues, CATEGORIES } from '../core/calculators';
import { CalcForm } from './CalcForm';
import { ResultView } from './ResultView';
import { copyText, metaRows } from '../core/report';
import { money } from '../core/format';
import type { CalcOption } from '../core/types';
import { compareOptions, mergeValues } from '../core/compare';
import { CompareView, makeOption } from './CompareView';
import { ProjectMeta, type ProjectMetaValue } from './ProjectMeta';

interface Props {
  calcId: string;
  onBack: () => void;
  onAddToReport: (calcId: string, values: CalcValues, meta: ProjectMetaValue) => void;
  reportCount: number;
  onOpenReport: () => void;
  /** 上一个计算器填过的主金额（null 表示没有） */
  sharedAmount: number | null;
  /** 本页主金额被改动时回写给上层，供下一个计算器复用 */
  onAmountChange: (amount: number | null) => void;
  /** 把多方案测算结果加入报告 */
  onAddCompareToReport: (calcId: string, options: CalcOption[], meta: ProjectMetaValue) => void;
}

/** 本页承接复用值时落在哪个键上（没有可复用主金额的页面返回 null） */
function sharedKeyOf(base: CalcValues): string | null {
  return REUSABLE_AMOUNT_KEYS.find((k) => k in base) ?? null;
}

const SHOW_BASIS_STORE = 'legal-calculator.show-basis';

/**
 * 结果页是否显示法律依据。默认显示。
 * 这是**显示偏好**，与报告里的「法律依据」开关是两件事：
 * 收起只是为了看清结果，报告该有依据还得有——所以各自记忆、互不牵连。
 */
function loadShowBasis(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_BASIS_STORE);
    return raw === null ? true : raw === '1';
  } catch {
    return true;
  }
}

/** 把复用的金额铺到本页：仅当本页确有该字段、且上层记着一个正数时才覆盖 */
function withSharedAmount(base: CalcValues, amount: number | null): CalcValues {
  const k = sharedKeyOf(base);
  if (amount === null || k === null) return base;
  return { ...base, [k]: amount };
}

export function CalcPage({
  calcId,
  onBack,
  onAddToReport,
  reportCount,
  onOpenReport,
  sharedAmount,
  onAmountChange,
  onAddCompareToReport,
}: Props) {
  const def = getCalculator(calcId);
  const [base, setBase] = useState<CalcValues>(() => defaultValues(def!));
  const [meta, setMeta] = useState<ProjectMetaValue>(() => ({ title: def!.name, parties: [] }));
  const [toast, setToast] = useState<string | null>(null);
  /** 结果页「显示 / 收起法律依据」——只影响本页显示，不决定是否写进报告 */
  const [showBasis, setShowBasis] = useState<boolean>(loadShowBasis);
  const toggleBasis = (next: boolean) => {
    setShowBasis(next);
    try {
      localStorage.setItem(SHOW_BASIS_STORE, next ? '1' : '0');
    } catch {
      /* 隐私模式禁用 localStorage 时静默降级：仅本次生效 */
    }
  };
  /** 多方案比对模式 */
  const [compare, setCompare] = useState(false);
  const [sharedParams, setSharedParams] = useState<CalcValues>({});
  const [options, setOptions] = useState<CalcOption[]>(() =>
    def ? [makeOption(def, 0), makeOption(def, 1)] : [],
  );
  const compareResult = useMemo(
    () => (def ? compareOptions(def, options.map((o) => ({ ...o, values: mergeValues(def, sharedParams, o.values) }))) : null),
    [def, options, sharedParams],
  );

  const sharedKey = sharedKeyOf(base);
  const carried =
    sharedAmount !== null && sharedKey !== null && Number(base[sharedKey]) !== sharedAmount;
  const values = useMemo(() => withSharedAmount(base, sharedAmount), [base, sharedAmount]);

  const output = useMemo(() => {
    if (!def) return null;
    try {
      return def.calc(values);
    } catch (e) {
      return {
        main: { label: '计算出错', value: '—' },
        steps: [{ label: '错误信息', value: String(e) }],
        basis: [],
      };
    }
  }, [def, values]);

  if (!def) {
    return (
      <div className="empty-state">
        <b>未找到该计算器</b>
        <button className="btn" onClick={onBack} style={{ marginTop: 12 }}>
          返回首页
        </button>
      </div>
    );
  }

  const cat = CATEGORIES.find((c) => c.id === def.category);

  const projectName = meta.title?.trim() || def.name;

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopy = async () => {
    if (!output) return;
    const lines = [
      `【${projectName}】`,
      ...metaRows({
        def,
        title: projectName,
        date: meta.date,
        owner: meta.owner,
        agent: meta.agent,
        parties: meta.parties,
        values,
        output,
      }).map((m) => `${m[0]}：${m[1]}`),
      `${output.main.label}：${output.main.value}${output.main.unit ? ' ' + output.main.unit : ''}`,
      ...(output.main.sub ? [output.main.sub] : []),
      '',
      ...output.steps.map((s) => `${s.label}：${s.value}`),
    ];
    const ok = await copyText(lines.join('\n'));
    flash(ok ? '已复制到剪贴板' : '复制失败，请手动选择');
  };

  return (
    <div>
      <div className="page-head">
        <div className="crumb">
          <button onClick={onBack}>全部计算器</button>
          <span> / {cat?.name ?? ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2>{def.name}</h2>
            <p>{def.summary}</p>
          </div>
          <div className="mode-switch">
            <button className={!compare ? 'on' : ''} onClick={() => setCompare(false)}>
              单一测算
            </button>
            <button className={compare ? 'on' : ''} onClick={() => setCompare(true)}>
              多方案比对
            </button>
          </div>
        </div>
      </div>

      <div className="calc-layout">
        <div>
          {compare ? (
          <CompareView
            def={def}
            options={options}
            onChange={setOptions}
            shared={sharedParams}
            onSharedChange={setSharedParams}
            meta={meta}
            onMetaChange={(patch) => setMeta((prev) => ({ ...prev, ...patch }))}
          />
          ) : (
          <>
          <div style={{ marginBottom: 16 }}>
            {/* ProjectMeta 发的是增量 patch（如只带 {title}），必须与既有值合并——
                直接传 setMeta 会被 React 当整体替换，填时间即清空名称／当事人／经办人 */}
            <ProjectMeta
              value={meta}
              onChange={(patch) => setMeta((prev) => ({ ...prev, ...patch }))}
              fallbackTitle={def.name}
            />
          </div>
          <CalcForm
            def={def}
            values={values}
            onChange={(k, v) => {
              setBase((prev) => ({ ...prev, [k]: v }));
              if (k === sharedKey) {
                const n = Number(v);
                onAmountChange(Number.isFinite(n) && n > 0 ? n : null);
              }
            }}
            onReset={() => {
              setBase(defaultValues(def));
              if (sharedKey !== null) onAmountChange(null);
            }}
            amountCarried={carried}
            onResetSharedAmount={() => {
              onAmountChange(null);
              setBase(defaultValues(def));
            }}
          />
          <div className="form-actions">
            <button className="btn btn-primary" onClick={() => {
                onAddToReport(calcId, values, meta);
                flash(`已加入报告：${projectName}`);
              }}>
              加入报告
            </button>
            <button className="btn" onClick={handleCopy}>
              复制结果
            </button>
            <button className="btn" onClick={onOpenReport}>
              报告中心{reportCount > 0 ? `（${reportCount}）` : ''}
            </button>
          </div>
          </>
          )}

          {compare && (
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  onAddCompareToReport(calcId, options.map((o) => ({ ...o, values: mergeValues(def, sharedParams, o.values) })), meta);
                  flash(`已把 ${options.length} 个方案加入报告`);
                }}
              >
                全部方案加入报告
              </button>
              <button
                className="btn"
                onClick={async () => {
                  const r = compareResult;
                  if (!r) return;
                  const lines = [
                    `【${projectName} · ${def.name} 多方案比对】`,
                    ...r.options.map(
                      (o) => `${o.name}：${o.mainValue}${o.mainUnit ? ' ' + o.mainUnit : ''}${o.note ? `（${o.note}）` : ''}`,
                    ),
                  ];
                  if (r.comparable && !r.uniform) {
                    lines.push(`差额：${money(Math.max(0, (r.max ?? 0) - (r.min ?? 0)))} 元`);
                  }
                  const ok = await copyText(lines.join('\n'));
                  flash(ok ? '已复制比对结果' : '复制失败，请手动选择');
                }}
              >
                复制比对结果
              </button>
              <button className="btn" onClick={onOpenReport}>
                报告中心{reportCount > 0 ? `（${reportCount}）` : ''}
              </button>
            </div>
          )}
        </div>

        <div className="result-panel">
          {compare ? (
            <div className="panel">
              <div className="panel-head">
                <span>方案速览</span>
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400, color: 'var(--text-3)' }}>
                  {options.length} 个方案
                </span>
              </div>
              <div className="panel-body">
                {compareResult?.comparable && !compareResult.uniform && (
                  <div className="cmp-hero">
                    <div className="cmp-hero-label">最大差额</div>
                    <div className="cmp-hero-value">
                      {money((compareResult.max ?? 0) - (compareResult.min ?? 0))}
                      <span className="unit">元</span>
                    </div>
                    <div className="cmp-hero-sub">最低与最高方案之间</div>
                  </div>
                )}
                {compareResult?.options.map((o) => {
                  const best =
                    compareResult.comparable && !compareResult.uniform && o.amount !== null && o.amount === compareResult.min;
                  return (
                    <div key={o.index} className="cmp-quick" style={best ? { borderColor: 'var(--success)' } : undefined}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cmp-quick-name">
                          {o.name}
                          {best && <span className="opt-tag opt-tag-best" style={{ marginLeft: 6 }}>最低</span>}
                        </div>
                        {o.note && <div className="cmp-quick-note">{o.note}</div>}
                      </div>
                      <div className="cmp-quick-value">
                        {o.mainValue}
                        {o.mainUnit && <span className="unit">{o.mainUnit}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
          <div className="panel">
            <div className="panel-head">
              <span>计算结果</span>
            </div>
            <div className="panel-body">
              {output && <ResultView output={output} showBasis={showBasis} onToggleBasis={toggleBasis} />}
            </div>
          </div>
          )}
        </div>
      </div>

      {toast && <div className="copy-toast">{toast}</div>}
    </div>
  );
}
