import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-stress.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 历史场景对比柱状图 */
function ScenariosChart({ report }: Props) {
  const scenarios = report.stressTest.scenarios;

  const option = useMemo<EChartsOption>(() => {
    if (scenarios.length === 0) return {};
    return {
      tooltip: { ...CHART_DEFAULTS.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['策略回撤', '基准回撤'], textStyle: { color: '#8fa29b', fontSize: 10 }, top: 0 },
      grid: { top: 32, right: 16, bottom: 24, left: 56 },
      xAxis: {
        type: 'category',
        data: scenarios.map((s) => s.name),
        axisLabel: { fontSize: 10, color: '#8fa29b', rotate: 15 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        { name: '策略回撤', type: 'bar', data: scenarios.map((s) => +(s.strategyDrawdown * 100).toFixed(1)), itemStyle: { color: '#4df0a0' } },
        { name: '基准回撤', type: 'bar', data: scenarios.map((s) => +(s.benchmarkDrawdown * 100).toFixed(1)), itemStyle: { color: '#ff6b6b' } },
      ],
    };
  }, [scenarios]);

  if (scenarios.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 240 }} notMerge lazyUpdate />
    </div>
  );
}

export function ReportStressTest({ report, ui }: Props) {
  const s = report.stressTest;
  const labels = ui.stressTest;
  const mc = s.monteCarlo;

  return (
    <section className={styles.panel}>
      {/* 历史极端场景 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.scenarios}</h4>
        <ScenariosChart report={report} ui={ui} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{labels.scenarioName}</th>
                <th>{labels.period}</th>
                <th>{labels.strategyDrawdown}</th>
                <th>{labels.benchmarkDrawdown}</th>
                <th>{labels.recoveryDays}</th>
                <th>{labels.note}</th>
              </tr>
            </thead>
            <tbody>
              {s.scenarios.map((sc) => (
                <tr key={sc.name}>
                  <td className={styles.nameCell}>{sc.name}</td>
                  <td>{sc.period}</td>
                  <td className={`${styles.numCell} ${styles.cellRisk}`}>{pct(sc.strategyDrawdown)}</td>
                  <td className={`${styles.numCell} ${styles.cellRisk}`}>{pct(sc.benchmarkDrawdown)}</td>
                  <td className={styles.numCell}>{sc.recoveryDays}</td>
                  <td className={styles.noteCell}>{sc.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 蒙特卡洛模拟 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.monteCarlo}</h4>
        <div className={styles.mcGrid}>
          <div className={styles.mcCard}>
            <span className={styles.mcLabel}>{labels.simulatedPaths}</span>
            <strong className={styles.mcValue}>{mc.simulatedPaths.toLocaleString()}</strong>
          </div>
          <div className={styles.mcCard}>
            <span className={styles.mcLabel}>{labels.medianReturn}</span>
            <strong className={`${styles.mcValue} ${styles.mcGood}`}>{pct(mc.medianReturn)}</strong>
          </div>
          <div className={styles.mcCard}>
            <span className={styles.mcLabel}>{labels.percentile5}</span>
            <strong className={`${styles.mcValue} ${styles.mcWarn}`}>{pct(mc.percentile5)}</strong>
          </div>
          <div className={styles.mcCard}>
            <span className={styles.mcLabel}>{labels.percentile95}</span>
            <strong className={`${styles.mcValue} ${styles.mcGood}`}>{pct(mc.percentile95)}</strong>
          </div>
          <div className={styles.mcCard}>
            <span className={styles.mcLabel}>{labels.probPositiveReturn}</span>
            <strong className={styles.mcValue}>{pct(mc.probPositiveReturn)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
