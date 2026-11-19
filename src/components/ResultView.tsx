import type { CalcOutput } from '../core/types';
import { PRODUCT_NAME } from '../core/version';

interface Props {
  output: CalcOutput;
  onCopy?: () => void;
  /** 是否显示法律依据（结果页开关，只影响本页显示，不决定是否写进报告） */
  showBasis?: boolean;
  /** 切换法律依据显示 */
  onToggleBasis?: (next: boolean) => void;
}

export function ResultView({ output, onCopy, showBasis = true, onToggleBasis }: Props) {
  return (
    <div>
      <div className="result-hero">
        <div className="result-hero-label">{output.main.label}</div>
        <div className="result-hero-value">
          {output.main.value}
          {output.main.unit && <span className="unit">{output.main.unit}</span>}
        </div>
        {output.main.sub && <div className="result-hero-sub">{output.main.sub}</div>}
      </div>

      {output.blocks && output.blocks.length > 0 && (
        <div className="block-grid">
          {output.blocks.map((b, i) => (
            <div className="block-item" key={i}>
              <div className="bl">{b.label}</div>
              <div className="bv">
                {b.value}
                {b.unit && <span className="unit">{b.unit}</span>}
              </div>
              {b.sub && <div className="bs">{b.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {output.steps.length > 0 && (
        <>
          <div className="subhead">
            计算明细
            {onCopy && (
              <button className="btn" style={{ marginLeft: 'auto', padding: '3px 9px', fontSize: 11 }} onClick={onCopy}>
                复制明细
              </button>
            )}
          </div>
          <table className="steps-table">
            <tbody>
              {output.steps.map((s, i) => (
                <tr key={i} className={s.emphasis ? 'emphasis' : ''}>
                  <td className="s-label">{s.label}</td>
                  <td className="s-value">
                    {s.value}
                    {s.note && <span className="s-note">{s.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {output.basis.length > 0 && (
        <>
          <div className="subhead">
            法律依据
            <span className="subhead-count">{output.basis.length} 条</span>
            {onToggleBasis && (
              <div className="basis-toggle">
                <button
                  type="button"
                  className={`switch switch-sm${showBasis ? ' on' : ''}`}
                  aria-pressed={showBasis}
                  aria-label="显示法律依据"
                  onClick={() => onToggleBasis(!showBasis)}
                />
                <span>{showBasis ? '显示中' : '已收起'}</span>
              </div>
            )}
          </div>
          {showBasis ? (
            output.basis.map((b, i) => (
              <div className="basis-item" key={i}>
                <div className="bl">
                  {b.law}
                  {b.article ? ` ${b.article}` : ''}
                </div>
                <div className="bt">{b.text}</div>
              </div>
            ))
          ) : (
            <div className="basis-folded">
              已收起 {output.basis.length} 条法律依据，不影响计算。
              {onToggleBasis && (
                <button type="button" onClick={() => onToggleBasis(true)}>
                  展开
                </button>
              )}
            </div>
          )}
        </>
      )}

      {output.tips && output.tips.length > 0 && (
        <>
          <div className="subhead">实务提示</div>
          <ul className="tips-list">
            {output.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}

      <div className="disclaimer">
        {output.disclaimer ??
          `本结果由${PRODUCT_NAME}自动生成，仅供参考，不构成法律意见。个案请结合当地最新规定、司法实践口径与专业判断。`}
      </div>
    </div>
  );
}
