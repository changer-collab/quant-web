import chartStyles from '../../styles/charts/mockup.module.css';

interface BarDatum {
  label: string;
  value: number;
  up: boolean;
}

const MOCK_BARS: BarDatum[] = [
  { label: '1', value: 34, up: true },
  { label: '2', value: 48, up: true },
  { label: '3', value: 42, up: false },
  { label: '4', value: 61, up: true },
  { label: '5', value: 55, up: false },
  { label: '6', value: 76, up: true },
  { label: '7', value: 69, up: false },
  { label: '8', value: 82, up: true },
  { label: '9', value: 74, up: false },
  { label: '10', value: 90, up: true },
];

const MOCK_LINE = [28, 38, 45, 52, 48, 65, 72, 78, 85, 92];

export function ChartMockup({
  ariaLabel,
  priceUp,
  priceDown,
}: {
  ariaLabel: string;
  priceUp?: string;
  priceDown?: string;
}) {
  const barData = MOCK_BARS;
  const lineData = MOCK_LINE;

  const chartW = 600;
  const chartH = 280;
  const padL = 36;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;
  const maxVal = 100;

  const barW = plotW / barData.length;
  const barPad = 6;

  const barPoints = barData.map((d, i) => {
    const h = (d.value / maxVal) * plotH;
    return {
      x: padL + i * barW + barPad,
      y: padT + plotH - h,
      w: barW - barPad * 2,
      h,
      value: d.value,
      label: d.label,
      up: d.up,
    };
  });

  const linePoints = lineData.map((v, i) => ({
    x: padL + i * barW + barW / 2,
    y: padT + plotH - (v / maxVal) * plotH,
  }));

  const linePath = linePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const areaPath = `${linePath} L${linePoints[linePoints.length - 1].x},${padT + plotH} L${linePoints[0].x},${padT + plotH} Z`;

  const gridLines = [0, 25, 50, 75, 100].map((v) => ({
    y: padT + plotH - (v / maxVal) * plotH,
    label: `${v}`,
  }));

  const tradeMarkers = [
    {
      x: padL + 2 * barW + barW / 2,
      y: padT + plotH - (42 / maxVal) * plotH,
      type: 'buy' as const,
    },
    {
      x: padL + 7 * barW + barW / 2,
      y: padT + plotH - (78 / maxVal) * plotH,
      type: 'sell' as const,
    },
  ];

  return (
    <section className={chartStyles.chartPanel} aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className={chartStyles.chartSvg}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* 涨 - 红色渐变 */}
          <linearGradient id="barGradUp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--red)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--red)" stopOpacity="0.08" />
          </linearGradient>
          {/* 跌 - 绿色渐变 */}
          <linearGradient id="barGradDown" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--green)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--green)" stopOpacity="0.06" />
          </linearGradient>
          {/* 折线渐变 */}
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--cyan)" />
            <stop offset="100%" stopColor="var(--green)" />
          </linearGradient>
          {/* 面积填充 */}
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
          <filter id="glowCyan">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dotGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g.label}>
            <line
              x1={padL}
              y1={g.y}
              x2={chartW - padR}
              y2={g.y}
              stroke="var(--line)"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
            <text x={padL - 6} y={g.y + 3} textAnchor="end" className={chartStyles.gridLabel}>
              {g.label}
            </text>
          </g>
        ))}

        {/* Area fill under line */}
        <path d={areaPath} fill="url(#areaGrad)" className={chartStyles.areaFill} />

        {/* Bars - 红涨绿跌 */}
        {barPoints.map((b, i) => (
          <g key={b.label}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              fill={b.up ? 'url(#barGradUp)' : 'url(#barGradDown)'}
              rx="2"
              ry="2"
              className={chartStyles.barRect}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <title>
                {b.value}% {b.up ? (priceUp ?? 'Up') : (priceDown ?? 'Down')}
              </title>
            </rect>
          </g>
        ))}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glowCyan)"
          className={chartStyles.linePath}
        />

        {/* Line dots */}
        {linePoints.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill="var(--cyan)"
            opacity="0.6"
            className={chartStyles.lineDot}
            style={{ animationDelay: `${0.6 + i * 0.04}s` }}
          />
        ))}

        {/* Trade markers */}
        {tradeMarkers.map((m, i) => (
          <g key={i} className={chartStyles.tradeMarker}>
            <circle
              cx={m.x}
              cy={m.y}
              r="8"
              fill={m.type === 'buy' ? 'var(--red)' : 'var(--green)'}
              opacity="0.15"
              className={chartStyles.tradePulse}
            />
            <circle
              cx={m.x}
              cy={m.y}
              r="4"
              fill={m.type === 'buy' ? 'var(--red)' : 'var(--green)'}
              filter="url(#dotGlow)"
            />
            <circle cx={m.x} cy={m.y} r="1.5" fill="var(--bg)" />
            <text
              x={m.x}
              y={m.y - 12}
              textAnchor="middle"
              className={chartStyles.tradeLabel}
              fill={m.type === 'buy' ? 'var(--red)' : 'var(--green)'}
            >
              {m.type === 'buy' ? 'B' : 'S'}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {barPoints.map((b) => (
          <text
            key={b.label}
            x={b.x + b.w / 2}
            y={padT + plotH + 18}
            textAnchor="middle"
            className={chartStyles.gridLabel}
          >
            {b.label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className={chartStyles.legend}>
        <span className={chartStyles.legendItem}>
          <i className={chartStyles.legendBarUp} /> 涨
        </span>
        <span className={chartStyles.legendItem}>
          <i className={chartStyles.legendBarDown} /> 跌
        </span>
        <span className={chartStyles.legendItem}>
          <i className={chartStyles.legendLine} /> 趋势
        </span>
        <span className={chartStyles.legendItem}>
          <i className={`${chartStyles.legendDot} ${chartStyles.legendBuy}`} /> 买
        </span>
        <span className={chartStyles.legendItem}>
          <i className={`${chartStyles.legendDot} ${chartStyles.legendSell}`} /> 卖
        </span>
      </div>
    </section>
  );
}
