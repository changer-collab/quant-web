/** 研究模式 */
export enum ResearchMode {
  Traditional = 'traditional',
  HighFrequency = 'highFrequency',
  AI = 'ai',
}

/** 任务状态 */
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** 任务类型 */
export enum TaskType {
  Backtest = 'backtest',
  Training = 'training',
  FactorCompute = 'factorCompute',
  FactorEval = 'factorEval',
}

/** 回测配置 */
export interface BacktestConfig {
  strategyName: string;
  mode: ResearchMode;
  instruments: import('./market').Instrument[];
  timeframe: import('./market').TimeFrame;
  startDate: number;
  endDate: number;
  initialCash: number;
  slippage: number;
  params: Record<string, unknown>;
}

/** 回测指标 */
export interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

/** 权益曲线点 */
export interface EquityPoint {
  timestamp: number;
  equity: number;
}

/** 回测结果 */
export interface BacktestResult {
  config: BacktestConfig;
  trades: import('./portfolio').Trade[];
  equityCurve: EquityPoint[];
  metrics: BacktestMetrics;
}
