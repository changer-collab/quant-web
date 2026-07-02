import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/** 回测报告表 */
export const backtestReports = sqliteTable('backtest_reports', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  strategyName: text('strategy_name').notNull(),
  symbol: text('symbol').notNull(),
  timeframe: text('timeframe').notNull(),
  startTime: integer('start_time'),
  endTime: integer('end_time'),
  createdAt: integer('created_at').notNull(),
  // 核心指标
  totalReturn: real('total_return').notNull(),
  annualizedReturn: real('annualized_return').notNull(),
  sharpeRatio: real('sharpe_ratio').notNull(),
  maxDrawdown: real('max_drawdown').notNull(),
  winRate: real('win_rate').notNull(),
  totalTrades: integer('total_trades').notNull(),
  // 完整报告数据（JSON 序列化）
  reportData: text('report_data').notNull(),
});

/** 因子评估结果表 */
export const factorEvaluations = sqliteTable('factor_evaluations', {
  id: text('id').primaryKey(),
  factorId: text('factor_id').notNull(),
  taskId: text('task_id').notNull(),
  createdAt: integer('created_at').notNull(),
  // 评估指标
  icMean: real('ic_mean'),
  icStd: real('ic_std'),
  rankIcMean: real('rank_ic_mean'),
  rankIcStd: real('rank_ic_std'),
  icir: real('icir'),
  rankIcir: real('rank_icir'),
  // 分组收益
  groupReturns: text('group_returns'), // JSON array
  // 完整评估数据（JSON 序列化）
  evalData: text('eval_data').notNull(),
});

/** 策略配置表 */
export const strategyConfigs = sqliteTable('strategy_configs', {
  strategy: text('strategy').primaryKey(),
  configJson: text('config_json').notNull(),
  hash: text('hash').notNull(),
  updatedAt: integer('updated_at').notNull(),
  category: text('category').notNull().default('non_factor'),
  subcategory: text('subcategory'),
  schemaVersion: integer('schema_version').notNull().default(1),
});

/** 策略配置历史表 */
export const configHistory = sqliteTable('config_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  strategy: text('strategy').notNull(),
  configJson: text('config_json').notNull(),
  hash: text('hash').notNull(),
  createdAt: integer('created_at').notNull(),
  strategyVersion: text('strategy_version'),
  category: text('category'),
  subcategory: text('subcategory'),
  schemaVersion: integer('schema_version'),
});

/** 诊断结果表 */
export const diagnosticResults = sqliteTable('diagnostic_results', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull(),
  strategy: text('strategy').notNull(),
  category: text('category').notNull().default('non_factor'),
  configSnapshot: text('config_snapshot').notNull(),
  dataJson: text('data_json').notNull(),
  createdAt: integer('created_at').notNull(),
  subcategory: text('subcategory'),
  engineVersion: text('engine_version').notNull().default('legacy'),
  expiresAt: integer('expires_at').notNull().default(0),
});

// ─── 索引 ─────────────────────────────────────────────────────────────

export const configHistoryIdx = index('idx_cfg_hist_strategy').on(configHistory.strategy);
export const diagnosticStrategyIdx = index('idx_diag_strategy').on(diagnosticResults.strategy);
export const diagnosticCreatedIdx = index('idx_diag_created').on(diagnosticResults.createdAt);
