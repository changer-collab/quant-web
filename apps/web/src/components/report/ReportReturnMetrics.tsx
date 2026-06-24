import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-metrics.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 策略收益条形图（不含基准对比，基准比较在独立模块展示） */
function ReturnChart({ report, ui }: Props) {
  const m = report.returnMetrics;
  const labels = ui.chartLabels;

  const option = useMemo<EChartsOption>(() => {
    const items = [
      { name: labels.cumulativeReturn, value: m.cumulativeReturn * 100 },
      { name: labels.annualizedReturn, value: m.annualizedReturn * 100 },
      { name: 'Alpha', value: m.alpha * 100 },
    ];

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const ps = Array.isArray(params) ? params : [params];
          const p = ps[0] as { name: string; value: number; marker: string };
          return `${p.name}<br/>${p.marker} <b>${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%</b>`;
        },
      },
      grid: { top: 16, right: 48, bottom: 8, left: 80 },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v.toFixed(0)}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      yAxis: {
        type: 'category',
        data: items.map((i) => i.name),
        axisLabel: { fontSize: 11, color: '#8fa29b' },
        axisTick: { show: false },
      },
      series: [
        {
          name: labels.strategy,
          type: 'bar',
          data: items.map((i) => ({
            value: i.value,
            itemStyle: {
              color: i.value >= 0 ? '#4df0a0' : '#ff6b6b',
              borderRadius: i.value >= 0 ? [0, 2, 2, 0] : [2, 0, 0, 2],
            },
          })),
          barWidth: 14,
          label: {
            show: true,
            position: 'right',
            fontSize: 9,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            fontWeight: 600,
            color: '#8fa29b',
            formatter(params: unknown) {
              const p = params as { value: number };
              return `${p.value >= 0 ? '+' : ''}${p.value.toFixed(1)}%`;
            },
          },
        },
      ],
    };
  }, [m, labels]);

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.returnComparison}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 140 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

/** 风险调整后收益雷达图 */
function RiskAdjustedRadar({ report, ui }: Props) {
  const rm = report.returnMetrics;
  const rkm = report.riskMetrics;
  const ram = report.riskAdjMetrics;
  const labels = ui.chartLabels;

  const option = useMemo<EChartsOption>(() => {
    // 归一化各指标到 0~100 分
    const sharpeScore = Math.min(Math.max(ram.sharpeRatio / 3 * 100, 0), 100);
    const sortinoScore = Math.min(Math.max(ram.sortinoRatio / 4 * 100, 0), 100);
    const calmarScore = Math.min(Math.max(rkm.calmarRatio / 3 * 100, 0), 100);
    const infoScore = Math.min(Math.max(ram.informationRatio / 2 * 100, 0), 100);
    const treynorScore = Math.min(Math.max(ram.treynorRatio / 1 * 100, 0), 100);
    const alphaScore = Math.min(Math.max(rm.alpha / 0.2 * 100, 0), 100);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
      },
      radar: {
        indicator: [
          { name: labels.sharpe, max: 100 },
          { name: 'Sortino', max: 100 },
          { name: 'Calmar', max: 100 },
          { name: 'Info', max: 100 },
          { name: 'Treynor', max: 100 },
          { name: 'Alpha', max: 100 },
        ],
        shape: 'polygon',
        splitNumber: 4,
        axisName: { color: '#8fa29b', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.5)' } },
        splitArea: { areaStyle: { color: ['rgba(8,16,15,0.2)', 'rgba(8,16,15,0.4)'] } },
        axisLine: { lineStyle: { color: 'rgba(38,54,50,0.5)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: [sharpeScore, sortinoScore, calmarScore, infoScore, treynorScore, alphaScore],
              name: labels.strategy,
              lineStyle: { color: '#4df0a0', width: 2 },
              itemStyle: { color: '#4df0a0' },
              areaStyle: { color: 'rgba(77, 240, 160, 0.15)' },
            },
          ],
        },
      ],
    };
  }, [rm, rkm, ram, labels]);

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.riskAdjReturn}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 260 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export function ReportReturnMetrics({ report, ui }: Props) {
  const m = report.returnMetrics;
  const labels = ui.returnMetrics;

  const cards = [
    { label: labels.cumulativeReturn, value: pct(m.cumulativeReturn), tone: m.cumulativeReturn > 0 ? 'good' : 'warn' },
    { label: labels.totalReturn, value: pct(m.totalReturn), tone: m.totalReturn > 0 ? 'good' : 'warn' },
    { label: labels.annualizedReturn, value: pct(m.annualizedReturn), tone: m.annualizedReturn > 0 ? 'good' : 'warn' },
    { label: labels.alpha, value: pct(m.alpha), tone: m.alpha > 0 ? 'good' : 'warn' },
  ];

  return (
    <div>
      {/* 策略收益条形图 */}
      <ReturnChart report={report} ui={ui} />

      {/* 指标卡片 */}
      <div className={styles.metricGrid}>
        {cards.map((card) => (
          <article key={card.label} className={`${styles.metricCard} ${styles[`tone${card.tone}`]}`}>
            <span className={styles.metricLabel}>{card.label}</span>
            <strong className={styles.metricValue}>{card.value}</strong>
          </article>
        ))}
      </div>

      {/* 风险调整后收益雷达图 */}
      <RiskAdjustedRadar report={report} ui={ui} />
    </div>
  );
}
