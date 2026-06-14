/**
 * 基本面 Provider 实现
 */
import type { FundamentalDataProvider } from '../fundamental/types.js';
import type { FinancialReport, FinancialRatio, ValuationPoint, ShareholderMetrics } from '../fundamental/types.js';
import type {
  FinancialReportRepository,
  FinancialRatioRepository,
  ValuationRepository,
  ShareholderMetricsRepository,
} from '../repository/types.js';

export class FundamentalDataProviderImpl implements FundamentalDataProvider {
  constructor(
    private reportRepo: FinancialReportRepository,
    private ratioRepo: FinancialRatioRepository,
    private valuationRepo: ValuationRepository,
    private shareholderRepo: ShareholderMetricsRepository,
  ) {}

  async getFinancialReports(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<FinancialReport[]> {
    return this.reportRepo.query(symbol, start, end, asOfDate);
  }

  async getFinancialRatios(symbol: string, asOfDate: number): Promise<FinancialRatio[]> {
    return this.ratioRepo.query(symbol, asOfDate);
  }

  async getValuationSeries(symbol: string, start?: number, end?: number): Promise<ValuationPoint[]> {
    return this.valuationRepo.query(symbol, start, end);
  }

  async getLatestReport(symbol: string): Promise<FinancialReport | undefined> {
    return this.reportRepo.getLatest(symbol);
  }

  async getShareholderMetrics(symbol: string, start?: number, end?: number): Promise<ShareholderMetrics[]> {
    return this.shareholderRepo.query(symbol, start, end);
  }
}
