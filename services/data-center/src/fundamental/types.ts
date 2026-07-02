/** 报告期类型 */
export enum ReportType {
  Q1 = 'q1',
  Q2 = 'q2',
  Q3 = 'q3',
  Annual = 'annual',
}

/** 利润表 */
export interface IncomeStatement {
  /** 营业收入 */
  revenue: number;
  /** 营业成本 */
  costOfRevenue: number;
  /** 营业利润 */
  operatingIncome: number;
  /** 利润总额 */
  totalRevenue: number;
  /** 净利润 */
  netIncome: number;
}

/** 资产负债表 */
export interface BalanceSheet {
  /** 总资产 */
  totalAssets: number;
  /** 总负债 */
  totalLiabilities: number;
  /** 所有者权益 */
  totalEquity: number;
  /** 流动资产 */
  currentAssets: number;
  /** 流动负债 */
  currentLiabilities: number;
}

/** 现金流量表 */
export interface CashFlowStatement {
  /** 经营活动现金流 */
  operatingCashFlow: number;
  /** 投资活动现金流 */
  investingCashFlow: number;
  /** 筹资活动现金流 */
  financingCashFlow: number;
  /** 自由现金流 */
  freeCashFlow: number;
}

/** 财务报告（三表合一，默认 PIT 过滤：announceDate <= asOfDate） */
export interface FinancialReport {
  symbol: string;
  /** 报告期（毫秒时间戳） */
  reportDate: number;
  /** 公告日（毫秒时间戳，PIT 过滤依据） */
  announceDate: number;
  /** 报告期类型 */
  reportType: ReportType;
  /** 利润表 */
  income: IncomeStatement;
  /** 资产负债表 */
  balanceSheet: BalanceSheet;
  /** 现金流量表 */
  cashFlow: CashFlowStatement;
}

/** 预计算财务比率 */
export interface FinancialRatio {
  symbol: string;
  /** 快照日期（毫秒时间戳，PIT：基于 announceDate） */
  asOfDate: number;
  /** 净资产收益率 */
  roe: number;
  /** 总资产收益率 */
  roa: number;
  /** 每股收益 */
  eps: number;
  /** 市盈率 */
  pe: number;
  /** 市净率 */
  pb: number;
  /** 市销率 */
  ps: number;
  /** 资产负债率 */
  debtToEquity: number;
  /** 流动比率 */
  currentRatio: number;
  /** 毛利率 */
  grossMargin: number;
  /** 净利率 */
  netMargin: number;
}

/** 每日估值快照 */
export interface ValuationPoint {
  symbol: string;
  /** 日期（毫秒时间戳） */
  timestamp: number;
  /** 总市值（元） */
  marketCap?: number;
  /** 滚动市盈率 */
  peTTM?: number;
  /** 市净率 */
  pb?: number;
  /** 滚动市销率 */
  psTTM?: number;
  /** 股息率 */
  dividendYield?: number;
  /** 换手率（%） */
  turnoverRate?: number;
  /** 流通股本（股） */
  floatShares?: number;
}

/** 基本面查询参数 */
export interface FundamentalQuery {
  symbol: string;
  start?: number;
  end?: number;
}

/** 股东人数 */
export interface ShareholderMetrics {
  symbol: string;
  /** 公告日期（毫秒时间戳，PIT 过滤依据） */
  announceDate: number;
  /** 截止日期（毫秒时间戳） */
  endDate: number;
  /** 股东总人数 */
  totalHolders: number;
  /** 户均持股数 */
  avgHoldingShares: number;
  /** 户均持股市值 */
  avgHoldingAmount: number;
  /** 较上期变化率（%，正数=增加） */
  changeRatio?: number;
}

/** 基本面数据 Provider 接口（所有查询默认 PIT 过滤：announceDate <= asOfDate） */
export interface FundamentalDataProvider {
  /** 获取财务报告。asOfDate 为 PIT 截止日，仅返回 announceDate <= asOfDate 的记录 */
  getFinancialReports(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<FinancialReport[]>;
  /** 获取财务比率快照（PIT） */
  getFinancialRatios(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<FinancialRatio[]>;
  /** 获取估值序列（PIT） */
  getValuationSeries(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<ValuationPoint[]>;
  /** 获取最新财报（PIT） */
  getLatestReport(symbol: string): Promise<FinancialReport | undefined>;
  /** 获取股东人数序列（PIT） */
  getShareholderMetrics(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<ShareholderMetrics[]>;
}
