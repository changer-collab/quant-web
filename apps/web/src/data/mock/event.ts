// apps/web/src/data/mock/event.ts
import { AnnouncementEventType, EventImpact, MacroFrequency } from '../types.js';

/** Mock 公告事件 */
export const MOCK_ANNOUNCEMENT_EVENTS = [
  {
    id: 'ann-001',
    symbol: '600519.SH',
    eventTime: Date.UTC(2025, 2, 15),
    eventType: AnnouncementEventType.Dividend,
    title: '2024年度利润分配方案',
    description: '拟每10股派发现金红利259.11元（含税）',
    impact: EventImpact.Positive,
  },
  {
    id: 'ann-002',
    symbol: '300750.SZ',
    eventTime: Date.UTC(2025, 3, 10),
    eventType: AnnouncementEventType.Dividend,
    title: '2024年度利润分配方案',
    description: '拟每10股派发现金红利20.1元（含税）',
    impact: EventImpact.Positive,
  },
  {
    id: 'ann-003',
    symbol: '000858.SZ',
    eventTime: Date.UTC(2025, 0, 28),
    eventType: AnnouncementEventType.Dividend,
    title: '2023年度分红实施公告',
    description: '每10股派发现金红利46.7元（含税）',
    impact: EventImpact.Positive,
  },
];

/** Mock 新闻 */
export const MOCK_NEWS_ARTICLES = [
  {
    id: 'news-001',
    publishTime: Date.UTC(2025, 5, 13),
    title: '贵州茅台2025年一季度营收同比增长15%',
    source: '证券时报',
    symbols: ['600519.SH'],
    sentimentScore: 0.65,
    tags: ['业绩', '白酒', '消费'],
  },
  {
    id: 'news-002',
    publishTime: Date.UTC(2025, 5, 12),
    title: '宁德时代发布新一代钠离子电池',
    source: '上海证券报',
    symbols: ['300750.SZ'],
    sentimentScore: 0.72,
    tags: ['新能源', '电池', '技术突破'],
  },
  {
    id: 'news-003',
    publishTime: Date.UTC(2025, 5, 11),
    title: '五粮液启动百亿回购计划',
    source: '中国证券报',
    symbols: ['000858.SZ'],
    sentimentScore: 0.58,
    tags: ['回购', '白酒', '消费'],
  },
  {
    id: 'news-004',
    publishTime: Date.UTC(2025, 5, 10),
    title: 'A股市场成交额突破万亿，科技股领涨',
    source: '财联社',
    symbols: ['002415.SZ', '300750.SZ'],
    sentimentScore: 0.45,
    tags: ['市场', '科技', '成交量'],
  },
];

/** Mock 情绪序列 */
export const MOCK_SENTIMENT_SERIES = [
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 5, 9), score: 0.45, sampleSize: 120 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 5, 10), score: 0.52, sampleSize: 135 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 5, 11), score: 0.48, sampleSize: 110 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 5, 12), score: 0.61, sampleSize: 145 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 5, 13), score: 0.65, sampleSize: 130 },
];

/** Mock 宏观指标定义 */
export const MOCK_MACRO_INDICATORS = [
  {
    id: 'cpi',
    name: '居民消费价格指数(CPI)',
    unit: '%',
    frequency: MacroFrequency.Monthly,
    source: '国家统计局',
  },
  {
    id: 'pmi',
    name: '制造业采购经理指数(PMI)',
    unit: '',
    frequency: MacroFrequency.Monthly,
    source: '国家统计局',
  },
  {
    id: 'm2',
    name: '广义货币供应量(M2)',
    unit: '万亿元',
    frequency: MacroFrequency.Monthly,
    source: '中国人民银行',
  },
  {
    id: 'gdp',
    name: '国内生产总值(GDP)',
    unit: '万亿元',
    frequency: MacroFrequency.Quarterly,
    source: '国家统计局',
  },
];

/** Mock 宏观数据点 */
export const MOCK_MACRO_POINTS = [
  { indicatorId: 'cpi', timestamp: Date.UTC(2025, 0, 31), value: 0.5 },
  { indicatorId: 'cpi', timestamp: Date.UTC(2025, 1, 28), value: -0.7 },
  { indicatorId: 'cpi', timestamp: Date.UTC(2025, 2, 31), value: 0.1 },
  { indicatorId: 'cpi', timestamp: Date.UTC(2025, 3, 30), value: 0.3 },
  { indicatorId: 'cpi', timestamp: Date.UTC(2025, 4, 31), value: 0.2 },
  { indicatorId: 'pmi', timestamp: Date.UTC(2025, 0, 31), value: 50.1 },
  { indicatorId: 'pmi', timestamp: Date.UTC(2025, 1, 28), value: 50.2 },
  { indicatorId: 'pmi', timestamp: Date.UTC(2025, 2, 31), value: 50.5 },
  { indicatorId: 'pmi', timestamp: Date.UTC(2025, 3, 30), value: 50.4 },
  { indicatorId: 'pmi', timestamp: Date.UTC(2025, 4, 31), value: 50.3 },
];
