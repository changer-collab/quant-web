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
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

/** 行业暴露环形图 */
function IndustryDoughnut({ report, ui }: Props) {
  const attr = report.attribution;
  const labels = ui.attribution;

  const option = useMemo<EChartsOption>(() => {
    if (attr.industryExposures.length === 0) return {};

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'item',
        formatter(params: unknown) {
          const p = params as { name: string; value: number; percent: number };
          return `${p.name}<br/>权重: <b>${(p.value * 100).toFixed(0)}%</b>`;
        },
      },
      legend: {
        orient: 'vertical',
        right: 0,
        top: 'center',
        textStyle: { color: '#8fa29b', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: { show: true, fontSize: 12, fontWeight: 700, color: '#e6eee9' },
          },
          labelLine: { show: false },
          data: attr.industryExposures.map((ind) => ({
            name: ind.industry,
            value: ind.weight,
          })),
        },
      ],
    };
  }, [attr, labels]);

  if (attr.industryExposures.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.industryExposure}</h4>
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

/** 因子暴露水平柱状图（ECharts） */
function FactorExposureChart({ report, ui }: Props) {
  const attr = report.attribution;
  const labels = ui.attribution;

  const option = useMemo<EChartsOption>(() => {
    if (attr.factorExposures.length === 0) return {};

    const factors = attr.factorExposures.map((fe) => fe.factor);
    const exposures = attr.factorExposures.map((fe) => fe.exposure);

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; value: number };
          return `${it.name}<br/>暴露: <b>${it.value >= 0 ? '+' : ''}${it.value.toFixed(2)}</b>`;
        },
      },
      grid: { top: 8, right: 40, bottom: 8, left: 100 },
      xAxis: {
        type: 'value',
        axisLabel: { fontSize: 10, color: '#8fa29b' },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      yAxis: {
        type: 'category',
        data: factors,
        axisLabel: { fontSize: 11, color: '#8fa29b' },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: exposures.map((v) => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? '#4df0a0' : '#ff6b6b',
              borderRadius: v >= 0 ? [0, 2, 2, 0] : [2, 0, 0, 2],
            },
          })),
          barWidth: 18,
          label: {
            show: true,
            position: 'right',
            fontSize: 10,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            fontWeight: 600,
            color: '#8fa29b',
            formatter(params: unknown) {
              const p = params as { value: number };
              return `${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}`;
            },
          },
        },
      ],
    };
  }, [attr, labels]);

  if (attr.factorExposures.length === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.factorExposure}</h4>
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

