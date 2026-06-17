import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS, fmtPct } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-charts.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 净值曲线 vs 基准 */
function EquityLineChart({ report, ui }: Props) {
  const eq = report.equityData;
  const labels = ui.equity;

  const option = useMemo<EChartsOption>(() => {
    // 降采样到最多 500 点
    const maxPts = 500;
    const step = Math.max(1, Math.floor(eq.equityCurve.length / maxPts));
    const eqData = eq.equityCurve
      .filter((_, i) => i % step === 0)
      .map((d) => [formatDate(d.timestamp), d.equity]);
    const benchData = eq.benchmarkCurve
      .filter((_, i) => i % step === 0)
      .map((d) => [formatDate(d.timestamp), d.equity]);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        formatter(params: unknown) {
          const ps = Array.isArray(params) ? params : [params];
          const p = ps[0] as { axisValue: string; data: [string, number] };
          if (!p) return '';
          let html = `<div style="font-weight:700;margin-bottom:4px">${p.axisValue}</div>`;
          ps.forEach((item: unknown) => {
            const it = item as { seriesName: string; marker: string; data: [string, number] };
            html += `<div>${it.marker} ${it.seriesName}: <b>${it.data[1].toLocaleString()}</b></div>`;
          });
          return html;
        },
      },
      legend: {
        data: [labels.strategyLabel ?? '策略', labels.benchmarkLabel ?? '基准'],
        top: 0,
        right: 0,
        textStyle: { color: '#8fa29b', fontSize: 11 },
      },
      grid: { top: 36, right: 16, bottom: 48, left: 72 },
      xAxis: {
        type: 'category',
        data: eqData.map((d) => d[0]),
        axisLabel: { fontSize: 10, color: '#8fa29b', rotate: 0 },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => v.toLocaleString() },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 4 },
      ],
      series: [
        {
          name: labels.strategyLabel ?? '策略',
          type: 'line',
          data: eqData.map((d) => d[1]),
          lineStyle: { color: '#4df0a0', width: 2 },
          itemStyle: { color: '#4df0a0' },
          showSymbol: false,
          emphasis: { focus: 'series' },
        },
        {
          name: labels.benchmarkLabel ?? '基准',
          type: 'line',
          data: benchData.map((d) => d[1]),
          lineStyle: { color: '#62d8ff', width: 1.5, type: 'dashed' },
          itemStyle: { color: '#62d8ff' },
          showSymbol: false,
          emphasis: { focus: 'series' },
        },
      ],
    };
  }, [eq, labels]);

  return (
    <div className={styles.chartBlock}>
      <h4 className={styles.chartTitle}>{labels.netValueVsBenchmark}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 320 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

/** 回撤曲线（负值面积图） */
function DrawdownChart({ report, ui }: Props) {
  const eq = report.equityData;
  const labels = ui.equity;

  const option = useMemo<EChartsOption>(() => {
    const maxPts = 500;
    const step = Math.max(1, Math.floor(eq.drawdownCurve.length / maxPts));
    const ddData: [string, number][] = eq.drawdownCurve
      .filter((_, i) => i % step === 0)
      .map((d) => [formatDate(d.timestamp), d.drawdown * 100]);

    // 找最大回撤点
    let maxDDIdx = 0;
    let maxDDVal = 0;
    ddData.forEach((d, i) => {
      if (Math.abs(d[1]) > Math.abs(maxDDVal)) {
        maxDDVal = d[1];
        maxDDIdx = i;
      }
    });

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { axisValue: string; data: [string, number] };
          return `${it.axisValue}<br/>回撤: <b style="color:#ff6b6b">${it.data[1].toFixed(2)}%</b>`;
        },
      },
      grid: { top: 16, right: 16, bottom: 48, left: 56 },
      xAxis: {
        type: 'category',
        data: ddData.map((d) => d[0]),
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 4 },
      ],
      visualMap: {
        show: false,
        dimension: 1,
        pieces: [
          { lte: 0, color: '#ff6b6b' },
        ],
      },
      series: [
        {
          type: 'line',
          data: ddData.map((d) => d[1]),
          areaStyle: { color: 'rgba(255,107,107,0.25)' },
          lineStyle: { color: '#ff6b6b', width: 1.5 },
          itemStyle: { color: '#ff6b6b' },
          showSymbol: false,
          markPoint: maxDDVal !== 0 ? {
            data: [
              {
                name: 'maxDD',
                coord: [maxDDIdx, maxDDVal],
                value: `${maxDDVal.toFixed(1)}%`,
                itemStyle: { color: '#ff6b6b' },
                label: { show: true, color: '#e6eee9', fontSize: 11, fontWeight: 700 },
              },
            ],
            symbol: 'pin',
            symbolSize: 40,
          } : undefined,
        },
      ],
    };
  }, [eq, labels]);

  return (
    <div className={styles.chartBlock}>
      <h4 className={styles.chartTitle}>{labels.drawdownChart}</h4>
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

/** 月度收益热力图 */
function MonthlyHeatmap({ report, ui }: Props) {
  const eq = report.equityData;
  const labels = ui.equity;

  const option = useMemo<EChartsOption>(() => {
    const years = [...new Set(eq.monthlyReturns.map((m) => m.year))].sort();
    const months = Array.from({ length: 12 }, (_, i) => `${i + 1}月`);

    const data: [number, number, number][] = [];
    let minVal = Infinity;
    let maxVal = -Infinity;
    eq.monthlyReturns.forEach((mr) => {
      const yIdx = years.indexOf(mr.year);
      const val = mr.return_pct;
      data.push([yIdx, mr.month - 1, val]);
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    });

    // 扩展范围让色阶更均匀
    const range = Math.max(Math.abs(minVal), Math.abs(maxVal));
    const visualMin = -range;
    const visualMax = range;

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        formatter(params: unknown) {
          const p = params as { data: [number, number, number] };
          const [yIdx, mIdx, val] = p.data;
          return `${years[yIdx]}年${mIdx + 1}月: <b>${fmtPct(val / 100)}</b>`;
        },
      },
      grid: { top: 8, right: 60, bottom: 8, left: 52 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      yAxis: {
        type: 'category',
        data: years.map(String),
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
        splitArea: { show: false },
      },
      visualMap: {
        min: visualMin,
        max: visualMax,
        calculable: true,
        orient: 'vertical',
        right: 4,
        top: 'center',
        itemHeight: 120,
        textStyle: { color: '#8fa29b', fontSize: 10 },
        inRange: {
          color: ['#ff6b6b', '#3a2020', '#1a3328', '#4df0a0'],
        },
        formatter: (v: unknown) => `${Number(v).toFixed(1)}%`,
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: true,
            fontSize: 9,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            fontWeight: 600,
            formatter(params: unknown) {
              const p = params as { data: [number, number, number] };
              return `${p.data[2].toFixed(1)}%`;
            },
          },
          itemStyle: { borderColor: '#08100f', borderWidth: 2, borderRadius: 2 },
        },
      ],
    };
  }, [eq, labels]);

  return (
    <div className={styles.chartBlock}>
      <h4 className={styles.chartTitle}>{labels.monthlyHeatmap}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: Math.max(180, report.equityData.monthlyReturns.length > 0 ? 60 + [...new Set(report.equityData.monthlyReturns.map((m) => m.year))].length * 36 : 180) }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

