import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import overview from '@/styles/report-overview.module.css';
import section from '@/styles/report-section.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportOverview({ report, ui }: Props) {
  const o = report.overview;
  const labels = ui.overview;

  return (
    <section className={overview.panel}>
      <header className={overview.header}>
        <div>
          <h3 className={overview.name}>{o.name}</h3>
          <span className={overview.version}>v{o.version}</span>
        </div>
        <span className={`${overview.status} ${overview[report.status] ?? ''}`}>
          {report.status}
        </span>
      </header>

      <div className={overview.logicCard}>
        <span className={overview.logicLabel}>{labels.logic}</span>
        <p className={overview.logicText}>{o.logic}</p>
      </div>

      {/* 策略类型与适用市场 */}
      {(o.strategyCategory ||
        (o.suitableMarketRegime &&
          Array.isArray(o.suitableMarketRegime) &&
          o.suitableMarketRegime.length > 0)) && (
        <div className={overview.metaGrid}>
          {o.strategyCategory && (
            <div className={overview.metaItem}>
              <span className={overview.metaLabel}>{labels.strategyCategory}</span>
              <span className={overview.metaValue}>{o.strategyCategory}</span>
            </div>
          )}
          {o.suitableMarketRegime &&
            Array.isArray(o.suitableMarketRegime) &&
            o.suitableMarketRegime.length > 0 && (
              <div className={overview.metaItem}>
                <span className={overview.metaLabel}>{labels.suitableMarketRegime}</span>
                <div className={overview.chipRow}>
                  {o.suitableMarketRegime.map((r, i) => (
                    <span key={i} className={overview.chip}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {/* 核心逻辑说明 */}
      {o.coreLogic && (
        <div className={overview.logicCard}>
          <span className={overview.logicLabel}>{labels.coreLogic}</span>
          <p className={overview.logicText}>{o.coreLogic}</p>
        </div>
      )}

      <div className={overview.metaGrid}>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.instruments}</span>
          <div className={overview.chipRow}>
            {o.instruments.map((inst) => (
              <span key={inst} className={overview.chip}>
                {inst}
              </span>
            ))}
          </div>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.timeRange}</span>
          <span className={overview.metaValue}>
            {o.timeRange.start} ~ {o.timeRange.end}
          </span>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.frequency}</span>
          <span className={overview.metaValue}>{o.frequency}</span>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.benchmark}</span>
          <span className={overview.metaValue}>{o.benchmark}</span>
        </div>
      </div>

      {/* 组合构成（如有） */}
      {o.composition && o.composition.length > 0 && (
        <div className={section.section}>
          <h4 className={overview.logicLabel}>{labels.composition}</h4>
          <table className={overview.compositionTable}>
            <thead>
              <tr>
                <th>{labels.composition}</th>
                <th>权重</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {o.composition.map((c) => (
                <tr key={c.name}>
                  <td>{c.name}</td>
                  <td className={overview.mono}>{(c.weight * 100).toFixed(0)}%</td>
                  <td>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 关键参数 */}
      {o.keyParameters && o.keyParameters.length > 0 && (
        <div className={section.section}>
          <h4 className={overview.logicLabel}>{labels.keyParameters}</h4>
          <table className={overview.compositionTable}>
            <thead>
              <tr>
                <th>{labels.paramName}</th>
                <th>{labels.paramValue}</th>
                <th>{labels.paramDescription}</th>
              </tr>
            </thead>
            <tbody>
              {o.keyParameters.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className={overview.mono}>{p.value}</td>
                  <td>{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
