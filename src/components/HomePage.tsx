import { CATEGORIES, ALL_CALCULATORS, getByCategory } from '../core/calculators';
import { PRODUCT_NAME } from '../core/version';

interface Props {
  onSelect: (id: string) => void;
  onReport: () => void;
  reportCount: number;
}

export function HomePage({ onSelect, onReport, reportCount }: Props) {
  return (
    <div>
      <div className="hero">
        <h2>{PRODUCT_NAME}</h2>
        <p>
          面向律师、企业法务与合规人员的在线计算工具集。覆盖诉讼费用、利息违约金、劳动争议、时效期限、税务、差旅与法务成本七大类，
          每个计算器均附带分步计算明细与法律依据条文。
        </p>
        <div className="hero-stats">
          <div className="hero-stat">
            <b>{ALL_CALCULATORS.length}</b>
            <span>个计算工具</span>
          </div>
          <div className="hero-stat">
            <b>{CATEGORIES.length}</b>
            <span>个专业分类</span>
          </div>
          <div className="hero-stat">
            <b>明细 + 法条</b>
            <span>每项均可追溯</span>
          </div>
          <div className="hero-stat">
            <b>多格式导出</b>
            <span>MD / Word / Excel / PDF</span>
          </div>
        </div>
      </div>

      <div className="section-title">
        <h3>选择分类</h3>
        <span>点击分类查看全部计算器</span>
      </div>

      <div className="cat-grid">
        {CATEGORIES.map((cat) => {
          const list = getByCategory(cat.id);
          return (
            <div className="cat-card" key={cat.id}>
              <div className="cat-card-head">
                <span className="nav-dot" style={{ background: cat.accent }} />
                <b>{cat.name}</b>
                <span className="nav-count">{list.length}</span>
              </div>
              <p>{cat.desc}</p>
              <div className="cat-card-tags">
                {list.map((c) => (
                  <button key={c.id} className="tag-mini" style={{ cursor: 'pointer' }} onClick={() => onSelect(c.id)}>
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h3>汇报与导出</h3>
        <span>把多个计算项组装成一份报告</span>
      </div>

      <div className="cat-grid">
        <div className="cat-card" style={{ cursor: 'pointer' }} onClick={onReport}>
          <div className="cat-card-head">
            <span className="nav-dot" style={{ background: '#ec4899' }} />
            <b>报告中心</b>
            {reportCount > 0 && <span className="nav-count">已选 {reportCount} 项</span>}
          </div>
          <p>勾选多个计算项目，自定义标题与备注，实时预览后导出 Markdown、Word、Excel、HTML 或 PDF。</p>
          <div className="cat-card-tags">
            <span className="tag-mini">勾选组装</span>
            <span className="tag-mini">复制粘贴</span>
            <span className="tag-mini">微信 / 钉钉 / 飞书</span>
          </div>
        </div>
      </div>
    </div>
  );
}
