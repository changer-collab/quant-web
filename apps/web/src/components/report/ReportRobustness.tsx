import { useMemo } from 'react';
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import { ReactEChartsCore, echarts, CHART_DEFAULTS } from '../../lib/echarts-setup';
import type { EChartsOption } from 'echarts';
import styles from '@/styles/report-tables.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v >= 0 ? '+' : '')}${(v * 100).toFixed(1)}%`;
}

/** 参数敏感性热力图 */
function ParamSensitivityHeatmap({ report, ui }: Props) {
  const rb = report.robustness;
  const labels = ui.robustness;

  const option = useMemo<EChartsOption>(() => {
    if (rb.paramSensitivity.length === 0) return {};

    // 取第一个参数做热力图展示（多参数时可扩展为 tab）
    const ps = rb.paramSensitivity[0];
    const paramValues = ps.variations.map((v) => String(v.value));
    const metrics = [ui.chartLabels.returnRate, ui.chartLabels.sharpe, ui.chartLabels.maxDrawdown];

    const data: [number, number, number][] = [];
    ps.variations.forEach((v, vi) => {
      data.push([vi, 0, v.return * 100]);
      data.push([vi, 1, v.sharpe]);
      data.push([vi, 2, v.drawdown * 100]);
    });

    const allVals = data.map((d) => d[2]);
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        formatter(params: unknown) {
          const p = params as { data: [number, number, number] };
          const [vi, mi, val] = p.data;
          return `${ps.paramName}=${paramValues[vi]}<br/>${metrics[mi]}: <b>${val.toFixed(2)}</b>`;
        },
      },
      grid: { top: 8, right: 60, bottom: 28, left: 72 },
      xAxis: {
        type: 'category',
        data: paramValues,
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
        name: ps.paramName,
        nameTextStyle: { color: '#8fa29b', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: metrics,
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        axisTick: { show: false },
      },
      visualMap: {
        min: minVal,
        max: maxVal,
        calculable: true,
        orient: 'vertical',
        right: 4,
        top: 'center',
        itemHeight: 100,
        textStyle: { color: '#8fa29b', fontSize: 10 },
        inRange: {
          color: ['#ff6b6b', '#3a2020', '#1a3328', '#4df0a0'],
        },
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
              return p.data[2].toFixed(1);
            },
          },
          itemStyle: { borderColor: '#08100f', borderWidth: 2, borderRadius: 2 },
        },
      ],
    };
  }, [rb, labels]);

  if (rb.paramSensitivity.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.paramSensitivity}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 180 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

/** 滚动窗口折线图 */
function RollingWindowChart({ report, ui }: Props) {
  const rb = report.robustness;
  const chartLabels = ui.chartLabels;
  const labels = ui.robustness;

  const option = useMemo<EChartsOption>(() => {
    if (rb.rollingWindows.length === 0) return {};

    const windows = rb.rollingWindows.map((rw) => `${rw.start}~${rw.end}`);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
      },
      legend: {
        data: [chartLabels.returnRate, chartLabels.sharpe, chartLabels.maxDrawdown],
        top: 0,
        right: 0,
        textStyle: { color: '#8fa29b', fontSize: 11 },
      },
      grid: { top: 36, right: 16, bottom: 48, left: 56 },
      xAxis: {
        type: 'category',
        data: windows,
        axisLabel: { fontSize: 9, color: '#8fa29b', rotate: 30 },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: { fontSize: 10, color: '#8fa29b', formatter: (v: number) => `${(v * 100).toFixed(0)}%` },
          splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
        },
      ],
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 16, bottom: 4 },
      ],
      series: [
        {
          name: chartLabels.returnRate,
          type: 'line',
          data: rb.rollingWindows.map((rw) => rw.return),
          lineStyle: { color: '#4df0a0', width: 2 },
          itemStyle: { color: '#4df0a0' },
          showSymbol: false,
        },
        {
          name: chartLabels.sharpe,
          type: 'line',
          data: rb.rollingWindows.map((rw) => rw.sharpe),
          lineStyle: { color: '#62d8ff', width: 1.5 },
          itemStyle: { color: '#62d8ff' },
          showSymbol: false,
        },
        {
          name: chartLabels.maxDrawdown,
          type: 'line',
          data: rb.rollingWindows.map((rw) => rw.drawdown),
          lineStyle: { color: '#ff6b6b', width: 1.5 },
          itemStyle: { color: '#ff6b6b' },
          showSymbol: false,
        },
      ],
    };
  }, [rb, chartLabels]);

  if (rb.rollingWindows.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.rollingWindow}</h4>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        theme="quant-dark"
        style={{ height: 280 }}
        notMerge
        lazyUpdate
      />
    </div>
  );
}

