import { useMemo, useState } from 'react';
import { CATEGORIES, ALL_CALCULATORS, getByCategory, searchCalculators } from '../core/calculators';
import { VERSION, RELEASE_DATE, LICENSE, AUTHOR, PRODUCT_NAME } from '../core/version';

interface Props {
  current: string | null;
  onSelect: (id: string) => void;
  onHome: () => void;
  onReport: () => void;
  reportCount: number;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ current, onSelect, onHome, onReport, reportCount, open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const results = useMemo(() => searchCalculators(query), [query]);

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <h1>
            <span className="brand-mark">{PRODUCT_NAME.charAt(0)}</span>
            {PRODUCT_NAME}
          </h1>
          <div className="brand-sub">
            {ALL_CALCULATORS.length} 个专业计算工具
            <span className="brand-version" title={`${PRODUCT_NAME} · 作者 ${AUTHOR} · 发布日期 ${RELEASE_DATE} · ${LICENSE}`}>
              V{VERSION}
            </span>
          </div>
        </div>

        <div className="sidebar-search">
          <input
            className="search-input"
            placeholder="搜索计算器，如 违约金、工伤"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <nav className="sidebar-nav">
          {query ? (
            <div className="search-results">
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 10px' }}>
                找到 {results.length} 个结果
              </div>
              {results.map((c) => (
                <button
                  key={c.id}
                  className={`nav-item${current === c.id ? ' active' : ''}`}
                  style={{ paddingLeft: 12 }}
                  onClick={() => {
                    onSelect(c.id);
                    onClose();
                  }}
                >
                  {c.name}
                </button>
              ))}
              {results.length === 0 && <div style={{ padding: '16px 10px', fontSize: 13, color: 'var(--text-3)' }}>没有匹配的计算器</div>}
            </div>
          ) : (
            <>
              <button className={`nav-item${current === null ? ' active' : ''}`} style={{ paddingLeft: 12 }} onClick={() => { onHome(); onClose(); }}>
                首页概览
              </button>
              <button className={`nav-item${current === '__report__' ? ' active' : ''}`} style={{ paddingLeft: 12, marginBottom: 8 }} onClick={() => { onReport(); onClose(); }}>
                报告中心{reportCount > 0 ? `（${reportCount} 项）` : ''}
              </button>

              {CATEGORIES.map((cat) => {
                const list = getByCategory(cat.id);
                const isCollapsed = collapsed[cat.id];
                return (
                  <div className="nav-group" key={cat.id}>
                    <button
                      className="nav-group-head"
                      onClick={() => setCollapsed((p) => ({ ...p, [cat.id]: !isCollapsed }))}
                    >
                      <span className="nav-dot" style={{ background: cat.accent }} />
                      {cat.name}
                      <span className="nav-count">{isCollapsed ? `+${list.length}` : '−'}</span>
                    </button>
                    {!isCollapsed &&
                      list.map((c) => (
                        <button
                          key={c.id}
                          className={`nav-item${current === c.id ? ' active' : ''}`}
                          onClick={() => {
                            onSelect(c.id);
                            onClose();
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                );
              })}
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
