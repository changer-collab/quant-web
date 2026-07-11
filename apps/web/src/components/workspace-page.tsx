import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  StrategyRow,
  UiCopy,
  LanguageCode,
  ConfigSnapshot,
  PreviewResponse,
} from '../appData';
import { apiPost } from '../api/client';
import { streamTask } from '../api/tasks';
import { fetchDiagnostic } from '../api/diagnostics';
import { submitBacktest, streamTask as streamBacktestTask } from '../api/tasks';
import { fetchStrategyConfig } from '../api/strategies-config';
import { ConfigPanel } from './config-panel';
import { KlineChart } from './kline-chart';
import { fetchPreview } from '../api/preview';
import s from '../styles/workspace-page.module.css';

// ── Types ────────────────────────────────────────────────────

interface WorkspacePageProps {
  strategy: StrategyRow;
  onBack: () => void;
  language: LanguageCode;
  ui: UiCopy;
  onBacktestComplete?: (result: {
    taskId: string;
    taskResult: Record<string, unknown> | undefined;
    config: {
      symbol: string;
      timeframe: string;
      initialCash: number;
      startTs: number;
      endTs: number;
    };
  }) => void;
}

type WorkspaceTab = 'config' | 'diagnose' | 'backtest';
type ProgressState = { percent: number; message: string } | null;

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

// ── Chart subcomponents ──────────────────────────────────────

function BarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => Math.abs(d.value)), 0.001);
  const negVals = data.some((d) => d.value < 0);
  const range = negVals ? maxVal * 2 : maxVal;

  return (
    <div className={s.barChart} style={{ height }}>
      {data.map((d, i) => {
        const h = negVals ? (Math.abs(d.value) / range) * 100 : (d.value / range) * 100;
        return (
          <div
            key={i}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
          >
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

function HeatmapChart({
  grid,
  rowLabels,
  colLabels,
}: {
  grid: number[][];
  rowLabels: string[];
  colLabels: string[];
}) {
  const maxAbs = Math.max(...grid.flat().map(Math.abs), 0.01);
  return (
    <div
      className={s.heatmapGrid}
      style={{ gridTemplateColumns: `auto repeat(${colLabels.length}, 1fr)` }}
    >
      <div />
      {colLabels.map((cl, ci) => (
        <div className={s.heatmapLabel} key={ci}>
          {cl}
        </div>
      ))}
      {grid.map((row, ri) => (
        <>
          <div className={s.heatmapLabel} key={`rl-${ri}`}>
            {rowLabels[ri]}
          </div>
          {row.map((cell, ci) => {
            const intensity = Math.abs(cell) / maxAbs;
            return (
              <div
                className={s.heatmapCell}
                key={`${ri}-${ci}`}
                style={{
                  background:
                    cell >= 0
                      ? `rgba(77, 240, 160, ${intensity * 0.7 + 0.1})`
                      : `rgba(255, 80, 80, ${intensity * 0.7 + 0.1})`,
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
  const raw =
    data.backtestResult && typeof data.backtestResult === 'object'
      ? (data.backtestResult as Record<string, unknown>)
      : data;
  const metricsRaw =
    raw.metrics && typeof raw.metrics === 'object' ? (raw.metrics as Record<string, unknown>) : {};
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
    ? raw.trades.filter((trade): trade is BacktestTradeView =>
        Boolean(trade && typeof trade === 'object')
      )
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

export function WorkspacePage({
  strategy,
  onBack,
  language,
  ui,
  onBacktestComplete,
}: WorkspacePageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('config');
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [klineLoading, setKlineLoading] = useState(true);
  const [klineSymbol, setKlineSymbol] = useState('600519');
  const [klineError, setKlineError] = useState<string | null>(null);

  // 诊断状态（原 step 1）
  const [diagnosticData, setDiagnosticData] = useState<Record<string, unknown> | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticProgress, setDiagnosticProgress] = useState<ProgressState>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticReady, setDiagnosticReady] = useState(false);

  // 回测状态（原 step 2）
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState<ProgressState>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<Record<string, unknown> | null>(null);
  const [backtestSubmitted, setBacktestSubmitted] = useState(false);
  const [backtestSymbol, setBacktestSymbol] = useState('600519');
  const [backtestTimeframe, setBacktestTimeframe] = useState('1d');
  const [backtestInitialCapital, setBacktestInitialCapital] = useState(1_000_000);
  const [backtestStartDate, setBacktestStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [backtestEndDate, setBacktestEndDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const configDefaultsApplied = useRef(false);

  const category = strategy.category ?? 'non_factor';
  const parsedBacktest = extractBacktestResult(backtestResult);

  // ── F5 recovery: check URL for ?diagnosticId on mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('diagnosticId');
    if (id) {
      fetchDiagnostic(id)
        .then((data) => {
          if (data) {
            setDiagnosticData(data.data);
            setDiagnosticReady(true);
          } else {
            setDiagnosticError(ui.workspaceDiagnosticExpired);
          }
        })
        .catch(() => setDiagnosticError(ui.workspaceDiagnosticExpired))
        .finally(() => setDiagnosticLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 读取 configSnapshot，依赖 configVersion（ConfigPanel 保存后递增触发刷新）
  useEffect(() => {
    configDefaultsApplied.current = false;
    fetchStrategyConfig(strategy.id)
      .then((res) => {
        setConfigSnapshot(res?.configSnapshot ?? null);
      })
      .catch((err) => {
        console.warn('Failed to fetch strategy config:', err);
      });
  }, [strategy.id, configVersion]);

  // ── Set backtest form defaults from configSnapshot when it loads ──
  useEffect(() => {
    if (configSnapshot?.params && !configDefaultsApplied.current) {
      configDefaultsApplied.current = true;
      const p = configSnapshot.params;
      /* eslint-disable react-hooks/set-state-in-effect */
      if (typeof p.symbol === 'string') setBacktestSymbol(p.symbol);
      if (typeof p.timeframe === 'string') setBacktestTimeframe(p.timeframe);
      const initialCash =
        typeof p.initialCash === 'number'
          ? p.initialCash
          : typeof p.initialCapital === 'number'
            ? p.initialCapital
            : undefined;
      if (initialCash !== undefined) setBacktestInitialCapital(initialCash);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [configSnapshot]);

  const handleConfigSaved = useCallback(() => {
    setConfigVersion((v) => v + 1);
  }, []);

  const handlePreviewUpdate = useCallback((data: PreviewResponse | null) => {
    setPreviewData(data);
  }, []);

  const handleSymbolChange = useCallback(
    async (newSymbol: string) => {
      setKlineSymbol(newSymbol);
      setKlineLoading(true);
      setKlineError(null);
      try {
        const data = await fetchPreview(strategy.id, {
          symbol: newSymbol,
          timeframe: '1d',
          limit: 120,
          preview_params: {},
        });
        setPreviewData(data);
      } catch (err) {
        setKlineError(
          language === 'zh'
            ? `加载 ${newSymbol} K 线失败：${err instanceof Error ? err.message : String(err)}`
            : `Failed to load ${newSymbol}: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setKlineLoading(false);
      }
    },
    [strategy.id, language]
  );

  const handleLoadMore = useCallback(
    async (cursor: number) => {
      if (!previewData) return;
      setKlineLoading(true);
      setKlineError(null);
      try {
        const data = await fetchPreview(strategy.id, {
          symbol: klineSymbol,
          timeframe: '1d',
          cursor,
          limit: 50,
          preview_params: {},
        });
        if (data.bars.length > 0) {
          setPreviewData({ ...data, bars: [...data.bars, ...previewData.bars] });
        }
      } catch (err) {
        setKlineError(
          language === 'zh'
            ? `加载更多数据失败：${err instanceof Error ? err.message : String(err)}`
            : `Failed to load more: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setKlineLoading(false);
      }
    },
    [strategy.id, klineSymbol, previewData, language]
  );

  // ── 初始自动加载 K 线（仅挂载时执行一次，避免进入页面看到空状态） ──
  useEffect(() => {
    if (previewData) return; // 已有数据不重复加载
    void fetchPreview(strategy.id, {
      symbol: klineSymbol,
      timeframe: '1d',
      limit: 120,
      preview_params: {},
    })
      .then((data) => setPreviewData(data))
      .catch((err) => {
        setKlineError(
          language === 'zh'
            ? `加载 ${klineSymbol} K 线失败：${err instanceof Error ? err.message : String(err)}`
            : `Failed to load ${klineSymbol}: ${err instanceof Error ? err.message : String(err)}`
        );
      })
      .finally(() => setKlineLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅挂载时执行一次

  // ── Run Diagnostics ──
  const handleRunDiagnostics = useCallback(async () => {
    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticProgress({
      percent: 0,
      message: language === 'zh' ? '启动诊断任务…' : 'Starting diagnostics…',
    });

    try {
      const { id: taskId } = await apiPost<{ id: string; status: string }>('/tasks', {
        type: 'diagnostics',
        payload: {
          strategy: strategy.id,
          configSnapshot: configSnapshot ?? { strategy: strategy.id, params: {} },
          category,
        },
      });

      const close = streamTask(
        taskId,
        (event) => {
          if (event.type === 'progress') {
            setDiagnosticProgress({ percent: event.percent ?? 0, message: event.message ?? '' });
          } else if (event.type === 'result') {
            const result = event.data as {
              data?: Record<string, unknown>;
              diagnostics?: Record<string, unknown>;
              resultId?: string;
              resultType?: string;
            };
            if (result?.resultId) {
              const url = new URL(window.location.href);
              url.searchParams.set('diagnosticId', result.resultId);
              window.history.replaceState({}, '', url.toString());
              fetchDiagnostic(result.resultId).then((data) => {
                if (data) {
                  setDiagnosticData(data.data);
                  setDiagnosticReady(true);
                }
              });
            }
            const diagnostics = result?.diagnostics ?? result?.data;
            if (diagnostics) {
              setDiagnosticData(diagnostics);
              setDiagnosticReady(true);
            }
            setDiagnosticProgress({
              percent: 100,
              message: language === 'zh' ? '诊断完成' : 'Diagnostics complete',
            });
            close();
          } else if (event.type === 'error') {
            setDiagnosticError(event.error?.message ?? ui.workspaceDiagnosticsFailed);
            close();
          }
        },
        () => {
          setDiagnosticError('SSE connection failed');
        }
      );
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : ui.workspaceDiagnosticsFailed);
    } finally {
      setDiagnosticLoading(false);
    }
  }, [strategy.id, category, configSnapshot, language, ui.workspaceDiagnosticsFailed]);

  // ── Run Backtest ──
  const handleRunBacktest = useCallback(async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    setBacktestProgress({
      percent: 0,
      message: language === 'zh' ? '启动回测…' : 'Starting backtest…',
    });

    try {
      const { id: taskId } = await submitBacktest({
        strategy: strategy.id,
        symbol: backtestSymbol,
        timeframe: backtestTimeframe,
        initialCash: backtestInitialCapital,
        configSnapshot: configSnapshot ?? { strategy: strategy.id, params: {} },
        startTs: new Date(backtestStartDate).getTime(),
        endTs: new Date(backtestEndDate).getTime(),
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
            onBacktestComplete?.({
              taskId,
              taskResult: data,
              config: {
                symbol: backtestSymbol,
                timeframe: backtestTimeframe,
                initialCash: backtestInitialCapital,
                startTs: new Date(backtestStartDate).getTime(),
                endTs: new Date(backtestEndDate).getTime(),
              },
            });
            setBacktestProgress({
              percent: 100,
              message: language === 'zh' ? '回测完成' : 'Backtest complete',
            });
            close();
          } else if (event.type === 'error') {
            setBacktestError(event.error?.message ?? ui.workspaceBacktestFailed);
            close();
          }
        },
        () => {
          setBacktestError('SSE connection failed');
        }
      );
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : ui.workspaceBacktestFailed);
    } finally {
      setBacktestLoading(false);
    }
  }, [
    strategy.id,
    configSnapshot,
    language,
    ui.workspaceBacktestFailed,
    backtestSymbol,
    backtestTimeframe,
    backtestInitialCapital,
    backtestStartDate,
    backtestEndDate,
    onBacktestComplete,
  ]);

  // ── Helpers: parse real diagnostic data for chart rendering ──
  function parseFactorDiagnostics(data: Record<string, unknown>) {
    const icSeries = (data.ic_series as Array<{ period: string; ic: number }>) ?? [];
    const layeredReturns = (data.layered_returns as Record<string, number[]>) ?? {};
    const corrMatrix = (data.correlation_matrix as number[][]) ?? [];
    const factorLabels = (data.factor_labels as string[]) ?? [];
    const summary = (data.summary as Record<string, number>) ?? {};

    const icData = icSeries.map((item) => ({ label: item.period, value: item.ic }));
    const layerData = Object.entries(layeredReturns).map(([group, vals]) => ({
      label: group,
      value: vals.length > 1 ? Math.round((vals[vals.length - 1] - 1) * 100 * 100) / 100 : 0,
    }));
    const summaryItems = [
      { label: 'Mean IC', value: (summary.mean_ic ?? 0).toFixed(4) },
      { label: 'IC Std', value: (summary.ic_std ?? 0).toFixed(4) },
      { label: 'IC IR', value: (summary.ic_ir ?? 0).toFixed(4) },
      { label: 'Mean Rank IC', value: (summary.mean_rank_ic ?? 0).toFixed(4) },
    ];

    return {
      icData,
      layerData,
      corrMatrix,
      factorLabels,
      summaryItems,
      hasData: icSeries.length > 0,
    };
  }

  function parseNonFactorDiagnostics(data: Record<string, unknown>) {
    const paramSens =
      (data.param_sensitivity as Array<{
        param: string;
        values: number[];
        returns: number[];
        sharpe: number[];
      }>) ?? [];
    const signalQuality = (data.signal_quality as Record<string, number>) ?? {};
    const slippageStress =
      (data.slippage_stress as Array<{
        bps: number;
        return: number;
        sharpe: number;
        trade_count: number;
      }>) ?? [];

    const sensSharpeGrid = paramSens.map((p) => p.sharpe ?? []);
    const sensLabels = paramSens.map((p) => p.param);
    const hasSens = sensSharpeGrid.length > 0 && sensSharpeGrid[0]?.length > 0;

    const signalItems = [
      { label: 'Total Signals', value: String(signalQuality.total_signals ?? 0) },
      { label: 'Win Rate', value: `${((signalQuality.win_rate ?? 0) * 100).toFixed(1)}%` },
      { label: 'Avg Holding', value: `${(signalQuality.avg_holding_bars ?? 0).toFixed(1)} bars` },
      { label: 'Profit Factor', value: (signalQuality.profit_factor ?? 0).toFixed(2) },
    ];

    const slippageReturns = slippageStress.map((s) => s.return as number);
    const costItems =
      slippageStress.length >= 4
        ? [
            { label: '1 bp Return', value: `${(slippageStress[0].return * 100).toFixed(2)}%` },
            { label: '10 bp Return', value: `${(slippageStress[3].return * 100).toFixed(2)}%` },
            {
              label: 'Cost Drag',
              value: `${((slippageStress[0].return - slippageStress[3].return) * 100).toFixed(2)}%`,
            },
          ]
        : [];

    return {
      sensSharpeGrid,
      sensLabels,
      hasSens,
      signalItems,
      slippageReturns,
      costItems,
      hasData: true,
    };
  }

  // ── Diagnostics Content（在 diagnose Tab 内直接调用） ──
  function renderDiagnosticContent() {
    if (diagnosticLoading && !diagnosticData) {
      return (
        <div className={s.loadingPlaceholder}>
          <span className={s.spinner} />
          <span>{ui.workspaceDiagnosticsRunning}</span>
        </div>
      );
    }

    if (!diagnosticData) {
      if (diagnosticReady) {
        return (
          <div className={s.emptyState}>
            {language === 'zh' ? '暂无诊断数据' : 'No diagnostic data available'}
          </div>
        );
      }
      return null;
    }

    const data = diagnosticData;
    const diagType = (data.type as string) || '';

    // Factor-based diagnostics (also covers transitional which has same structure)
    if (diagType === 'factor_based' || diagType === 'transitional') {
      const { icData, layerData, corrMatrix, factorLabels, summaryItems, hasData } =
        parseFactorDiagnostics(data);

      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceICSeries}</div>
            <div className={s.cardBody}>
              {hasData ? (
                <BarChart data={icData} />
              ) : (
                <div className={s.emptyState}>No IC data</div>
              )}
            </div>
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceLayeredReturns}</div>
            <div className={s.cardBody}>
              {layerData.length > 0 ? (
                <HBarChart data={layerData} />
              ) : (
                <div className={s.emptyState}>No layer data</div>
              )}
            </div>
          </div>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceCorrelationHeatmap}</div>
            <div className={s.cardBody}>
              {corrMatrix.length > 0 && factorLabels.length > 0 ? (
                <HeatmapChart grid={corrMatrix} rowLabels={factorLabels} colLabels={factorLabels} />
              ) : (
                <div className={s.emptyState}>No correlation data</div>
              )}
            </div>
          </div>
          <div className={s.chartCardFull}>
            <div className={s.cardBody}>
              <MiniGrid items={summaryItems} />
            </div>
          </div>
        </div>
      );
    }

    // Non-factor diagnostics
    if (diagType === 'non_factor') {
      const { sensSharpeGrid, sensLabels, hasSens, signalItems, slippageReturns, costItems } =
        parseNonFactorDiagnostics(data);

      return (
        <div className={s.diagnosticGrid}>
          <div className={s.chartCardFull}>
            <div className={s.chartCardTitle}>{ui.workspaceParamSensitivity}</div>
            <div className={s.cardBody}>
              {hasSens ? (
                <HeatmapChart grid={sensSharpeGrid} rowLabels={sensLabels} colLabels={sensLabels} />
              ) : (
                <div className={s.emptyState}>No param sensitivity data</div>
              )}
            </div>
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceSignalDist}</div>
            <div className={s.cardBody}>
              <MiniGrid items={signalItems} />
            </div>
          </div>
          <div className={s.chartCard}>
            <div className={s.chartCardTitle}>{ui.workspaceSlippageStress}</div>
            <div className={s.cardBody}>
              {slippageReturns.length > 0 ? (
                <LineChart points={slippageReturns} color="#ffa94d" />
              ) : (
                <div className={s.emptyState}>No slippage data</div>
              )}
              {costItems.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <MiniGrid items={costItems} />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Fallback for unknown types
    return (
      <div className={s.chartCardFull}>
        <div className={s.chartCardTitle}>{ui.workspaceSignalMetrics}</div>
        <div className={s.cardBody}>
          <div className={s.emptyState}>Diagnostics data available</div>
        </div>
      </div>
    );
  }

  // ── Backtest Content（在 backtest Tab 内直接调用） ──
  function renderBacktestContent() {
    const metrics = parsedBacktest?.metrics;
    const equityPoints = parsedBacktest?.equityCurve?.map((point) => point.equity) ?? [];
    const trades = parsedBacktest?.trades ?? [];

    return (
      <>
        {/* Editable backtest parameter form (shown before submission) */}
        {!backtestSubmitted && (
          <>
            <div className={s.chartCardTitle}>{ui.workspaceBacktestConfigTitle}</div>
            <div className={s.backtestForm}>
              <div className={s.formRow}>
                <label className={s.formLabel}>{ui.workspaceBacktestSymbol}</label>
                <input
                  className={s.formInput}
                  value={backtestSymbol}
                  onChange={(e) => setBacktestSymbol(e.target.value)}
                  placeholder="e.g. 600519"
                  disabled={backtestLoading}
                />
              </div>
              <div className={s.formRow}>
                <label className={s.formLabel}>{ui.workspaceBacktestTimeframe}</label>
                <select
                  className={s.formSelect}
                  value={backtestTimeframe}
                  onChange={(e) => setBacktestTimeframe(e.target.value)}
                  disabled={backtestLoading}
                >
                  <option value="1d">1d</option>
                  <option value="1h">1h</option>
                  <option value="30m">30m</option>
                </select>
              </div>
              <div className={s.formRow}>
                <label className={s.formLabel}>{ui.workspaceBacktestInitialCapital}</label>
                <input
                  className={s.formInput}
                  type="number"
                  min={1000}
                  step={100000}
                  value={backtestInitialCapital}
                  onChange={(e) => setBacktestInitialCapital(Number(e.target.value))}
                  disabled={backtestLoading}
                />
              </div>
              <div className={s.formRow}>
                <label className={s.formLabel}>{ui.workspaceBacktestStartDate}</label>
                <input
                  className={s.formInput}
                  type="date"
                  value={backtestStartDate}
                  onChange={(e) => setBacktestStartDate(e.target.value)}
                  disabled={backtestLoading}
                />
              </div>
              <div className={s.formRow}>
                <label className={s.formLabel}>{ui.workspaceBacktestEndDate}</label>
                <input
                  className={s.formInput}
                  type="date"
                  value={backtestEndDate}
                  onChange={(e) => setBacktestEndDate(e.target.value)}
                  disabled={backtestLoading}
                />
              </div>
            </div>

            {/* Action button */}
            <button
              className={s.primaryButton}
              onClick={handleRunBacktest}
              disabled={backtestLoading}
              type="button"
            >
              {backtestLoading ? ui.workspaceBacktestRunning : ui.workspaceSubmitBacktest}
            </button>
          </>
        )}

        {/* Read-only summary after submission */}
        {backtestSubmitted && (
          <div className={s.configSummary}>
            <div className={s.configItem}>
              <span className={s.configItemLabel}>{ui.workspaceBacktestSymbol}</span>
              <span className={s.configItemValue}>{backtestSymbol}</span>
            </div>
            <div className={s.configItem}>
              <span className={s.configItemLabel}>{ui.workspaceBacktestTimeframe}</span>
              <span className={s.configItemValue}>{backtestTimeframe}</span>
            </div>
            <div className={s.configItem}>
              <span className={s.configItemLabel}>{ui.workspaceBacktestInitialCapital}</span>
              <span className={s.configItemValue}>¥{backtestInitialCapital.toLocaleString()}</span>
            </div>
            <div className={s.configItem}>
              <span className={s.configItemLabel}>{ui.workspaceBacktestStartDate}</span>
              <span className={s.configItemValue}>{backtestStartDate}</span>
            </div>
            <div className={s.configItem}>
              <span className={s.configItemLabel}>{ui.workspaceBacktestEndDate}</span>
              <span className={s.configItemValue}>{backtestEndDate}</span>
            </div>
          </div>
        )}

        {/* Backtest progress */}
        <ProgressBar progress={backtestProgress} />
        {backtestError && <ErrorBox message={backtestError} onRetry={handleRunBacktest} />}

        {/* Performance metrics */}
        {(backtestSubmitted || backtestResult) && (
          <div className={s.backtestStack}>
            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>{ui.workspacePerformanceTitle}</span>
              </div>
              <div className={s.cardBody}>
                <div className={s.perfGrid}>
                  <div className={s.perfCard}>
                    <div
                      className={`${s.perfCardValue} ${(metrics?.totalReturn ?? 0) > 0 ? s.perfCardGood : s.perfCardWarn}`}
                    >
                      {formatPercent(metrics?.totalReturn)}
                    </div>
                    <div className={s.perfCardLabel}>
                      {language === 'zh' ? '总收益' : 'Total Return'}
                    </div>
                  </div>
                  <div className={s.perfCard}>
                    <div className={`${s.perfCardValue} ${s.perfCardWarn}`}>
                      {formatPercent(metrics?.maxDrawdown)}
                    </div>
                    <div className={s.perfCardLabel}>
                      {language === 'zh' ? '最大回撤' : 'Max Drawdown'}
                    </div>
                  </div>
                  <div className={s.perfCard}>
                    <div
                      className={`${s.perfCardValue} ${(metrics?.sharpeRatio ?? 0) > 1 ? s.perfCardGood : s.perfCardWarn}`}
                    >
                      {formatNumber(metrics?.sharpeRatio)}
                    </div>
                    <div className={s.perfCardLabel}>
                      {language === 'zh' ? '夏普比率' : 'Sharpe Ratio'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Equity Curve */}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>{ui.workspaceEquityCurve}</span>
              </div>
              <div className={s.cardBody}>
                <div className={s.equityCurve}>
                  <LineChart points={equityPoints} />
                </div>
              </div>
            </div>

            {/* Trade Details */}
            <div className={s.card}>
              <div className={s.cardHeader}>
                <span className={s.cardTitle}>{ui.workspaceTradeDetails}</span>
              </div>
              <div className={s.cardBody}>
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
                            <td
                              style={{
                                color: (t.pnl ?? 0) >= 0 ? 'var(--green)' : 'var(--red, #ff6b6b)',
                              }}
                            >
                              {(t.pnl ?? 0) >= 0 ? '+' : ''}
                              {formatNumber(t.pnl)}
                            </td>
                            <td>{t.reason ?? '--'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {trades.length === 0 && <div className={s.emptyState}>No trades</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {!backtestSubmitted && !backtestLoading && !backtestResult && (
          <div className={s.emptyState}>
            <span>
              {language === 'zh'
                ? '填写上方参数后点击「提交回测」'
                : 'Fill in the parameters and click "Submit Backtest"'}
            </span>
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

      {/* Tab 导航（替代原 Stepper） */}
      <div className={s.tabNav}>
        {[
          { key: 'config' as const, label: ui.workspaceTabConfig },
          { key: 'diagnose' as const, label: ui.workspaceTabDiagnose },
          { key: 'backtest' as const, label: ui.workspaceTabBacktest },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`${s.tabButton} ${activeTab === tab.key ? s.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={s.tabContent}>
        {/* Tab 1: 参数配置（ConfigPanel + KlineChart） */}
        {activeTab === 'config' && (
          <div className={s.configTabLayout}>
            <div className={s.configPanelWrapper}>
              <div className={s.card}>
                <div className={s.cardHeader}>
                  <span className={s.cardTitle}>{ui.workspaceTabConfig}</span>
                </div>
                <div className={s.cardBody}>
                  <ConfigPanel
                    strategy={strategy}
                    ui={ui}
                    language={language}
                    onPreviewUpdate={handlePreviewUpdate}
                    onConfigSaved={handleConfigSaved}
                    klineSymbol={klineSymbol}
                  />
                </div>
              </div>
            </div>
            <div className={s.klinePanelWrapper}>
              <div className={s.card}>
                <KlineChart
                  previewData={previewData}
                  subcategory={strategy.subcategory}
                  ui={ui}
                  language={language}
                  onSymbolChange={handleSymbolChange}
                  onLoadMore={handleLoadMore}
                  loading={klineLoading}
                  error={klineError}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: 诊断（原 step 1） */}
        {activeTab === 'diagnose' && (
          <div>
            {!configSnapshot ? (
              <div className={s.noConfigHint}>{ui.workspaceNoConfigHint}</div>
            ) : (
              <>
                <div className={s.diagnosticActions}>
                  <button
                    className={s.primaryButton}
                    onClick={handleRunDiagnostics}
                    disabled={diagnosticLoading}
                    type="button"
                  >
                    {diagnosticLoading
                      ? ui.workspaceDiagnosticsRunning
                      : ui.workspaceRunDiagnostics}
                  </button>
                </div>

                <ProgressBar progress={diagnosticProgress} />
                {diagnosticError && (
                  <ErrorBox message={diagnosticError} onRetry={handleRunDiagnostics} />
                )}

                {renderDiagnosticContent()}

                {!diagnosticLoading && !diagnosticError && !diagnosticReady && !diagnosticData && (
                  <div className={s.emptyState}>
                    <span>
                      {language === 'zh'
                        ? '点击「开始诊断」分析策略特征'
                        : 'Click "Run Diagnostics" to analyze'}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 3: 回测（原 step 2） */}
        {activeTab === 'backtest' && (
          <div>
            {!configSnapshot ? (
              <div className={s.noConfigHint}>{ui.workspaceNoConfigHint}</div>
            ) : (
              <>
                <div className={s.chartCardTitle}>{ui.workspaceConfigSummary}</div>
                {renderBacktestContent()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
