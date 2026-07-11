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

/** 策略研究过程 */
export const researchSessions = sqliteTable('research_sessions', {
  id: text('id').primaryKey(),
  strategy: text('strategy').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull(),
  candidateJson: text('candidate_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  rawPath: text('raw_path'),
  rawPublishedAt: integer('raw_published_at'),
});

/** 策略研究事件；session_id 为空即待归类 */
export const researchEvents = sqliteTable('research_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  eventType: text('event_type').notNull(),
  dedupeKey: text('dedupe_key').notNull().unique(),
  payloadJson: text('payload_json').notNull(),
  occurredAt: integer('occurred_at').notNull(),
});

/** Worker 增量采集游标 */
export const researchCollectorStates = sqliteTable('research_collector_state', {
  source: text('source').primaryKey(),
  lastValue: text('last_value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ─── 索引 ─────────────────────────────────────────────────────────────

export const configHistoryIdx = index('idx_cfg_hist_strategy').on(configHistory.strategy);
export const diagnosticStrategyIdx = index('idx_diag_strategy').on(diagnosticResults.strategy);
export const diagnosticCreatedIdx = index('idx_diag_created').on(diagnosticResults.createdAt);
export const researchSessionStrategyIdx = index('idx_research_sessions_strategy').on(
  researchSessions.strategy
);
export const researchEventSessionIdx = index('idx_research_events_session').on(researchEvents.sessionId);
export const researchEventOccurredIdx = index('idx_research_events_occurred').on(researchEvents.occurredAt);