/** 年度收益柱状图 */
function AnnualBarChart({ report, ui }: Props) {
  const eq = report.equityData;
  const labels = ui.equity;

  const option = useMemo<EChartsOption>(() => {
    const years = eq.annualReturns.map((a) => String(a.year));
    const values = eq.annualReturns.map((a) => a.return_pct);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; value: number };
          return `${it.name}年: <b>${fmtPct(it.value / 100)}</b>`;
        },
      },
      grid: { top: 16, right: 16, bottom: 28, left: 56 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { fontSize: 11, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${v}%` },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v) => ({
            value: v,
            itemStyle: { color: v >= 0 ? '#4df0a0' : '#ff6b6b', borderRadius: v >= 0 ? [2, 2, 0, 0] : [0, 0, 2, 2] },
          })),
          barWidth: 32,
          label: {
            show: true,
            position: 'outside',
            fontSize: 10,
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
  }, [eq, labels]);

  return (
    <div className={styles.chartBlock}>
      <h4 className={styles.chartTitle}>{labels.annualReturns}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 220 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

export function ReportEquityCharts({ report, ui }: Props) {
  return (
    <div className={styles.equityPanel}>
      <EquityLineChart report={report} ui={ui} />
      <DrawdownChart report={report} ui={ui} />
      <MonthlyHeatmap report={report} ui={ui} />
      <AnnualBarChart report={report} ui={ui} />
    </div>
  );
}
