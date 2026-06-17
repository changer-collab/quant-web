import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS, fmtPct } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-metrics.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 风险子弹图 — 最大回撤 / VaR / 波动率 */
function RiskBullets({ report, ui }: Props) {
  const m = report.riskMetrics;

  const option = useMemo<EChartsOption>(() => {
    const dd = m.maxDrawdown * 100;
    const varVal = Math.abs(m.var95) * 100;
    const vol = m.annualizedVolatility * 100;

    // 动态计算刻度上限：以实际值为锚点向上取整
    const ceil = (v: number, step: number) => Math.ceil(v / step) * step;
    const ddMax = Math.max(ceil(dd, 5), 10);
    const varMax = Math.max(ceil(varVal, 2), 4);
    const volMax = Math.max(ceil(vol, 5), 10);

    const categories = ['最大回撤', 'VaR(95%)', '年化波动率'];
    const values = [dd, varVal, vol];
    const maxes = [ddMax, varMax, volMax];

    // 风险等级色：低<30% 绿 / 中30-60% 黄 / 高>60% 红
    const barColor = (v: number, max: number) => {
      const ratio = v / max;
      return ratio < 0.3 ? '#4df0a0' : ratio < 0.6 ? '#e9c46a' : '#ff6b6b';
    };

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter(params: unknown) {
          const ps = Array.isArray(params) ? params : [params];
          const val = ps.find((p) => (p as { seriesName: string }).seriesName === '实际值');
          if (!val) return '';
          const it = val as { name: string; value: number };
          return `${it.name}: <b>${it.value.toFixed(1)}%</b>`;
        },
      },
      grid: { top: 8, right: 64, bottom: 8, left: 90 },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: { fontSize: 11, color: '#8fa29b', fontWeight: 600 },
        axisTick: { show: false },
      },
      series: [
        // 背景轨道（满刻度）
        {
          name: '参考区间',
          type: 'bar',
          data: maxes.map((max, i) => ({
            value: max,
            itemStyle: {
              color: 'rgba(38, 54, 50, 0.35)',
              borderRadius: [0, 3, 3, 0],
            },
          })),
          barWidth: 24,
          barGap: '-100%',
          silent: true,
          animation: false,
        },
        // 低风险区间标记线
        {
          name: '低风险线',
          type: 'bar',
          data: maxes.map((max) => ({
            value: max * 0.3,
            itemStyle: { color: 'transparent' },
          })),
          barWidth: 0,
          barGap: '-100%',
          silent: true,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(77, 240, 160, 0.3)', width: 1, type: 'dashed' },
            data: maxes.map((max, i) => ({ xAxis: max * 0.3, yAxis: i })),
          },
        },
        // 高风险区间标记线
        {
          name: '高风险线',
          type: 'bar',
          data: maxes.map((max) => ({
            value: max * 0.6,
            itemStyle: { color: 'transparent' },
          })),
          barWidth: 0,
          barGap: '-100%',
          silent: true,
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(255, 107, 107, 0.3)', width: 1, type: 'dashed' },
            data: maxes.map((max, i) => ({ xAxis: max * 0.6, yAxis: i })),
          },
        },
        // 实际值柱
        {
          name: '实际值',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: barColor(v, maxes[i]),
              borderRadius: [0, 3, 3, 0],
            },
          })),
          barWidth: 14,
          barGap: '-100%',
          label: {
            show: true,
            position: 'right' as const,
            fontSize: 11,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            fontWeight: 700,
            color: '#8fa29b',
            formatter(params: unknown) {
              const p = params as { value: number };
              return `${p.value.toFixed(1)}%`;
            },
          },
          z: 10,
        },
      ],
    };
  }, [m]);

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>风险概览</h4>
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

/** 回撤水位线图 */
function DrawdownWaterfall({ report, ui }: Props) {
  const dd = report.equityData.drawdownCurve;

  const option = useMemo<EChartsOption>(() => {
    if (dd.length === 0) return {};

    const dates = dd.map((d) => new Date(d.timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; value: number };
          return `${it.name}<br/>回撤: <b>${(it.value * 100).toFixed(1)}%</b>`;
        },
      },
      grid: { top: 8, right: 16, bottom: 24, left: 56 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 9, color: '#8fa29b', rotate: 30 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        min: undefined,
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }],
      visualMap: {
        show: false,
        pieces: [
          { lte: -0.2, color: '#ff6b6b' },
          { lte: -0.1, color: '#e9c46a' },
          { gt: -0.1, color: '#4df0a0' },
        ],
      },
      series: [
        {
          type: 'line',
          data: dd.map((d) => d.drawdown),
          lineStyle: { width: 1.5 },
          areaStyle: { opacity: 0.3 },
          showSymbol: false,
        },
      ],
    };
  }, [dd]);

  if (dd.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>回撤水位线</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 200 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export function ReportRiskMetrics({ report, ui }: Props) {
  const m = report.riskMetrics;
  const labels = ui.riskMetrics;

  const cards = [
    { label: labels.maxDrawdown, value: pct(m.maxDrawdown), tone: 'warn' },
    { label: labels.drawdownDuration, value: `${m.maxDrawdownDuration} 天`, tone: m.maxDrawdownDuration > 60 ? 'warn' : 'info' },
    { label: labels.annualizedVolatility, value: pct(m.annualizedVolatility), tone: 'info' },
    { label: labels.downsideVolatility, value: pct(m.downsideVolatility), tone: 'info' },
    { label: labels.var, value: pct(m.var95), tone: 'warn' },
    { label: labels.cvar, value: pct(m.cvar95), tone: 'warn' },
    { label: labels.calmar, value: m.calmarRatio.toFixed(2), tone: m.calmarRatio > 1 ? 'good' : 'warn' },
  ];

  return (
    <div>
      {/* 风险子弹图 */}
      <RiskBullets report={report} ui={ui} />

      {/* 指标卡片 */}
      <div className={styles.metricGrid}>
        {cards.map((card) => (
          <article key={card.label} className={`${styles.metricCard} ${styles[`tone${card.tone}`]}`}>
            <span className={styles.metricLabel}>{card.label}</span>
            <strong className={styles.metricValue}>{card.value}</strong>
          </article>
        ))}
      </div>

      {/* 回撤水位线 */}
      <DrawdownWaterfall report={report} ui={ui} />
    </div>
  );
}
