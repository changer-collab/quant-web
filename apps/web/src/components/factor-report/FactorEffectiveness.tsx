import { useState } from 'react';
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

type EffectivenessSubTab = 'groupBacktest' | 'icAnalysis' | 'regression';

export function FactorEffectiveness({ report, ui }: Props) {
  const [subTab, setSubTab] = useState<EffectivenessSubTab>('groupBacktest');
  const u = ui.effectiveness;

  return (
    <>
      <div className={s.subTabNav}>
        {(['groupBacktest', 'icAnalysis', 'regression'] as const).map((tab) => (
          <button
            key={tab}
            className={`${s.subTabButton} ${subTab === tab ? s.active : ''}`}
            onClick={() => setSubTab(tab)}
            type="button"
          >
            {u[tab]}
          </button>
        ))}
      </div>

      {subTab === 'groupBacktest' && <GroupBacktestView report={report} ui={ui} />}
      {subTab === 'icAnalysis' && <IcAnalysisView report={report} ui={ui} />}
      {subTab === 'regression' && <RegressionView report={report} ui={ui} />}
    </>
  );
}

function GroupBacktestView({ report, ui }: Props) {
  const gb = report.groupBacktest;
  const maxReturn = Math.max(...gb.groupAnnualReturns.map((g) => Math.abs(g.annualReturn)));

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Long-Short Return</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{(gb.longShortReturn * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Long-Short Sharpe</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{gb.longShortSharpe.toFixed(2)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Top Excess Return</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{(gb.topExcessReturn * 100).toFixed(1)}%</div>
        </div>
      </div>

      <FactorReportSection title="Group Annual Returns" defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {gb.groupAnnualReturns.map((g) => (
            <div key={g.group} className={s.barRow}>
              <span className={s.barLabel}>{g.group}</span>
              <div className={s.barTrack}>
                <div
                  className={`${s.barFill} ${g.annualReturn < 0 ? s.negative : ''}`}
                  style={{ width: `${(Math.abs(g.annualReturn) / maxReturn) * 100}%` }}
                />
              </div>
              <span className={s.barValue}>{(g.annualReturn * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title="Group Metrics" defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>Group</th><th>Sharpe</th><th>Max DD</th><th>Win Rate</th></tr>
          </thead>
          <tbody>
            {gb.groupMetrics.map((g) => (
              <tr key={g.group}>
                <td>{g.group}</td>
                <td>{g.sharpe.toFixed(2)}</td>
                <td>{(g.maxDrawdown * 100).toFixed(1)}%</td>
                <td>{(g.winRate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title="Long-Short NAV Curve" defaultOpen={true}>
        <svg className={s.svgChart} viewBox="0 0 400 120" preserveAspectRatio="none">
          {gb.longShortNavCurve.map((point, i, arr) => {
            if (i === 0) return null;
            const prev = arr[i - 1];
            const x1 = prev.t * 380 + 10;
            const y1 = 110 - (prev.nav - 0.9) / 0.4 * 100;
            const x2 = point.t * 380 + 10;
            const y2 = 110 - (point.nav - 0.9) / 0.4 * 100;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--green)" strokeWidth="2" />;
          })}
        </svg>
      </FactorReportSection>
    </>
  );
}

function IcAnalysisView({ report }: Props) {
  const ic = report.icAnalysis;
  const maxAbsIc = Math.max(...ic.icSeries.map((s) => Math.abs(s.ic)), 0.001);
  const maxDecay = Math.max(...ic.icDecay.map((d) => Math.abs(d.ic)), 0.001);
  const maxDistCount = Math.max(...ic.icMonthlyDistribution.map((d) => d.count));

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>IC Mean</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{ic.icMean.toFixed(3)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>IC Std</div>
          <div className={s.kpiValue}>{ic.icStd.toFixed(3)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>IC Win Rate</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{(ic.icWinRate * 100).toFixed(0)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Rank IC Mean</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{ic.rankIcMean.toFixed(3)}</div>
        </div>
      </div>

      <FactorReportSection title="IC Time Series" defaultOpen={true}>
        <div className={s.barChartVertical}>
          {ic.icSeries.map((item) => (
            <div
              key={item.date}
              className={s.vBar}
              style={{
                height: `${(Math.abs(item.ic) / maxAbsIc) * 100}%`,
                background: item.ic >= 0 ? 'rgba(77, 240, 160, 0.5)' : 'rgba(255, 107, 107, 0.5)',
              }}
              title={`${item.date}: IC=${item.ic.toFixed(3)}, RankIC=${item.rankIc.toFixed(3)}`}
            >
              <span className={s.vBarLabel}>{item.date.slice(-2)}</span>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title="IC Decay" defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {ic.icDecay.map((d) => (
            <div key={d.lag} className={s.barRow}>
              <span className={s.barLabel}>{d.lag}</span>
              <div className={s.barTrack}>
                <div className={s.barFill} style={{ width: `${(Math.abs(d.ic) / maxDecay) * 100}%` }} />
              </div>
              <span className={s.barValue}>{d.ic.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title="IC Monthly Distribution" defaultOpen={true}>
        <div className={s.barChartVertical}>
          {ic.icMonthlyDistribution.map((d) => (
            <div
              key={d.bin}
              className={s.vBar}
              style={{ height: `${(d.count / maxDistCount) * 100}%` }}
              title={`${d.bin}: ${d.count}`}
            >
              <span className={s.vBarLabel}>{d.bin}</span>
            </div>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}

function RegressionView({ report }: Props) {
  const reg = report.regression;

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Factor Return</div>
          <div className={`${s.kpiValue} ${s.positive}`}>{(reg.factorReturn * 100).toFixed(2)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>t-Stat</div>
          <div className={`${s.kpiValue} ${Math.abs(reg.tStat) > 2 ? s.positive : ''}`}>{reg.tStat.toFixed(2)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Newey-West t</div>
          <div className={`${s.kpiValue} ${Math.abs(reg.neweyWestT) > 2 ? s.positive : ''}`}>{reg.neweyWestT.toFixed(2)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>R-Squared</div>
          <div className={s.kpiValue}>{(reg.rSquared * 100).toFixed(1)}%</div>
        </div>
        {reg.grsStat !== null && (
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>GRS Stat</div>
            <div className={s.kpiValue}>{reg.grsStat.toFixed(2)}</div>
          </div>
        )}
        {reg.grsPValue !== null && (
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>GRS p-value</div>
            <div className={s.kpiValue}>{reg.grsPValue.toFixed(3)}</div>
          </div>
        )}
      </div>

      <FactorReportSection title="Factor Return Series" defaultOpen={true}>
        <svg className={s.svgChart} viewBox="0 0 400 120" preserveAspectRatio="none">
          {reg.factorReturnSeries.map((point, i, arr) => {
            if (i === 0) return null;
            const prev = arr[i - 1];
            const x1 = ((i - 1) / (arr.length - 1)) * 380 + 10;
            const y1 = 60 - (prev.ret / 0.006) * 50;
            const x2 = (i / (arr.length - 1)) * 380 + 10;
            const y2 = 60 - (point.ret / 0.006) * 50;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--green)" strokeWidth="2" />;
          })}
          <line x1="10" y1="60" x2="390" y2="60" stroke="var(--line)" strokeWidth="1" strokeDasharray="4" />
        </svg>
      </FactorReportSection>
    </>
  );
}
