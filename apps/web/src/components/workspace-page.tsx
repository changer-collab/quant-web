import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { StrategyRow, UiCopy, LanguageCode } from '../appData';
import { apiPost } from '../api/client';
import { streamTask } from '../api/tasks';
import { fetchDiagnostic } from '../api/diagnostics';
import { fetchStrategyConfig } from '../api/strategies-config';
import { submitBacktest, streamTask as streamBacktestTask } from '../api/tasks';
import s from '../styles/workspace-page.module.css';

// ── Types ────────────────────────────────────────────────────

interface WorkspacePageProps {
  strategy: StrategyRow;
  onBack: () => void;
  language: LanguageCode;
  ui: UiCopy;
}

type ProgressState = { percent: number; message: string } | null;

interface ConfigSnapshot {
  strategy: string;
  params: Record<string, unknown>;
}

interface BacktestMetricsView {
  totalReturn?: number;
  maxDrawdown?: number;
  sharpeRatio?: number;
  totalTrades?: number;
}

interface BacktestTradeView {
  timestamp?: number;
  date?: string;
  side?: string;
  price?: number;
  quantity?: number;
  shares?: number;
  pnl?: number;
  reason?: string;
}

interface BacktestResultView {
  metrics?: BacktestMetricsView;
  equityCurve?: Array<{ timestamp: number; equity: number }>;
  trades?: BacktestTradeView[];
}

// ── Deterministic mock data generators (no Math.random) ─────
/** Deterministic "pseudo-random" value for mock data */
function det(i: number, j?: number): number {
  const n = j !== undefined ? i * 31 + j * 7 : i * 13;
  return ((n * 1103515245 + 12345) & 0x7FFFFFFF) / 0x7FFFFFFF;
}

function genMockBarData(count: number, label: string): { label: string; value: number }[] {
  const vals: { label: string; value: number }[] = [];
  for (let i = 0; i < count; i++) {
    vals.push({ label: `${label}${i + 1}`, value: Math.round((det(i) * 0.3 - 0.05) * 1000) / 1000 });
  }
  return vals;
}

function genMockHeatmap(rows: number, cols: number): number[][] {
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(Math.round((det(r, c) * 2 - 1) * 100) / 100);
    }
    grid.push(row);
  }
  return grid;
}

function genMockLinePoints(count: number): number[] {
  let val = 100;
  const pts: number[] = [];
  for (let i = 0; i < count; i++) {
    val += (det(i, 99) - 0.48) * 2;
    pts.push(Math.round(val * 100) / 100);
  }
  return pts;
}

// ── Chart subcomponents ──────────────────────────────────────

function BarChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 0.001);
  const negVals = data.some((d) => d.value < 0);
  const range = negVals ? maxVal * 2 : maxVal;

  return (
    <div className={s.barChart} style={{ height }}>
      {data.map((d, i) => {
        const h = negVals
          ? (Math.abs(d.value) / range) * 100
          : (d.value / range) * 100;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
            <div className={s.barValue}>{d.value.toFixed(3)}</div>
            <div
              className={`${s.bar} ${d.value < 0 ? s.barNegative : ''}`}
              style={{ height: `${Math.max(h, 4)}%` }}
            />
            <div className={s.barLabel}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function HBarChart({ data }: { data: { label: string; value: number }[] }) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 0.001);
  return (
    <div className={s.hBarChart}>
      {data.map((d, i) => (
        <div className={s.hBarRow} key={i}>
          <span className={s.hBarLabel}>{d.label}</span>
          <div className={s.hBarTrack}>
            <div
              className={`${s.hBarFill} ${d.value < 0 ? s.hBarFillNegative : ''}`}
              style={{ width: `${(Math.abs(d.value) / maxVal) * 100}%` }}
            />
          </div>
          <span className={s.hBarValue}>{d.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function HeatmapChart({ grid, rowLabels, colLabels }: { grid: number[][]; rowLabels: string[]; colLabels: string[] }) {
  const maxAbs = Math.max(...grid.flat().map(Math.abs), 0.01);
  return (
    <div className={s.heatmapGrid} style={{ gridTemplateColumns: `auto repeat(${colLabels.length}, 1fr)` }}>
      <div />
      {colLabels.map((cl, ci) => (
        <div className={s.heatmapLabel} key={ci}>{cl}</div>
      ))}
      {grid.map((row, ri) => (
        <>
          <div className={s.heatmapLabel} key={`rl-${ri}`}>{rowLabels[ri]}</div>
          {row.map((cell, ci) => {
            const intensity = Math.abs(cell) / maxAbs;
            return (
              <div
                className={s.heatmapCell}
                key={`${ri}-${ci}`}
                style={{
                  background: cell >= 0 ? `rgba(77, 240, 160, ${intensity * 0.7 + 0.1})` : `rgba(255, 80, 80, ${intensity * 0.7 + 0.1})`,
                  color: intensity > 0.5 ? '#0a0f0e' : 'var(--text)',
                }}
              >
                {cell.toFixed(2)}
              </div>
            );
          })}
        </>
      ))}
    </div>
  );
}

function LineChart({ points, color = 'var(--green)' }: { points: number[]; color?: string }) {
  if (points.length === 0) return <div className={s.emptyState}>No data</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 100;
  const h = 100;
  const stepX = points.length === 1 ? 0 : w / (points.length - 1);
  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${i * stepX},${h - ((p - min) / range) * h}`)
    .join(' ');

  return (
    <div className={s.lineChart}>
      <svg className={s.lineChartSvg} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={pathD} className={s.lineChartLine} stroke={color} />
      </svg>
    </div>
  );
}

function MiniGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className={s.miniGrid}>
      {items.map((item, i) => (
        <div className={s.miniGridCell} key={i}>
          <span className={s.miniGridLabel}>{item.label}</span>
          <span className={s.miniGridValue}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function getNestedNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  let current: unknown = record;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : undefined;
}

function extractBacktestResult(data: Record<string, unknown> | null): BacktestResultView | null {
  if (!data) return null;
  const raw = data.backtestResult && typeof data.backtestResult === 'object'
    ? data.backtestResult as Record<string, unknown>
    : data;
  const metricsRaw = raw.metrics && typeof raw.metrics === 'object'
    ? raw.metrics as Record<string, unknown>
    : {};
  const equityCurve = Array.isArray(raw.equityCurve)
    ? raw.equityCurve
        .map((point) => {
          if (!point || typeof point !== 'object') return null;
          const p = point as Record<string, unknown>;
          const timestamp = typeof p.timestamp === 'number' ? p.timestamp : undefined;
          const equity = typeof p.equity === 'number' ? p.equity : undefined;
          return timestamp !== undefined && equity !== undefined ? { timestamp, equity } : null;
        })
        .filter((point): point is { timestamp: number; equity: number } => point !== null)
    : [];
  const trades = Array.isArray(raw.trades)
    ? raw.trades.filter((trade): trade is BacktestTradeView => Boolean(trade && typeof trade === 'object'))
    : [];

  return {
    metrics: {
      totalReturn: getNestedNumber(metricsRaw, ['totalReturn']),
      maxDrawdown: getNestedNumber(metricsRaw, ['maxDrawdown']),
      sharpeRatio: getNestedNumber(metricsRaw, ['sharpeRatio']),
      totalTrades: getNestedNumber(metricsRaw, ['totalTrades']),
    },
    equityCurve,
    trades,
  };
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '--';
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number | undefined, digits = 2): string {
  if (value === undefined) return '--';
  return value.toFixed(digits);
}

function formatTradeDate(trade: BacktestTradeView): string {
  if (trade.date) return trade.date;
  if (typeof trade.timestamp === 'number') {
    return new Date(trade.timestamp).toISOString().slice(0, 10);
  }
  return '--';
}

function formatTradeSide(side: string | undefined, language: LanguageCode): string {
  if (side === 'buy') return language === 'zh' ? '买入' : 'Buy';
  if (side === 'sell') return language === 'zh' ? '卖出' : 'Sell';
  return side ?? '--';
}

// ── Progress / Error helpers ─────────────────────────────────

function ProgressBar({ progress }: { progress: ProgressState }) {
  if (!progress) return null;
  return (
    <div className={s.progressContainer}>
      <span className={s.spinner} />
      <div className={s.progressBar}>
        <div className={s.progressFill} style={{ width: `${progress.percent}%` }} />
      </div>
      <span className={s.progressText}>{progress.percent}%</span>
      {progress.message && <span className={s.progressMessage}>{progress.message}</span>}
    </div>
  );
}

function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={s.errorBox}>
      <span>{message}</span>
      {onRetry && (
        <button className={s.errorRetry} onClick={onRetry} type="button">
          Retry
        </button>
      )}
    </div>
  );
}

// ── Main WorkspacePage ───────────────────────────────────────

export function WorkspacePage({ strategy, onBack, language, ui }: WorkspacePageProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [diagnosticData, setDiagnosticData] = useState<Record<string, unknown> | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticProgress, setDiagnosticProgress] = useState<ProgressState>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticReady, setDiagnosticReady] = useState(false);

  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState<ProgressState>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<Record<string, unknown> | null>(null);
  const [backtestSubmitted, setBacktestSubmitted] = useState(false);
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [backtestSymbol, setBacktestSymbol] = useState('600519');
  const [backtestTimeframe, setBacktestTimeframe] = useState('1d');
  const [backtestInitialCapital, setBacktestInitialCapital] = useState(1_000_000);
  const configDefaultsApplied = useRef(false);

  const subcategory = strategy.subcategory ?? '';
  const category = strategy.category ?? 'non_factor';
  const parsedBacktest = extractBacktestResult(backtestResult);

  // ── Pre-computed deterministic mock data for charts ──
  const mockData = useMemo(() => ({
    factorIcData: genMockBarData(12, 'F'),
    factorLayerData: [
      { label: 'Group 1 (Top)', value: 0.12 + det(0) * 0.08 },
      { label: 'Group 2', value: 0.06 + det(1) * 0.04 },
      { label: 'Group 3', value: 0.02 + det(2) * 0.02 },
      { label: 'Group 4', value: -0.01 + det(3) * 0.02 },
      { label: 'Group 5 (Bottom)', value: -0.08 + det(4) * 0.04 },
    ],
    factorHeatmap: genMockHeatmap(6, 6),
    sensGrid: genMockHeatmap(5, 5),
    signalDist: genMockBarData(8, 'B'),
    slippagePts: genMockLinePoints(10),
    costItems: [
      { label: 'Base Return', value: `${(det(0, 10) * 30 + 10).toFixed(1)}%` },
      { label: 'After Cost', value: `${(det(1, 10) * 20 + 5).toFixed(1)}%` },
      { label: 'Cost Drag', value: `${(det(2, 10) * 5 + 2).toFixed(2)}%` },
    ],
    crossCorrGrid: genMockHeatmap(4, 4),
    cycleValues: [det(0), det(1), det(2), det(3)].map((v) => `${(v * 15 + 5).toFixed(1)}%`),
    macroLinePts: genMockLinePoints(20),
    carPts: genMockLinePoints(21),
    eventStats: [
      { label: 'Total Events', value: '47' },
      { label: 'Avg CAR', value: `${(det(0) * 3 + 1).toFixed(2)}%` },
      { label: 'Win Rate', value: `${(det(1) * 20 + 55).toFixed(1)}%` },
      { label: 'Avg Holding', value: `${Math.round(det(2) * 10 + 5)}d` },
    ],
    shapData: [
      { label: 'Feature 1', value: 0.35 },
      { label: 'Feature 2', value: 0.22 },
      { label: 'Feature 3', value: 0.18 },
      { label: 'Feature 4', value: 0.12 },
      { label: 'Feature 5', value: 0.08 },
      { label: 'Feature 6', value: 0.05 },
    ],
    trainLoss: genMockLinePoints(30),
    factorLabels: ['Momentum', 'Quality', 'Value', 'Size', 'Volatility', 'Growth'],
    sensLabels: ['Lookback', 'Entry', 'Exit', 'Stop', 'Size'],
    macroLabels: ['GDP', 'CPI', 'PMI', 'M2'],
    cycleLabels: ['Expansion', 'Peak', 'Contraction', 'Trough'],
  }), []);

  // ── F5 recovery: check URL for ?diagnosticId on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('diagnosticId');
    if (id) {
      const url = new URL(window.location.href);
      url.searchParams.set('diagnosticId', id);
      window.history.replaceState({}, '', url.toString());

      fetchDiagnostic(id)
        .then((data) => {
          if (data) {
            setDiagnosticData(data.dataJson);
            setDiagnosticReady(true);
          } else {
            setDiagnosticError(ui.workspaceDiagnosticExpired);
          }
        })
        .catch(() => setDiagnosticError(ui.workspaceDiagnosticExpired))
        .finally(() => setDiagnosticLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    configDefaultsApplied.current = false;
    fetchStrategyConfig(strategy.name)
      .then((res) => {
        setConfigSnapshot(res ? { strategy: strategy.name, params: res.config_json } : null);
      })
      .catch((err) => {
        console.warn('Failed to fetch strategy config:', err);
      });
  }, [strategy.name]);

  useEffect(() => {
    if (configSnapshot?.params && !configDefaultsApplied.current) {
      configDefaultsApplied.current = true;
      const p = configSnapshot.params;
      /* eslint-disable react-hooks/set-state-in-effect */
      if (typeof p.symbol === 'string') setBacktestSymbol(p.symbol);
      if (typeof p.timeframe === 'string') setBacktestTimeframe(p.timeframe);
      const initialCash = typeof p.initialCash === 'number'
        ? p.initialCash
        : typeof p.initialCapital === 'number'
          ? p.initialCapital
          : undefined;
      if (initialCash !== undefined) setBacktestInitialCapital(initialCash);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [configSnapshot]);

  // ── Run Diagnostics ──
  const handleRunDiagnostics = useCallback(async () => {
    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticProgress({ percent: 0, message: language === 'zh' ? '启动诊断任务…' : 'Starting diagnostics…' });

    try {
      const { id: taskId } = await apiPost<{ id: string; status: string }>('/tasks', {
        type: 'diagnostics',
        payload: {
          strategy: strategy.name,
          configSnapshot: {
            strategy: strategy.name,
            params: {},
          },
        },
      });

      const close = streamTask(
        taskId,
        (event) => {
          if (event.type === 'progress') {
            setDiagnosticProgress({ percent: event.percent ?? 0, message: event.message ?? '' });
          } else if (event.type === 'result') {
            const result = event.data as { resultId?: string; resultType?: string; data?: Record<string, unknown> };
            if (result?.resultId) {
              const url = new URL(window.location.href);
              url.searchParams.set('diagnosticId', result.resultId);
              window.history.replaceState({}, '', url.toString());
              fetchDiagnostic(result.resultId).then((data) => {
                if (data) {
                  setDiagnosticData(data.dataJson);
                  setDiagnosticReady(true);
                }
              });
            }
            if (result?.data) {
              setDiagnosticData(result.data);
              setDiagnosticReady(true);
            }
            setDiagnosticProgress({ percent: 100, message: language === 'zh' ? '诊断完成' : 'Diagnostics complete' });
            close();
          } else if (event.type === 'error') {
            setDiagnosticError(event.error?.message ?? ui.workspaceDiagnosticsFailed);
            close();
          }
        },
        () => {
          setDiagnosticError('SSE connection failed');
        },
      );
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : ui.workspaceDiagnosticsFailed);
    } finally {
      setDiagnosticLoading(false);
    }
  }, [strategy.name, language, ui.workspaceDiagnosticsFailed]);

  // ── Run Backtest ──
  const handleRunBacktest = useCallback(async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    setBacktestProgress({ percent: 0, message: language === 'zh' ? '启动回测…' : 'Starting backtest…' });

    try {
      const { id: taskId } = await submitBacktest({
        strategy: strategy.id,
        symbol: backtestSymbol,
        timeframe: backtestTimeframe,
        initialCash: backtestInitialCapital,
        startTs: 1672675200000,
        endTs: 1735574400000,
      });

      const close = streamBacktestTask(
        taskId,
        (event) => {
          if (event.type === 'progress') {
            setBacktestProgress({ percent: event.percent ?? 0, message: event.message ?? '' });
          } else if (event.type === 'result') {
            const data = event.data as Record<string, unknown> | undefined;
            if (data) {
              setBacktestResult(data);
            }
            setBacktestSubmitted(true);
            setBacktestProgress({ percent: 100, message: language === 'zh' ? '回测完成' : 'Backtest complete' });
            close();
          } else if (event.type === 'error') {
            setBacktestError(event.error?.message ?? ui.workspaceBacktestFailed);
            close();
          }
        },
        () => {
          setBacktestError('SSE connection failed');
        },
      );
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : ui.workspaceBacktestFailed);
    } finally {
      setBacktestLoading(false);
    }
  }, [
    strategy.id,
    backtestSymbol,
    backtestTimeframe,
    backtestInitialCapital,
    language,
    ui.workspaceBacktestFailed,
  ]);

  // ── Step 1 Diagnostics Content ──
  function renderDiagnosticContent() {
    if (diagnosticLoading && !diagnosticData) {
      return (
        <div className={s.loadingPlaceholder}>
          <span className={s.spinner} />
          <span>{ui.workspaceDiagnosticsRunning}</span>
        </div>
      );
    }

    // Factor-based diagnostics
    if (category === 'factor_based') {
      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceICSeries}</div>
            <BarChart data={mockData.factorIcData} />
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceLayeredReturns}</div>
            <HBarChart data={mockData.factorLayerData} />
          </div>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceCorrelationHeatmap}</div>
            <HeatmapChart grid={mockData.factorHeatmap} rowLabels={mockData.factorLabels} colLabels={mockData.factorLabels} />
          </div>
        </div>
      );
    }

    // Non-factor trend / mean-reversion / arbitrage / HFT diagnostics
    if (subcategory === 'trend_cta' || subcategory === 'mean_reversion' ||
        subcategory === 'arbitrage' || subcategory === 'high_frequency' ||
        (category === 'non_factor' && !subcategory)) {
      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceParamSensitivity}</div>
            <HeatmapChart grid={mockData.sensGrid} rowLabels={mockData.sensLabels} colLabels={mockData.sensLabels} />
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceSignalDist}</div>
            <BarChart data={mockData.signalDist} />
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceSlippageStress}</div>
            <LineChart points={mockData.slippagePts} color="#ffa94d" />
            <div style={{ marginTop: 8 }}>
              <MiniGrid items={mockData.costItems} />
            </div>
          </div>
        </div>
      );
    }

    // Macro diagnostics
    if (subcategory === 'macro_quant') {
      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceMacroCorrelation}</div>
            <HeatmapChart grid={mockData.crossCorrGrid} rowLabels={mockData.macroLabels} colLabels={mockData.macroLabels} />
          </div>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceEconomicCycle}</div>
            <div className={s.miniGrid} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {mockData.cycleLabels.map((label, i) => (
                <div key={i} className={s.miniGridCell}>
                  <span className={s.miniGridLabel}>{label}</span>
                  <span className={s.miniGridValue}>{mockData.cycleValues[i]}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <LineChart points={mockData.macroLinePts} />
            </div>
          </div>
        </div>
      );
    }

    // Event-driven diagnostics
    if (subcategory === 'event_driven') {
      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceCARChart}</div>
            <LineChart points={mockData.carPts} />
          </div>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceEventSamples}</div>
            <MiniGrid items={mockData.eventStats} />
            <div style={{ marginTop: 12 }}>
              <BarChart data={genMockBarData(8, 'E')} />
            </div>
          </div>
        </div>
      );
    }

    // E2E AI diagnostics
    if (subcategory === 'e2e_ai_timeseries') {
      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceSHAPImportance}</div>
            <HBarChart data={mockData.shapData} />
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceLossCurves}</div>
            <LineChart points={mockData.trainLoss} />
            <LineChart points={genMockLinePoints(30)} color="rgba(77, 240, 160, 0.35)" />
          </div>
        </div>
      );
    }

    // Tail risk hedging / default
    return (
      <div className={s.chartCardFull}>
        <div className={s.chartCardTitle}>{ui.workspaceSignalMetrics}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <MiniGrid
            items={[
              { label: 'Signal Count', value: '127' },
              { label: 'Win Rate', value: '62.3%' },
              { label: 'Avg Return', value: '1.24%' },
            ]}
          />
        </div>
      </div>
    );
  }

  // ── Step 2 Backtest Content ──
  function renderBacktestContent() {
    const metrics = parsedBacktest?.metrics;
    const equityPoints = parsedBacktest?.equityCurve?.map((point) => point.equity) ?? [];
    const trades = parsedBacktest?.trades ?? [];

    return (
      <>
        {/* Config Summary */}
        <div className={s.configSummary}>
          <div className={s.configItem}>
            <span className={s.configItemLabel}>{language === 'zh' ? '策略' : 'Strategy'}</span>
            <span className={s.configItemValue}>{strategy.name}</span>
          </div>
          <div className={s.configItem}>
            <span className={s.configItemLabel}>{language === 'zh' ? '标的' : 'Symbol'}</span>
            <span className={s.configItemValue}>{backtestSymbol}</span>
          </div>
          <div className={s.configItem}>
            <span className={s.configItemLabel}>{language === 'zh' ? '时间周期' : 'Timeframe'}</span>
            <span className={s.configItemValue}>{backtestTimeframe}</span>
          </div>
          <div className={s.configItem}>
            <span className={s.configItemLabel}>{language === 'zh' ? '初始资金' : 'Initial Cash'}</span>
            <span className={s.configItemValue}>¥{backtestInitialCapital.toLocaleString()}</span>
          </div>
          <div className={s.configItem}>
            <span className={s.configItemLabel}>{language === 'zh' ? '回测区间' : 'Backtest Range'}</span>
            <span className={s.configItemValue}>2023-01-01 ~ 2024-12-31</span>
          </div>
        </div>

        {/* Action button */}
        {!backtestSubmitted && (
          <div style={{ marginBottom: 16 }}>
            <button
              className={s.primaryButton}
              onClick={handleRunBacktest}
              disabled={backtestLoading}
              type="button"
            >
              {backtestLoading ? ui.workspaceBacktestRunning : ui.workspaceSubmitBacktest}
            </button>
          </div>
        )}

        {/* Backtest progress */}
        <ProgressBar progress={backtestProgress} />
        {backtestError && (
          <ErrorBox message={backtestError} onRetry={handleRunBacktest} />
        )}

        {/* Performance metrics */}
        {(backtestSubmitted || backtestResult) && (
          <>
            <div className={s.chartCardTitle}>{ui.workspacePerformanceTitle}</div>
            <div className={s.perfGrid}>
              <div className={s.perfCard}>
                <div className={`${s.perfCardValue} ${(metrics?.totalReturn ?? 0) > 0 ? s.perfCardGood : s.perfCardWarn}`}>
                  {formatPercent(metrics?.totalReturn)}
                </div>
                <div className={s.perfCardLabel}>{language === 'zh' ? '总收益' : 'Total Return'}</div>
              </div>
              <div className={s.perfCard}>
                <div className={`${s.perfCardValue} ${s.perfCardWarn}`}>
                  {formatPercent(metrics?.maxDrawdown)}
                </div>
                <div className={s.perfCardLabel}>{language === 'zh' ? '最大回撤' : 'Max Drawdown'}</div>
              </div>
              <div className={s.perfCard}>
                <div className={`${s.perfCardValue} ${(metrics?.sharpeRatio ?? 0) > 1 ? s.perfCardGood : s.perfCardWarn}`}>
                  {formatNumber(metrics?.sharpeRatio)}
                </div>
                <div className={s.perfCardLabel}>{language === 'zh' ? '夏普比率' : 'Sharpe Ratio'}</div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className={s.chartCardTitle}>{ui.workspaceEquityCurve}</div>
            <div className={s.equityCurve}>
              <LineChart points={equityPoints} />
            </div>

            {/* Trade Details */}
            <div className={s.chartCardTitle}>{ui.workspaceTradeDetails}</div>
            <div style={{ overflowX: 'auto' }}>
              <table className={s.tradeTable}>
                <thead>
                  <tr>
                    <th>{language === 'zh' ? '日期' : 'Date'}</th>
                    <th>{language === 'zh' ? '方向' : 'Side'}</th>
                    <th>{language === 'zh' ? '价格' : 'Price'}</th>
                    <th>{language === 'zh' ? '数量' : 'Shares'}</th>
                    <th>{language === 'zh' ? '盈亏' : 'P&L'}</th>
                    <th>{language === 'zh' ? '原因' : 'Reason'}</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t, i) => {
                    const quantity = t.quantity ?? t.shares;
                    return (
                      <tr key={i}>
                        <td>{formatTradeDate(t)}</td>
                        <td className={t.side === 'buy' ? s.tradeBuy : s.tradeSell}>
                          {formatTradeSide(t.side, language)}
                        </td>
                        <td>{formatNumber(t.price)}</td>
                        <td>{quantity !== undefined ? quantity.toLocaleString() : '--'}</td>
                        <td style={{ color: (t.pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red, #ff6b6b)' }}>
                          {(t.pnl ?? 0) >= 0 ? '+' : ''}{formatNumber(t.pnl)}
                        </td>
                        <td>{t.reason ?? '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {trades.length === 0 && <div className={s.emptyState}>No trades</div>}
            </div>
          </>
        )}

        {!backtestSubmitted && !backtestLoading && !backtestResult && (
          <div className={s.emptyState}>
            <span>{language === 'zh' ? '点击「提交回测」开始运行' : 'Click "Submit Backtest" to run'}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={s.workspacePage}>
      {/* Back button */}
      <button className={s.backButton} onClick={onBack} type="button">
        {ui.workspaceBackButton}
      </button>

      {/* Header */}
      <div className={s.workspaceHeader}>
        <h2 className={s.workspaceTitle}>{strategy.name}</h2>
        <span className={s.workspaceSubtitle}>{strategy.description}</span>
      </div>

      {/* Stepper */}
      <div className={s.stepper}>
        <div className={`${s.step} ${step === 1 ? s.stepActive : s.stepCompleted}`}>
          <div className={s.stepCircle}>{step > 1 ? '✓' : '1'}</div>
          <div className={s.stepLabel}>
            <span className={s.stepTitle}>{ui.workspaceStep1Label}</span>
            <span className={s.stepDesc}>{ui.workspaceStep1Desc}</span>
          </div>
        </div>
        <div className={s.stepConnector}>
          <div className={`${s.connectorLine} ${step > 1 ? s.connectorActive : ''}`} />
        </div>
        <div className={`${s.step} ${step === 2 ? s.stepActive : ''}`}>
          <div className={s.stepCircle}>2</div>
          <div className={s.stepLabel}>
            <span className={s.stepTitle}>{ui.workspaceStep2Label}</span>
            <span className={s.stepDesc}>{ui.workspaceStep2Desc}</span>
          </div>
        </div>
      </div>

      {/* Step 1: Diagnostics */}
      {step === 1 && (
        <div className={s.stepContent}>
          <div className={s.diagnosticActions}>
            <button
              className={s.primaryButton}
              onClick={handleRunDiagnostics}
              disabled={diagnosticLoading}
              type="button"
            >
              {diagnosticLoading ? ui.workspaceDiagnosticsRunning : ui.workspaceRunDiagnostics}
            </button>
          </div>

          <ProgressBar progress={diagnosticProgress} />
          {diagnosticError && (
            <ErrorBox message={diagnosticError} onRetry={handleRunDiagnostics} />
          )}

          {renderDiagnosticContent()}

          {diagnosticReady && (
            <button
              className={s.confirmButton}
              onClick={() => setStep(2)}
              type="button"
            >
              {ui.workspaceConfirmStep2}
            </button>
          )}

          {!diagnosticLoading && !diagnosticError && !diagnosticReady && !diagnosticData && (
            <div className={s.emptyState}>
              <span>{language === 'zh' ? '点击「开始诊断」分析策略特征' : 'Click "Run Diagnostics" to analyze'}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Backtest */}
      {step === 2 && (
        <div className={s.stepContent}>
          <div className={s.chartCardTitle}>{ui.workspaceConfigSummary}</div>
          {renderBacktestContent()}
        </div>
      )}
    </div>
  );
}
