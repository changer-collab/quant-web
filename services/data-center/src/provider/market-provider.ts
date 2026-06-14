/**
 * L1 行情 Provider 实现
 */
import type { MarketDataProvider } from '../market/types.js';
import type { TimeFrame } from '../base/types.js';
import type { ExtendedBar, ExtendedTick } from '../market/types.js';
import type { BarRepository, TickRepository, PageParams, PageResult } from '../repository/types.js';

export class MarketDataProviderImpl implements MarketDataProvider {
  constructor(
    private barRepo: BarRepository,
    private tickRepo: TickRepository,
  ) {}

  async *loadBars(symbol: string, timeframe: TimeFrame, start?: number, end?: number): AsyncIterable<ExtendedBar> {
    const CHUNK_SIZE = 1000;
    let afterTimestamp = start !== undefined ? start - 1 : undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.barRepo.queryPaged(symbol, timeframe, {
        limit: CHUNK_SIZE,
        afterTimestamp,
      });

      for (const bar of page.data) {
        if (end !== undefined && bar.timestamp > end) {
          hasMore = false;
          break;
        }
        yield bar;
      }

      hasMore = hasMore && page.hasMore;
      afterTimestamp = page.data.length > 0 ? page.data[page.data.length - 1].timestamp : undefined;
      if (page.data.length === 0) hasMore = false;
    }
  }

  async *loadTicks(symbol: string, start?: number, end?: number): AsyncIterable<ExtendedTick> {
    const ticks = await this.tickRepo.query(symbol, start, end);
    for (const tick of ticks) yield tick;
  }

  async getLatestBar(symbol: string, timeframe: TimeFrame) {
    return this.barRepo.getLatest(symbol, timeframe);
  }

  async getAvailableSymbols(timeframe?: TimeFrame) {
    return this.barRepo.getAvailableSymbols(timeframe);
  }

  async getBarsPaged(symbol: string, timeframe: TimeFrame, params?: PageParams): Promise<PageResult<ExtendedBar>> {
    return this.barRepo.queryPaged(symbol, timeframe, params);
  }
}
