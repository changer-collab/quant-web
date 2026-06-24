import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-substrategy.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 子策略独立对比柱状图 */
function ComparisonChart({ report, ui }: Props) {
  const data = report.subStrategyAttribution.independentComparison;
  const labels = ui.chartLabels;

  const option = useMemo<EChartsOption>(() => {
    if (data.length === 0) return {};
    return {
      tooltip: { ...CHART_DEFAULTS.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: [labels.annualizedReturn, labels.maxDrawdown, labels.sharpe], textStyle: { color: '#8fa29b', fontSize: 10 }, top: 0 },
      grid: { top: 32, right: 16, bottom: 24, left: 48 },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.name),
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        { name: labels.annualizedReturn, type: 'bar', data: data.map((d) => +(d.annualizedReturn * 100).toFixed(1)), itemStyle: { color: '#4df0a0' } },
        { name: labels.maxDrawdown, type: 'bar', data: data.map((d) => +(d.maxDrawdown * 100).toFixed(1)), itemStyle: { color: '#ff6b6b' } },
        { name: labels.sharpe, type: 'bar', data: data.map((d) => d.sharpe), itemStyle: { color: '#62d8ff' } },
      ],
    };
  }, [data, labels]);

  if (data.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 240 }} notMerge lazyUpdate />
    </div>
  );
}

/** 时序归因堆叠柱状图 */
function TimeSeriesChart({ report }: Props) {
  const ts = report.subStrategyAttribution.timeSeriesAttribution;

  const option = useMemo<EChartsOption>(() => {
    if (ts.length === 0) return {};
    const modules = ts[0].contributions.map((c) => c.module);
    return {
      tooltip: { ...CHART_DEFAULTS.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: modules, textStyle: { color: '#8fa29b', fontSize: 10 }, top: 0 },
      grid: { top: 32, right: 16, bottom: 24, left: 48 },
      xAxis: {
        type: 'category',
        data: ts.map((t) => t.period),
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: modules.map((mod, i) => ({
        name: mod,
        type: 'bar',
        stack: 'total',
        data: ts.map((t) => {
          const c = t.contributions.find((c) => c.module === mod);
          return c ? +(c.value * 100).toFixed(2) : 0;
        }),
        itemStyle: { color: ['#4df0a0', '#62d8ff', '#e9c46a'][i % 3] },
      })),
    };
  }, [ts]);

  if (ts.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 240 }} notMerge lazyUpdate />
    </div>
  );
}

export function ReportSubStrategyAttribution({ report, ui }: Props) {
  const s = report.subStrategyAttribution;
  const labels = ui.subStrategyAttribution;

  return (
    <section className={styles.panel}>
      {/* 独立对比 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.independentComparison}</h4>
        <ComparisonChart report={report} ui={ui} />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{labels.module}</th>
                <th>{ui.chartLabels.annualizedReturn}</th>
                <th>{ui.chartLabels.annualizedVolatility}</th>
                <th>{ui.chartLabels.maxDrawdown}</th>
                <th>{ui.chartLabels.sharpe}</th>
              </tr>
            </thead>
            <tbody>
              {s.independentComparison.map((item) => (
                <tr key={item.name}>
                  <td className={styles.nameCell}>{item.name}</td>
                  <td className={styles.numCell}>{pct(item.annualizedReturn)}</td>
                  <td className={styles.numCell}>{pct(item.annualizedVolatility)}</td>
                  <td className={styles.numCell}>{pct(item.maxDrawdown)}</td>
                  <td className={styles.numCell}>{item.sharpe.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 边际贡献 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.marginalContributions}</h4>
        <div className={styles.contributionGrid}>
          {s.marginalContributions.map((mc) => (
            <div key={mc.module} className={styles.contributionCard}>
              <span className={styles.contributionLabel}>{mc.module}</span>
              <strong className={styles.contributionValue}>{pct(mc.contribution)}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* 时序归因 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.timeSeriesAttribution}</h4>
        <TimeSeriesChart report={report} ui={ui} />
      </div>

      {/* 交互效应 */}
      <div className={styles.interactionBlock}>
        <span className={styles.interactionLabel}>{labels.interactionEffect}</span>
        <strong className={styles.interactionValue}>{pct(s.interactionEffect)}</strong>
      </div>
    </section>
  );
}
