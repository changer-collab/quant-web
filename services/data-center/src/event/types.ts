/** 公告事件类型 */
export enum AnnouncementEventType {
  ST = 'st',
  Suspended = 'suspended',
  Dividend = 'dividend',
  Restructure = 'restructure',
  IPO = 'ipo',
  Delist = 'delist',
  RightsIssue = 'rightsIssue',
}

/** 事件影响方向 */
export enum EventImpact {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
  Unknown = 'unknown',
}

/** 宏观指标频率 */
export enum MacroFrequency {
  Daily = 'daily',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
}

/** 公告事件 */
export interface AnnouncementEvent {
  id: string;
  symbol: string;
  /** 事件时间（毫秒时间戳，北京时间） */
  eventTime: number;
  eventType: AnnouncementEventType;
  title: string;
  description?: string;
  impact: EventImpact;
}

/** 新闻 */
export interface NewsArticle {
  id: string;
  /** 发布时间（毫秒时间戳，北京时间） */
  publishTime: number;
  title: string;
  source: string;
  /** 关联标的 */
  symbols: string[];
  /** 情绪分数（-1 到 1） */
  sentimentScore?: number;
  tags: string[];
}

/** 情绪指标（可直接用于因子） */
export interface SentimentPoint {
  symbol: string;
  /** 时间（毫秒时间戳，北京时间） */
  timestamp: number;
  /** 情绪分数（-1 到 1） */
  score: number;
  /** 样本量 */
  sampleSize: number;
}

/** 宏观指标定义 */
export interface MacroIndicatorDef {
  id: string;
  name: string;
  unit: string;
  frequency: MacroFrequency;
  source: string;
}

/** 宏观数据点 */
export interface MacroPoint {
  indicatorId: string;
  /** 时间（毫秒时间戳，北京时间） */
  timestamp: number;
  value: number;
}

/** 资讯事件 Provider 接口 */
export interface EventDataProvider {
  /** 获取公告事件（PIT：按 eventTime 过滤） */
  getAnnouncementEvents(symbol: string, start?: number, end?: number): Promise<AnnouncementEvent[]>;
  /** 获取新闻 */
  getNewsArticles(symbols: string[], start?: number, end?: number, limit?: number): Promise<NewsArticle[]>;
  /** 获取情绪序列 */
  getSentimentSeries(symbol: string, start?: number, end?: number): Promise<SentimentPoint[]>;
  /** 获取宏观指标列表 */
  getMacroIndicators(): Promise<MacroIndicatorDef[]>;
  /** 获取宏观数据序列 */
  getMacroIndicatorSeries(indicatorId: string, start?: number, end?: number): Promise<MacroPoint[]>;
  /** 是否有负面事件 */
  hasAdverseEvents(symbol: string, asOfDate: number): Promise<boolean>;
}
