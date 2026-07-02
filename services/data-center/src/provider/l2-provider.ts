/**
 * L2 行情 Provider 实现
 */
import type { Level2DataProvider } from '../l2/types.js';
import type { Level2Snapshot, TradeRecord, OrderRecord } from '../l2/types.js';
import type {
  Level2SnapshotRepository,
  TradeRecordRepository,
  OrderRecordRepository,
} from '../repository/types.js';

export class Level2DataProviderImpl implements Level2DataProvider {
  constructor(
    private snapshotRepo: Level2SnapshotRepository,
    private tradeRepo: TradeRecordRepository,
    private orderRepo: OrderRecordRepository
  ) {}

  async *loadSnapshots(
    symbol: string,
    start?: number,
    end?: number
  ): AsyncIterable<Level2Snapshot> {
    const CHUNK_SIZE = 500;
    let afterTimestamp = start !== undefined ? start - 1 : undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.snapshotRepo.queryPaged(symbol, {
        limit: CHUNK_SIZE,
        afterTimestamp,
      });
      for (const s of page.data) {
        if (end !== undefined && s.timestamp > end) {
          hasMore = false;
          break;
        }
        yield s;
      }
      hasMore = hasMore && page.hasMore;
      afterTimestamp = page.data.length > 0 ? page.data[page.data.length - 1].timestamp : undefined;
      if (page.data.length === 0) hasMore = false;
    }
  }

  async *loadTradeRecords(
    symbol: string,
    start?: number,
    end?: number
  ): AsyncIterable<TradeRecord> {
    const CHUNK_SIZE = 1000;
    let afterTimestamp = start !== undefined ? start - 1 : undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.tradeRepo.queryPaged(symbol, { limit: CHUNK_SIZE, afterTimestamp });
      for (const r of page.data) {
        if (end !== undefined && r.timestamp > end) {
          hasMore = false;
          break;
        }
        yield r;
      }
      hasMore = hasMore && page.hasMore;
      afterTimestamp = page.data.length > 0 ? page.data[page.data.length - 1].timestamp : undefined;
      if (page.data.length === 0) hasMore = false;
    }
  }

  async *loadOrderRecords(
    symbol: string,
    start?: number,
    end?: number
  ): AsyncIterable<OrderRecord> {
    const CHUNK_SIZE = 1000;
    let afterTimestamp = start !== undefined ? start - 1 : undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await this.orderRepo.queryPaged(symbol, { limit: CHUNK_SIZE, afterTimestamp });
      for (const r of page.data) {
        if (end !== undefined && r.timestamp > end) {
          hasMore = false;
          break;
        }
        yield r;
      }
      hasMore = hasMore && page.hasMore;
      afterTimestamp = page.data.length > 0 ? page.data[page.data.length - 1].timestamp : undefined;
      if (page.data.length === 0) hasMore = false;
    }
  }

  async getLatestSnapshot(symbol: string): Promise<Level2Snapshot | undefined> {
    return this.snapshotRepo.getLatest(symbol);
  }
}
