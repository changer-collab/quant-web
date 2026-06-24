// apps/web/src/data/mock/fundamental.ts
import { ReportType } from '../types.js';

/** Mock 财务报告 */
export const MOCK_FINANCIAL_REPORTS = [
  {
    symbol: '600519.SH',
    reportDate: Date.UTC(2024, 11, 31),
    announceDate: Date.UTC(2025, 2, 15),
    reportType: ReportType.Annual,
    income: {
      revenue: 174_100_000_000,
      costOfRevenue: 13_900_000_000,
      operatingIncome: 103_100_000_000,
      totalRevenue: 174_100_000_000,
      netIncome: 86_200_000_000,
    },
    balanceSheet: {
      totalAssets: 311_800_000_000,
      totalLiabilities: 56_300_000_000,
      totalEquity: 255_500_000_000,
      currentAssets: 213_000_000_000,
      currentLiabilities: 42_100_000_000,
    },
    cashFlow: {
      operatingCashFlow: 94_200_000_000,
      investingCashFlow: -3_200_000_000,
      financingCashFlow: -58_800_000_000,
      freeCashFlow: 91_000_000_000,
    },
  },
  {
    symbol: '300750.SZ',
    reportDate: Date.UTC(2024, 11, 31),
    announceDate: Date.UTC(2025, 3, 10),
    reportType: ReportType.Annual,
    income: {
      revenue: 400_900_000_000,
      costOfRevenue: 310_000_000_000,
      operatingIncome: 55_800_000_000,
      totalRevenue: 400_900_000_000,
      netIncome: 44_100_000_000,
    },
    balanceSheet: {
      totalAssets: 671_000_000_000,
      totalLiabilities: 463_000_000_000,
      totalEquity: 208_000_000_000,
      currentAssets: 355_000_000_000,
      currentLiabilities: 298_000_000_000,
    },
    cashFlow: {
      operatingCashFlow: 92_800_000_000,
      investingCashFlow: -58_000_000_000,
      financingCashFlow: -12_000_000_000,
      freeCashFlow: 34_800_000_000,
    },
  },
];

/** Mock 财务比率 */
export const MOCK_FINANCIAL_RATIOS = [
  {
    symbol: '600519.SH',
    asOfDate: Date.UTC(2025, 2, 15),
    roe: 0.338,
    roa: 0.277,
    eps: 68.64,
    pe: 26.2,
    pb: 8.9,
    ps: 13.0,
    debtToEquity: 0.22,
    currentRatio: 5.06,
    grossMargin: 0.92,
    netMargin: 0.495,
  },
  {
    symbol: '300750.SZ',
    asOfDate: Date.UTC(2025, 3, 10),
    roe: 0.212,
    roa: 0.066,
    eps: 10.02,
    pe: 18.5,
    pb: 3.9,
    ps: 2.0,
    debtToEquity: 2.22,
    currentRatio: 1.19,
    grossMargin: 0.227,
    netMargin: 0.110,
  },
];

/** Mock 估值序列 */
export const MOCK_VALUATION_SERIES = [
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 0, 31), marketCap: 2_250_000_000_000, peTTM: 26.1, pb: 8.8, psTTM: 12.9, dividendYield: 0.019 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 1, 28), marketCap: 2_280_000_000_000, peTTM: 26.4, pb: 8.9, psTTM: 13.1, dividendYield: 0.018 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 2, 31), marketCap: 2_260_000_000_000, peTTM: 26.2, pb: 8.9, psTTM: 13.0, dividendYield: 0.019 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 3, 30), marketCap: 2_300_000_000_000, peTTM: 26.6, pb: 9.0, psTTM: 13.2, dividendYield: 0.018 },
  { symbol: '600519.SH', timestamp: Date.UTC(2025, 4, 31), marketCap: 2_240_000_000_000, peTTM: 26.0, pb: 8.8, psTTM: 12.9, dividendYield: 0.019 },
];

/** Mock 股东人数 */
export const MOCK_SHAREHOLDER_METRICS = [
  { symbol: '600519.SH', announceDate: Date.UTC(2025, 2, 15), endDate: Date.UTC(2024, 11, 31), totalHolders: 120_500, avgHoldingShares: 1000, avgHoldingAmount: 1_800_000, changeRatio: -3.2 },
  { symbol: '600519.SH', announceDate: Date.UTC(2024, 8, 30), endDate: Date.UTC(2024, 5, 30), totalHolders: 124_500, avgHoldingShares: 970, avgHoldingAmount: 1_720_000, changeRatio: -2.1 },
];