/** 市场环境分组柱状图 */
function MarketRegimeChart({ report, ui }: Props) {
  const rb = report.robustness;
  const chartLabels = ui.chartLabels;
  const labels = ui.robustness;

  const option = useMemo<EChartsOption>(() => {
    if (rb.marketRegimes.length === 0) return {};

    const regimeLabels = rb.marketRegimes.map((mr) => {
      return mr.regime === 'bull' ? 'Bull' : mr.regime === 'bear' ? 'Bear' : 'Sideways';
    });

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
      },
      legend: {
        data: [chartLabels.returnRate, chartLabels.sharpe, chartLabels.maxDrawdown],
        top: 0,
        right: 0,
        textStyle: { color: '#8fa29b', fontSize: 11 },
      },
      grid: { top: 36, right: 16, bottom: 28, left: 56 },
      xAxis: {
        type: 'category',
        data: regimeLabels,
        axisLabel: { fontSize: 11, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        {
          name: chartLabels.returnRate,
          type: 'bar',
          data: rb.marketRegimes.map((mr) => ({
            value: mr.return * 100,
            itemStyle: { color: mr.return >= 0 ? '#4df0a0' : '#ff6b6b' },
          })),
        },
        {
          name: chartLabels.sharpe,
          type: 'bar',
          data: rb.marketRegimes.map((mr) => ({
            value: mr.sharpe,
            itemStyle: { color: '#62d8ff' },
          })),
        },
        {
          name: chartLabels.maxDrawdown,
          type: 'bar',
          data: rb.marketRegimes.map((mr) => ({
            value: mr.drawdown * 100,
            itemStyle: { color: '#ff6b6b' },
          })),
        },
      ],
    };
  }, [rb, chartLabels]);

  if (rb.marketRegimes.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.marketRegime}</h4>
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

export function ReportRobustness({ report, ui }: Props) {
  const rb = report.robustness;
  const labels = ui.robustness;
  const wf = rb.walkForward;

  return (
    <div className={styles.robustnessPanel}>
      {/* 参数敏感性热力图 */}
      <ParamSensitivityHeatmap report={report} ui={ui} />

      {/* 参数敏感性表格（保留完整数据） */}
      {rb.paramSensitivity.length > 1 && rb.paramSensitivity.slice(1).map((ps) => (
        <div key={ps.paramName} className={styles.sensitivityBlock}>
          <span className={styles.sensitivityParam}>{ps.paramName}</span>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>值</th>
                <th>收益率</th>
                <th>夏普</th>
                <th>最大回撤</th>
              </tr>
            </thead>
            <tbody>
              {ps.variations.map((v) => (
                <tr key={v.value}>
                  <td>{v.value}</td>
                  <td className={v.return >= 0.1 ? styles.toneGood : styles.toneWarn}>{pct(v.return)}</td>
                  <td className={v.sharpe >= 0.8 ? styles.toneGood : styles.toneWarn}>{v.sharpe.toFixed(2)}</td>
                  <td className={styles.toneWarn}>{pct(v.drawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* 滚动窗口折线图 */}
      <RollingWindowChart report={report} ui={ui} />

      {/* 市场环境分组柱状图 */}
      <MarketRegimeChart report={report} ui={ui} />

      {/* Walk-Forward 分析 */}
      {wf && wf.windows.length > 0 && (
        <div className={styles.chartSection}>
          <h4 className={styles.sectionTitle}>{labels.walkForward}</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>区间</th>
                <th>{labels.inSampleReturn}</th>
                <th>{labels.outOfSampleReturn}</th>
                <th>{labels.decay}</th>
              </tr>
            </thead>
            <tbody>
              {wf.windows.map((w) => (
                <tr key={w.period}>
                  <td>{w.period}</td>
                  <td className={styles.toneGood}>{pct(w.inSampleReturn)}</td>
                  <td className={styles.toneGood}>{pct(w.outOfSampleReturn)}</td>
                  <td className={w.decay > 0.2 ? styles.toneWarn : styles.toneGood}>{(w.decay * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.testSummary}>
            <div className={styles.testCard}>
              <span className={styles.testLabel}>{labels.avgDecay}</span>
              <strong className={(wf.avgDecay ?? 0) > 0.2 ? styles.toneWarn : styles.toneGood}>
                {((wf.avgDecay ?? 0) * 100).toFixed(0)}%
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Out-of-sample & Shuffled */}
      <div className={styles.testSummary}>
        <div className={styles.testCard}>
          <span className={styles.testLabel}>{labels.outOfSample}</span>
          <strong className={rb.outOfSampleReturn >= 0.05 ? styles.toneGood : styles.toneWarn}>
            {pct(rb.outOfSampleReturn)}
          </strong>
        </div>
        <div className={styles.testCard}>
          <span className={styles.testLabel}>{labels.shuffledTest}</span>
          <strong className={rb.shuffledReturn < 0.02 ? styles.toneGood : styles.toneWarn}>
            {pct(rb.shuffledReturn)}
          </strong>
        </div>
      </div>
    </div>
  );
}
