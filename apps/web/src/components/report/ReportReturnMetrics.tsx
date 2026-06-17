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

/** 收益对比条形图 - 策略 vs 基准 */
function ReturnComparison({ report, ui }: Props) {
  const m = report.returnMetrics;

  const option = useMemo<EChartsOption>(() => {
    const items = [
      { name: '累计收益', strategy: m.cumulativeReturn * 100, benchmark: m.benchmarkReturn * 100 },
      { name: '年化收益', strategy: m.annualizedReturn * 100, benchmark: m.benchmarkReturn * 100 },
      { name: '超额收益', strategy: m.alpha * 100, benchmark: 0 },
    ];

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const ps = Array.isArray(params) ? params : [params];
          let tip = (ps[0] as { name: string }).name;
          ps.forEach((p) => {
            const it = p as { seriesName: string; value: number; marker: string };
            tip += `<br/>${it.marker} ${it.seriesName}: <b>${it.value >= 0 ? '+' : ''}${it.value.toFixed(1)}%</b>`;
          });
          return tip;
        },
      },
      legend: {
        data: ['策略', '基准'],
        top: 0,
        right: 0,
        textStyle: { color: '#8fa29b', fontSize: 11 },
      },
      grid: { top: 32, right: 16, bottom: 8, left: 80 },
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
          name: '策略',
          type: 'bar',
          data: items.map((i) => ({
            value: i.strategy,
            itemStyle: {
              color: i.strategy >= 0 ? '#4df0a0' : '#ff6b6b',
              borderRadius: i.strategy >= 0 ? [0, 2, 2, 0] : [2, 0, 0, 2],
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
        {
          name: '基准',
          type: 'bar',
          data: items.map((i) => ({
            value: i.benchmark,
            itemStyle: {
              color: '#62d8ff',
              borderRadius: i.benchmark >= 0 ? [0, 2, 2, 0] : [2, 0, 0, 2],
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
  }, [m]);

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>收益对比</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 160 }}
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
          { name: '夏普比率', max: 100 },
          { name: '索提诺比率', max: 100 },
          { name: '卡尔玛比率', max: 100 },
          { name: '信息比率', max: 100 },
          { name: '特雷诺比率', max: 100 },
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
              name: '策略',
              lineStyle: { color: '#4df0a0', width: 2 },
              itemStyle: { color: '#4df0a0' },
              areaStyle: { color: 'rgba(77, 240, 160, 0.15)' },
            },
          ],
        },
      ],
    };
  }, [rm, rkm, ram]);

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>风险调整后收益</h4>
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
    { label: labels.benchmarkReturn, value: pct(m.benchmarkReturn), tone: 'info' },
  ];

  return (
    <div>
      {/* 收益对比条形图 */}
      <ReturnComparison report={report} ui={ui} />

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
