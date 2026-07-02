/**
 * 资讯事件 Provider 实现
 */
import type { EventDataProvider } from '../event/types.js';
import type {
  AnnouncementEvent,
  NewsArticle,
  SentimentPoint,
  MacroIndicatorDef,
  MacroPoint,
} from '../event/types.js';
import type {
  AnnouncementEventRepository,
  NewsRepository,
  SentimentRepository,
  MacroIndicatorRepository,
} from '../repository/types.js';

export class EventDataProviderImpl implements EventDataProvider {
  constructor(
    private announcementRepo: AnnouncementEventRepository,
    private newsRepo: NewsRepository,
    private sentimentRepo: SentimentRepository,
    private macroRepo: MacroIndicatorRepository
  ) {}

  async getAnnouncementEvents(
    symbol: string,
    start?: number,
    end?: number
  ): Promise<AnnouncementEvent[]> {
    return this.announcementRepo.query(symbol, start, end);
  }

  async getNewsArticles(
    symbols: string[],
    start?: number,
    end?: number,
    limit?: number
  ): Promise<NewsArticle[]> {
    return this.newsRepo.query(symbols, start, end, limit);
  }

  async getSentimentSeries(
    symbol: string,
    start?: number,
    end?: number
  ): Promise<SentimentPoint[]> {
    return this.sentimentRepo.query(symbol, start, end);
  }

  async getMacroIndicators(): Promise<MacroIndicatorDef[]> {
    return this.macroRepo.getDefinitions();
  }

  async getMacroIndicatorSeries(
    indicatorId: string,
    start?: number,
    end?: number
  ): Promise<MacroPoint[]> {
    return this.macroRepo.getPoints(indicatorId, start, end);
  }

  async hasAdverseEvents(symbol: string, asOfDate: number): Promise<boolean> {
    const events = await this.announcementRepo.query(symbol, undefined, asOfDate);
    return events.some((e) => e.impact === 'negative');
  }
}
