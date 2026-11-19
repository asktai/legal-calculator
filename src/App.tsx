import { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { PRODUCT_NAME } from './core/version';
import { HomePage } from './components/HomePage';
import { CalcPage } from './components/CalcPage';
import { ReportBuilder, makeReportItem } from './components/ReportBuilder';
import type { ProjectMetaValue } from './components/ProjectMeta';
import { REUSABLE_AMOUNT_KEYS } from './core/types';
import { mergeValues } from './core/compare';
import type { CalcOption, CalcValues } from './core/types';
import type { ReportItem } from './core/report';
import { ALL_CALCULATORS } from './core/calculators';

const SHARED_AMOUNT_STORE = 'legal-calculator.shared-amount';

/** 读回上次填写的争议标的额；读不到或非正数即视为没有（0 元标的额没有复用意义） */
function loadSharedAmount(): number | null {
  try {
    const raw = localStorage.getItem(SHARED_AMOUNT_STORE);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** 路由：null = 首页，'__report__' = 报告中心，其余为计算器 id */
export default function App() {
  const [route, setRoute] = useState<string | null>(null);
  const [reportItems, setReportItems] = useState<ReportItem[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  /** 争议标的额跨计算器复用：各计算器的标的额是同一个数，不必到一页填一遍 */
  const [sharedAmount, setSharedAmount] = useState<number | null>(loadSharedAmount);

  useEffect(() => {
    try {
      if (sharedAmount === null) localStorage.removeItem(SHARED_AMOUNT_STORE);
      else localStorage.setItem(SHARED_AMOUNT_STORE, String(sharedAmount));
    } catch {
      /* 隐私模式禁用 localStorage 时静默降级：本会话内仍可复用 */
    }
  }, [sharedAmount]);

  const rememberAmount = (v: CalcValues) => {
    const k = [...REUSABLE_AMOUNT_KEYS].find((key) => key in v);
    if (!k) return;
    const n = Number(v[k]);
    if (Number.isFinite(n) && n > 0) setSharedAmount(n);
  };

  const addToReport = (calcId: string, values: CalcValues, meta: ProjectMetaValue) => {
    setReportItems((prev) => [...prev, makeReportItem(calcId, values, meta)]);
    rememberAmount(values);
  };

  /** 多方案比对加入报告：一项里装多套参数，报告侧出对比表 */
  const addCompareToReport = (calcId: string, options: CalcOption[], meta: ProjectMetaValue) => {
    const def = ALL_CALCULATORS.find((c) => c.id === calcId);
    // 每个方案都要带上合并后的完整参数，否则报告侧收到 undefined 会静默算成 0
    const mergedOptions = options.map((o) => ({
      ...o,
      values: def ? mergeValues(def, {}, o.values) : o.values,
    }));
    const base = makeReportItem(calcId, mergedOptions[0]?.values ?? {}, meta);
    // 标题落盘：报告项名称就写「X 方案比对」，列表里一眼认出这是比对项
    const name = `${def?.name ?? calcId}（${mergedOptions.length} 方案比对）`;
    setReportItems((prev) => [...prev, { ...base, title: name, options: mergedOptions }]);
    if (options[0]) rememberAmount(options[0].values);
  };

  return (
    <div className="app">
      <Sidebar
        current={route}
        onSelect={setRoute}
        onHome={() => setRoute(null)}
        onReport={() => setRoute('__report__')}
        reportCount={reportItems.length}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="main">
        <div className="mobile-head">
          <button className="mobile-toggle" onClick={() => setMenuOpen(true)} aria-label="菜单">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
          <b style={{ fontSize: 14 }}>{PRODUCT_NAME}</b>
          <button
            className="btn"
            style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 12 }}
            onClick={() => setRoute('__report__')}
          >
            报告{reportItems.length > 0 ? `（${reportItems.length}）` : ''}
          </button>
        </div>

        <div className="main-inner">
          {route === null && (
            <HomePage onSelect={setRoute} onReport={() => setRoute('__report__')} reportCount={reportItems.length} />
          )}
          {route === '__report__' && (
            <ReportBuilder items={reportItems} onChange={setReportItems} onBack={() => setRoute(null)} />
          )}
          {route !== null && route !== '__report__' && (
            <CalcPage
              key={route}
              calcId={route}
              onBack={() => setRoute(null)}
              onAddToReport={addToReport}
              reportCount={reportItems.length}
              onOpenReport={() => setRoute('__report__')}
              sharedAmount={sharedAmount}
              onAmountChange={setSharedAmount}
              onAddCompareToReport={addCompareToReport}
            />
          )}
        </div>
      </main>
    </div>
  );
}

/** 供调试：暴露计算器总数 */
export const CALC_COUNT = ALL_CALCULATORS.length;
