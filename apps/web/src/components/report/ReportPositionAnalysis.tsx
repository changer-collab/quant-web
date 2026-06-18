import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-position.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 仓位时序曲线 */
function PositionCurveChart({ report }: Props) {
  const curve = report.positionAnalysis.positionCurve;

  const option = useMemo<EChartsOption>(() => {
    if (curve.length === 0) return {};
    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; value: number };
          return `${it.name}<br/>仓位: <b>${(it.value * 100).toFixed(1)}%</b>`;
        },
      },
      grid: { top: 16, right: 16, bottom: 32, left: 48 },
      xAxis: {
        type: 'category',
        data: curve.map((d) => new Date(d.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
        axisLabel: { fontSize: 9, color: '#8fa29b', rotate: 30 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 1,
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      series: [
        {
          type: 'line',
          data: curve.map((d) => d.position),
          lineStyle: { color: '#62d8ff', width: 1.5 },
          areaStyle: { color: 'rgba(98, 216, 255, 0.12)' },
          itemStyle: { color: '#62d8ff' },
          showSymbol: false,
        },
      ],
    };
  }, [curve]);

  if (curve.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 200 }} notMerge lazyUpdate />
    </div>
  );
}

/** 仓位分布饼图 */
function PositionDistributionChart({ report }: Props) {
  const dist = report.positionAnalysis.positionDistribution;

  const option = useMemo<EChartsOption>(() => {
    if (dist.length === 0) return {};
    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'item',
        formatter: '{b}: {d}%',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          data: dist.map((d) => ({ name: d.level, value: d.ratio })),
          label: { fontSize: 10, color: '#8fa29b' },
          itemStyle: { borderColor: '#0b1410', borderWidth: 2 },
        },
      ],
    };
  }, [dist]);

  if (dist.length === 0) return null;
  return (
    <div className={styles.chartSection}>
      <ReactEChartsCore echarts={echarts} option={option} theme="quant-dark" style={{ height: 200 }} notMerge lazyUpdate />
    </div>
  );
}

export function ReportPositionAnalysis({ report, ui }: Props) {
  const p = report.positionAnalysis;
  const labels = ui.positionAnalysis;

  const cards = [
    { label: labels.avgPositionLevel, value: pct(p.avgPositionLevel) },
    { label: labels.maxSinglePosition, value: pct(p.maxSinglePosition) },
    { label: labels.adjustmentFrequency, value: `${p.adjustmentFrequency} 天` },
  ];

  return (
    <section className={styles.panel}>
      {/* 指标卡片 */}
      <div className={styles.metricGrid}>
        {cards.map((card) => (
          <article key={card.label} className={styles.metricCard}>
            <span className={styles.metricLabel}>{card.label}</span>
            <strong className={styles.metricValue}>{card.value}</strong>
          </article>
        ))}
      </div>

      {/* 仓位分布 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.positionDistribution}</h4>
        <PositionDistributionChart report={report} ui={ui} />
      </div>

      {/* 仓位时序 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.positionCurve}</h4>
        <PositionCurveChart report={report} ui={ui} />
      </div>

      {/* 仓位与波动关系 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.volatilityRelation}</h4>
        <p className={styles.descText}>{p.volatilityRelation}</p>
      </div>

      {/* 加减仓行为 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.positionAdjustments}</h4>
        <div className={styles.adjustGrid}>
          <div className={styles.adjustItem}>
            <span className={styles.adjustLabel}>{labels.profitAdd}</span>
            <span className={styles.adjustValue}>{p.positionAdjustments.profitAddCount} 次</span>
            <span className={styles.adjustEffect}>+{pct(p.positionAdjustments.profitAddEffect)}</span>
          </div>
          <div className={styles.adjustItem}>
            <span className={styles.adjustLabel}>{labels.lossAdd}</span>
            <span className={styles.adjustValue}>{p.positionAdjustments.lossAddCount} 次</span>
            <span className={styles.adjustEffect}>{pct(p.positionAdjustments.lossAddEffect)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
