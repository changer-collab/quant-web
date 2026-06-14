/**
 * 参考数据 Provider 实现
 */
import type { ReferenceDataProvider } from '../reference/types.js';
import type {
  InstrumentRepository,
  CalendarRepository,
  IndexCompositionRepository,
  AdjustmentFactorRepository,
} from '../repository/types.js';

export class ReferenceDataProviderImpl implements ReferenceDataProvider {
  constructor(
    private instrumentRepo: InstrumentRepository,
    private calendarRepo: CalendarRepository,
    private indexCompRepo: IndexCompositionRepository,
    private adjFactorRepo: AdjustmentFactorRepository,
  ) {}

  async getTradingCalendar(exchange: string, year: number) {
    const cal = await this.calendarRepo.get(exchange, year);
    if (!cal) throw new Error(`交易日历不存在: ${exchange}/${year}`);
    return cal;
  }

  async getInstruments(query?: Parameters<InstrumentRepository['query']>[0]) {
    return this.instrumentRepo.query(query);
  }

  async getIndexComposition(indexSymbol: string, asOfDate: number) {
    const comp = await this.indexCompRepo.get(indexSymbol, asOfDate);
    if (!comp) throw new Error(`指数成分不存在: ${indexSymbol}/${asOfDate}`);
    return comp;
  }

  async getAdjustmentFactors(symbol: string, start?: number, end?: number) {
    return this.adjFactorRepo.query(symbol, start, end);
  }

  async isTradingDay(exchange: string, date: number): Promise<boolean> {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const cal = await this.calendarRepo.get(exchange, year);
    if (!cal) return false;
    return cal.tradingDays.includes(date);
  }

  async getPreviousTradingDay(exchange: string, date: number): Promise<number> {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    // 先查当年，不够再查上一年
    for (let y = year; y >= year - 1; y--) {
      const cal = await this.calendarRepo.get(exchange, y);
      if (!cal) continue;
      const before = cal.tradingDays.filter((t) => t < date);
      if (before.length > 0) return before[before.length - 1];
    }
    throw new Error(`找不到 ${exchange} 在 ${date} 之前的交易日`);
  }
}
