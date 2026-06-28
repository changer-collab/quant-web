/**
 * 资讯事件 Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import {
  announcementEvents,
  newsArticles,
  sentimentPoints,
  macroIndicatorDefs,
  macroPoints,
} from '../schema.js';
import type {
  AnnouncementEventRepository,
  NewsRepository,
  SentimentRepository,
  MacroIndicatorRepository,
} from '../../repository/types.js';
import type {
  AnnouncementEvent,
  NewsArticle,
  SentimentPoint,
  MacroIndicatorDef,
  MacroPoint,
} from '../../event/types.js';
import { AnnouncementEventType, EventImpact, MacroFrequency } from '../../event/types.js';
import { WriteError, QueryError } from '../../errors.js';

// ─── 公告事件 ───────────────────────────────────────────

export class SqliteAnnouncementEventRepository implements AnnouncementEventRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: AnnouncementEvent[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const e of input) {
          const row = {
            id: e.id, symbol: e.symbol, eventTime: e.eventTime,
            eventType: e.eventType, title: e.title,
            description: e.description ?? null, impact: e.impact,
          };
          tx.insert(announcementEvents)
            .values(row)
            .onConflictDoUpdate({ target: announcementEvents.id, set: row })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存公告事件失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<AnnouncementEvent[]> {
    try {
      const conditions = [eq(announcementEvents.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(announcementEvents.eventTime, start));
      if (end !== undefined) conditions.push(lte(announcementEvents.eventTime, end));
      const rows = await this.db.select().from(announcementEvents)
        .where(and(...conditions))
        .orderBy(announcementEvents.eventTime);
      return rows.map((r) => ({
        id: r.id, symbol: r.symbol, eventTime: r.eventTime,
        eventType: r.eventType as AnnouncementEventType, title: r.title,
        ...(r.description != null && { description: r.description }),
        impact: r.impact as EventImpact,
      }));
    } catch (err) {
      throw new QueryError(`查询公告事件失败: ${symbol}`, err);
    }
  }
}

// ─── 新闻 ───────────────────────────────────────────────

export class SqliteNewsRepository implements NewsRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: NewsArticle[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const a of input) {
          const row = {
            id: a.id, publishTime: a.publishTime, title: a.title, source: a.source,
            symbols: JSON.stringify(a.symbols),
            sentimentScore: a.sentimentScore ?? null,
            tags: JSON.stringify(a.tags),
          };
          tx.insert(newsArticles)
            .values(row)
            .onConflictDoUpdate({ target: newsArticles.id, set: row })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存新闻失败: ${input[0]?.id}`, err);
    }
  }

  async query(symbols: string[], start?: number, end?: number, limit?: number): Promise<NewsArticle[]> {
    try {
      const conditions = [];
      if (start !== undefined) conditions.push(gte(newsArticles.publishTime, start));
      if (end !== undefined) conditions.push(lte(newsArticles.publishTime, end));

      if (symbols.length > 0) {
        const symbolConditions = symbols.map((s) => sql`${newsArticles.symbols} LIKE ${'%"' + s + '"%'}`);
        conditions.push(sql`(${symbolConditions.map((c) => c.getSQL()).join(' OR ')})`);
      }

      const rows = await this.db.select().from(newsArticles)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(newsArticles.publishTime))
        .limit(limit ?? 1000);

      return rows.map((r) => ({
        id: r.id, publishTime: r.publishTime, title: r.title, source: r.source,
        symbols: JSON.parse(r.symbols),
        ...(r.sentimentScore != null && { sentimentScore: r.sentimentScore }),
        tags: JSON.parse(r.tags),
      }));
    } catch (err) {
      throw new QueryError('查询新闻失败', err);
    }
  }
}

// ─── 情绪指标 ───────────────────────────────────────────

export class SqliteSentimentRepository implements SentimentRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: SentimentPoint[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const p of input) {
          const row = { symbol: p.symbol, timestamp: p.timestamp, score: p.score, sampleSize: p.sampleSize };
          tx.insert(sentimentPoints)
            .values(row)
            .onConflictDoUpdate({
              target: [sentimentPoints.symbol, sentimentPoints.timestamp],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存情绪指标失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<SentimentPoint[]> {
    try {
      const conditions = [eq(sentimentPoints.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(sentimentPoints.timestamp, start));
      if (end !== undefined) conditions.push(lte(sentimentPoints.timestamp, end));
      const rows = await this.db.select().from(sentimentPoints)
        .where(and(...conditions))
        .orderBy(sentimentPoints.timestamp);
      return rows.map((r) => ({
        symbol: r.symbol, timestamp: r.timestamp, score: r.score, sampleSize: r.sampleSize,
      }));
    } catch (err) {
      throw new QueryError(`查询情绪指标失败: ${symbol}`, err);
    }
  }
}

// ─── 宏观指标 ───────────────────────────────────────────

export class SqliteMacroIndicatorRepository implements MacroIndicatorRepository {
  constructor(private db: DrizzleDb) {}

  async saveDefinitions(defs: MacroIndicatorDef[]): Promise<void> {
    if (defs.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const d of defs) {
          const row = { id: d.id, name: d.name, unit: d.unit, frequency: d.frequency, source: d.source };
          tx.insert(macroIndicatorDefs)
            .values(row)
            .onConflictDoUpdate({ target: macroIndicatorDefs.id, set: row })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存宏观指标定义失败: ${defs[0]?.id}`, err);
    }
  }

  async getDefinitions(): Promise<MacroIndicatorDef[]> {
    try {
      const rows = await this.db.select().from(macroIndicatorDefs);
      return rows.map((r) => ({
        id: r.id, name: r.name, unit: r.unit,
        frequency: r.frequency as MacroFrequency, source: r.source,
      }));
    } catch (err) {
      throw new QueryError('查询宏观指标定义失败', err);
    }
  }

  async savePoints(points: MacroPoint[]): Promise<void> {
    if (points.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const p of points) {
          const row = { indicatorId: p.indicatorId, timestamp: p.timestamp, value: p.value };
          tx.insert(macroPoints)
            .values(row)
            .onConflictDoUpdate({
              target: [macroPoints.indicatorId, macroPoints.timestamp],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存宏观数据失败: ${points[0]?.indicatorId}`, err);
    }
  }

  async getPoints(indicatorId: string, start?: number, end?: number): Promise<MacroPoint[]> {
    try {
      const conditions = [eq(macroPoints.indicatorId, indicatorId)];
      if (start !== undefined) conditions.push(gte(macroPoints.timestamp, start));
      if (end !== undefined) conditions.push(lte(macroPoints.timestamp, end));
      const rows = await this.db.select().from(macroPoints)
        .where(and(...conditions))
        .orderBy(macroPoints.timestamp);
      return rows.map((r) => ({
        indicatorId: r.indicatorId, timestamp: r.timestamp, value: r.value,
      }));
    } catch (err) {
      throw new QueryError(`查询宏观数据失败: ${indicatorId}`, err);
    }
  }
}