/** 收益贡献瀑布图 */
function ContributionWaterfall({ report, ui }: Props) {
  const attr = report.attribution;
  const labels = ui.attribution;

  const option = useMemo<EChartsOption>(() => {
    const ts = attr.timingSelection;
    if (ts.timing === 0 && ts.selection === 0 && ts.residual === 0) return {};

    const items = [
      { name: '择时', value: ts.timing },
      { name: '选股', value: ts.selection },
      { name: '残差', value: ts.residual },
    ];

    // 瀑布图：计算累计基线
    let cumulative = 0;
    const data = items.map((item) => {
      const base = cumulative;
      cumulative += item.value;
      return {
        name: item.name,
        // 正值：底部=base，顶部=base+value
        // 负值：底部=base+value，顶部=base
        base: item.value >= 0 ? base : base + item.value,
        value: Math.abs(item.value),
        rawValue: item.value,
      };
    });

    // 加一个总计柱
    data.push({
      name: labels.totalLabel,
      base: 0,
      value: cumulative,
      rawValue: cumulative,
    });

    return {
      tooltip: {
        ...CHART_DEFAULTS.tooltip,
        trigger: 'axis',
        formatter(params: unknown) {
          const p = Array.isArray(params) ? params[0] : params;
          const it = p as { name: string; seriesName: string; value: number };
          if (it.seriesName === labels.baseline) return '';
          const d = data.find((d) => d.name === it.name);
          if (!d) return '';
          return `${d.name}: <b>${fmtPct(d.rawValue)}</b>`;
        },
      },
      grid: { top: 16, right: 16, bottom: 28, left: 56 },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.name),
        axisLabel: { fontSize: 11, color: '#8fa29b' },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 10,
          color: '#8fa29b',
          formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
        },
        splitLine: { lineStyle: { color: 'rgba(38,54,50,0.4)' } },
      },
      series: [
        // 不可见的基线柱
        {
          name: labels.baseline,
          type: 'bar',
          stack: 'waterfall',
          data: data.map((d) => d.base),
          itemStyle: { color: 'transparent' },
          barWidth: 36,
        },
        // 可见的值柱
        {
          name: labels.contribution,
          type: 'bar',
          stack: 'waterfall',
          data: data.map((d, i) => ({
            value: d.value,
            itemStyle: {
              color:
                i === data.length - 1
                  ? '#62d8ff' // 总计用 cyan
                  : d.rawValue >= 0
                    ? '#4df0a0'
                    : '#ff6b6b',
              borderRadius: d.rawValue >= 0 ? [2, 2, 0, 0] : [0, 0, 2, 2],
            },
          })),
          label: {
            show: true,
            position: 'top',
            fontSize: 10,
            fontFamily: 'Cascadia Code, Consolas, monospace',
            fontWeight: 600,
            color: '#8fa29b',
            formatter(params: unknown) {
              const p = params as { dataIndex: number };
              const d = data[p.dataIndex];
              return fmtPct(d.rawValue);
            },
          },
        },
      ],
    };
  }, [attr, labels]);

  const ts = attr.timingSelection;
  if (ts.timing === 0 && ts.selection === 0 && ts.residual === 0) return null;

  return (
    <div className={styles.chartSection}>
      <h4 className={styles.sectionTitle}>{labels.timingSelection}</h4>
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

export function ReportAttribution({ report, ui }: Props) {
  const attr = report.attribution;
  const labels = ui.attribution;
  const brinson = attr.brinsonAttribution;

  return (
    <div className={styles.attributionPanel}>
      {/* Brinson 归因 */}
      {brinson && (
        <div className={styles.chartSection}>
          <h4 className={styles.sectionTitle}>{labels.brinsonAttribution}</h4>
          <div className={styles.testSummary}>
            <div className={styles.testCard}>
              <span className={styles.testLabel}>{labels.allocationEffect}</span>
              <strong className={brinson.allocationEffect >= 0 ? styles.toneGood : styles.toneWarn}>
                {pct(brinson.allocationEffect)}
              </strong>
            </div>
            <div className={styles.testCard}>
              <span className={styles.testLabel}>{labels.selectionEffect}</span>
              <strong className={brinson.selectionEffect >= 0 ? styles.toneGood : styles.toneWarn}>
                {pct(brinson.selectionEffect)}
              </strong>
            </div>
            <div className={styles.testCard}>
              <span className={styles.testLabel}>{labels.interactionEffect}</span>
              <strong
                className={brinson.interactionEffect >= 0 ? styles.toneGood : styles.toneWarn}
              >
                {pct(brinson.interactionEffect)}
              </strong>
            </div>
            <div className={styles.testCard}>
              <span className={styles.testLabel}>{labels.totalActiveReturn}</span>
              <strong
                className={brinson.totalActiveReturn >= 0 ? styles.toneGood : styles.toneWarn}
              >
                {pct(brinson.totalActiveReturn)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 行业暴露环形图 */}
      <IndustryDoughnut report={report} ui={ui} />

      {/* 行业贡献表格（保留） */}
      {attr.industryExposures.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>行业</th>
              <th>平均权重</th>
              <th>收益贡献</th>
            </tr>
          </thead>
          <tbody>
            {attr.industryExposures.map((ind) => (
              <tr key={ind.industry}>
                <td>{ind.industry}</td>
                <td>{(ind.weight * 100).toFixed(0)}%</td>
                <td className={ind.contribution >= 0 ? styles.toneGood : styles.toneWarn}>
                  {pct(ind.contribution)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 因子暴露水平柱状图 */}
      <FactorExposureChart report={report} ui={ui} />

      {/* 收益贡献瀑布图 */}
      <ContributionWaterfall report={report} ui={ui} />
    </div>
  );
}
