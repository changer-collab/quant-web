import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS, fmtPct } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-tables.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function currency(v: number): string {
  return v.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 0 });
}

/** 盈亏分布直方图 */
function PnlHistogram({ report, ui }: Props) {
  const ts = report.tradeStats;
  const labels = ui.tradeStats;
  const pnlData = ts.pnlDistribution ?? [];

  const option = useMemo<EChartsOption>(() => {
    if (pnlData.length === 0) return {};

    // 分桶：按 2% 间隔
    const min = Math.floor(Math.min(...pnlData) / 2) * 2;
    const max = Math.ceil(Math.max(...pnlData) / 2) * 2;
    const bins: { range: string; count: number; isProfit: boolean }[] = [];

    for (let lo = min; lo < max; lo += 2) {
      const hi = lo + 2;
      const count = pnlData.filter((v) => v >= lo && v < hi).length;
      bins.push({
        range: `${lo >= 0 ? '+' : ''}${lo}%~${hi >= 0 ? '+' : ''}${hi}%`,
        count,
        isProfit: lo >= 0,
      });
    }

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; value: number };
          return `${it.name}<br/>交易笔数: <b>${it.value}</b>`;
        },
      },
      grid: { top: 16, right: 16, bottom: 28, left: 40 },
      xAxis: {
        type: 'category',
        data: bins.map((b) => b.range),
        axisLabel: { fontSize: 9, color: '#8fa29b', rotate: 30 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        {
          type: 'bar',
          data: bins.map((b) => ({
            value: b.count,
            itemStyle: {
              color: b.isProfit ? '#4df0a0' : '#ff6b6b',
              borderRadius: b.isProfit ? [2, 2, 0, 0] : [0, 0, 2, 2],
            },
          })),
          barWidth: '60%',
        },
      ],
    };
  }, [pnlData]);

  if (pnlData.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.pnlDistribution ?? '盈亏分布'}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 240 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export function ReportTradeStats({ report, ui }: Props) {
  const ts = report.tradeStats;
  const labels = ui.tradeStats;

  const stats = [
    { label: labels.totalTrades, value: (ts.totalTrades ?? 0).toString(), tone: 'info' },
    { label: labels.winRate, value: pct(ts.winRate ?? 0), tone: (ts.winRate ?? 0) > 0.5 ? 'good' : 'warn' },
    ...(ts.profitLossRatio != null ? [{ label: labels.profitLossRatio, value: ts.profitLossRatio.toFixed(2), tone: ts.profitLossRatio > 1.5 ? 'good' as const : 'info' as const }] : []),
    ...(ts.avgHoldingDays != null ? [{ label: labels.avgHolding, value: `${ts.avgHoldingDays} 天`, tone: 'info' as const }] : []),
    ...(ts.turnoverRate != null ? [{ label: labels.turnover, value: pct(ts.turnoverRate), tone: ts.turnoverRate > 0.5 ? 'warn' as const : 'info' as const }] : []),
    ...(ts.maxSingleProfit != null ? [{ label: labels.maxProfit, value: currency(ts.maxSingleProfit), tone: 'good' as const }] : []),
    ...(ts.maxSingleLoss != null ? [{ label: labels.maxLoss, value: currency(Math.abs(ts.maxSingleLoss)), tone: 'warn' as const }] : []),
    ...(ts.maxConsecutiveWins !== undefined && ts.maxConsecutiveWins != null ? [{ label: labels.maxConsecutiveWins, value: `${ts.maxConsecutiveWins} 次`, tone: 'good' as const }] : []),
    ...(ts.maxConsecutiveLosses !== undefined && ts.maxConsecutiveLosses != null ? [{ label: labels.maxConsecutiveLosses, value: `${ts.maxConsecutiveLosses} 次`, tone: 'warn' as const }] : []),
    ...(ts.concentrationIndex !== undefined && ts.concentrationIndex != null ? [{ label: labels.concentrationIndex, value: ts.concentrationIndex.toFixed(2), tone: ts.concentrationIndex > 0.5 ? 'warn' as const : 'info' as const }] : []),
  ];

  const winCount = ts.winningTrades ?? 0;
  const lossCount = ts.losingTrades ?? 0;
  const hasWinLoss = winCount > 0 || lossCount > 0;
  const maxVal = hasWinLoss ? Math.max(winCount, lossCount) : 0;

  return (
    <div className={styles.tradeStats}>
      <div className={styles.statGrid}>
        {stats.map((s) => (
          <article key={s.label} className={`${styles.statCard} ${styles[`tone${s.tone}`]}`}>
            <span className={styles.statLabel}>{s.label}</span>
            <strong className={styles.statValue}>{s.value}</strong>
          </article>
        ))}
      </div>

      {hasWinLoss && (
        <>
          <h4 className={styles.sectionTitle}>盈亏对比</h4>
          <div className={styles.barChart}>
            <div className={styles.barRow}>
              <span className={styles.barLabel}>{labels.wins}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barGood}
                  style={{ width: `${maxVal > 0 ? (winCount / maxVal) * 100 : 0}%` }}
                />
              </div>
              <span className={styles.barValue}>{winCount}</span>
            </div>
            <div className={styles.barRow}>
              <span className={styles.barLabel}>{labels.losses}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barWarn}
                  style={{ width: `${maxVal > 0 ? (lossCount / maxVal) * 100 : 0}%` }}
                />
              </div>
              <span className={styles.barValue}>{lossCount}</span>
            </div>
          </div>
        </>
      )}

      <PnlHistogram report={report} ui={ui} />
    </div>
  );
}
