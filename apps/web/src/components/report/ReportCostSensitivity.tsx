import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-cost.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 滑点敏感性曲线 */
function SlippageChart({ report, ui }: Props) {
  const data = report.costSensitivity.slippageSensitivity;
  const labels = ui.chartLabels;

  const option = useMemo<EChartsOption>(() => {
    if (data.length === 0) return {};
    return {
      tooltip: { ...CHART_DEFAULTS.tooltip, trigger: 'axis' },
      legend: { data: [labels.annualizedReturn, labels.sharpe], textStyle: { color: '#8fa29b', fontSize: 10 }, top: 0 },
      grid: { top: 32, right: 48, bottom: 32, left: 48 },
      xAxis: {
        type: 'category',
        name: ui.costSensitivity.slippage + '(bp)',
        nameTextStyle: { color: '#8fa29b', fontSize: 10 },
        data: data.map((d) => d.slippageBp),
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: labels.returnRate,
          nameTextStyle: { color: '#8fa29b', fontSize: 10 },
          axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v}%` },
          splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
        },
        {
          type: 'value',
          name: labels.sharpe,
          nameTextStyle: { color: '#8fa29b', fontSize: 10 },
          axisLabel: { fontSize: 10, color: '#8fa29b' },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: labels.annualizedReturn,
          type: 'line',
          data: data.map((d) => +(d.annualizedReturn * 100).toFixed(1)),
          lineStyle: { color: '#4df0a0', width: 2 },
          itemStyle: { color: '#4df0a0' },
          symbol: 'circle',
          symbolSize: 6,
        },
        {
          name: labels.sharpe,
          type: 'line',
          yAxisIndex: 1,
          data: data.map((d) => d.sharpe),
          lineStyle: { color: '#62d8ff', width: 2 },
          itemStyle: { color: '#62d8ff' },
          symbol: 'circle',
          symbolSize: 6,
        },
      ],
    };
  }, [data]);

  if (data.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 240 }} notMerge lazyUpdate />
    </div>
  );
}

export function ReportCostSensitivity({ report, ui }: Props) {
  const c = report.costSensitivity;
  const labels = ui.costSensitivity;
  const ca = c.costAssumption;

  return (
    <section className={styles.panel}>
      {/* 成本假设 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.costAssumption}</h4>
        <div className={styles.assumptionGrid}>
          <div className={styles.assumptionItem}>
            <span className={styles.assumptionLabel}>{labels.commission}</span>
            <span className={styles.assumptionValue}>{ca.commission}‱</span>
          </div>
          <div className={styles.assumptionItem}>
            <span className={styles.assumptionLabel}>{labels.stampTax}</span>
            <span className={styles.assumptionValue}>{ca.stampTax}‱</span>
          </div>
          <div className={styles.assumptionItem}>
            <span className={styles.assumptionLabel}>{labels.slippage}</span>
            <span className={styles.assumptionValue}>{ca.slippage} bp</span>
          </div>
          <div className={styles.assumptionItem}>
            <span className={styles.assumptionLabel}>{labels.impactCost}</span>
            <span className={styles.assumptionValue}>{ca.impactCost} bp</span>
          </div>
        </div>
      </div>

      {/* 扣除成本前后对比 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.beforeAfterCost}</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>指标</th>
                <th>{labels.beforeCost}</th>
                <th>{labels.afterCost}</th>
              </tr>
            </thead>
            <tbody>
              {c.beforeAfterCost.map((row) => (
                <tr key={row.metric}>
                  <td className={styles.nameCell}>{row.metric}</td>
                  <td className={styles.numCell}>{typeof row.beforeCost === 'number' && row.beforeCost < 1 ? pct(row.beforeCost) : row.beforeCost}</td>
                  <td className={styles.numCell}>{typeof row.afterCost === 'number' && row.afterCost < 1 ? pct(row.afterCost) : row.afterCost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 成本拖累 */}
      <div className={styles.dragBlock}>
        <span className={styles.dragLabel}>{labels.costDragRatio}</span>
        <strong className={styles.dragValue}>{pct(c.costDragRatio)}</strong>
        <span className={styles.dragLabel}>{labels.annualTurnover}</span>
        <strong className={styles.dragValue}>{c.annualTurnover}x</strong>
      </div>

      {/* 滑点敏感性 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.slippageSensitivity}</h4>
        <SlippageChart report={report} ui={ui} />
      </div>
    </section>
  );
}
