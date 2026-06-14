/**
 * 数据导出实现 — JSON / CSV 格式
 */
import type { DataExporter, ExportFormat, ReferenceQuery } from '../repository/types.js';
import type { TimeFrame } from '../base/types.js';
import type { BarRepository, InstrumentRepository } from '../repository/types.js';

export class DataExporterImpl implements DataExporter {
  constructor(
    private barRepo: BarRepository,
    private instrumentRepo: InstrumentRepository,
  ) {}

  async exportBars(symbol: string, timeframe: TimeFrame, start?: number, end?: number, format: ExportFormat = 'json'): Promise<string> {
    const bars = await this.barRepo.query(symbol, timeframe, start, end);
    if (format === 'csv') {
      const header = 'timestamp,open,high,low,close,volume,turnover';
      const rows = bars.map((b) => `${b.timestamp},${b.open},${b.high},${b.low},${b.close},${b.volume},${b.turnover}`);
      return [header, ...rows].join('\n');
    }
    return JSON.stringify(bars);
  }

  async exportInstruments(query?: ReferenceQuery, format: ExportFormat = 'json'): Promise<string> {
    const instruments = await this.instrumentRepo.query(query);
    if (format === 'csv') {
      const header = 'symbol,name,exchange,lotSize,priceTick,industry,sector,status';
      const rows = instruments.map((i) => `${i.symbol},${i.name},${i.exchange},${i.lotSize},${i.priceTick},${i.industry},${i.sector},${i.status}`);
      return [header, ...rows].join('\n');
    }
    return JSON.stringify(instruments);
  }
}
