import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  TencentExtra,
} from './types.js';

/**
 * 腾讯财经适配器 — 通过 HTTP 拉取实时估值数据
 *
 * 腾讯财经 API 不封 IP，免费无 key。
 * 提供 PE(TTM)、PB、总市值、流通市值、换手率等估值数据。
 *
 * 字段索引（实测校准）：
 * - 39: PE(TTM)
 * - 44: 总市值(亿)
 * - 45: 流通市值(亿)
 * - 46: PB(市净率)
 * - 38: 换手率%
 */
export class TencentAdapter implements DataSourceAdapter {
  name = 'tencent';
  supportedDomains = ['fundamental'];
  supportedDataTypes = ['valuation'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const { symbol } = options;
    const extra = options.extra as TencentExtra | undefined;
    const timeout = extra?.timeout ?? 10_000;

    // 6位代码 → 市场前缀
    const prefix =
      symbol.startsWith('6') || symbol.startsWith('9')
        ? 'sh'
        : symbol.startsWith('8')
          ? 'bj'
          : 'sz';
    const code = symbol.replace(/^(sh|sz|SH|SZ|bj|BJ)/, '');

    const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });
      const buffer = await response.arrayBuffer();
      // GBK 解码
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);

      const records = this.parseResponse(text, symbol);
      for (const record of records) {
        yield record;
      }
    } catch (err) {
      console.error(`腾讯财经 ${symbol} 拉取失败:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseResponse(text: string, symbol: string): RawDataRecord[] {
    const records: RawDataRecord[] = [];

    for (const line of text.trim().split(';')) {
      if (!line.trim() || !line.includes('=') || !line.includes('"')) continue;

      const vals = line.split('"')[1]?.split('~');
      if (!vals || vals.length < 53) continue;

      const peTtm = parseFloat(vals[39]);
      const pb = parseFloat(vals[46]);
      const marketCap = parseFloat(vals[44]);
      const floatMarketCap = parseFloat(vals[45]);

      // 至少有一个有效估值数据才写入
      if (isNaN(peTtm) && isNaN(pb) && isNaN(marketCap)) continue;

      const now = Date.now();
      records.push({
        symbol,
        timestamp: now,
        pe: isNaN(peTtm) ? null : peTtm,
        peTtm: isNaN(peTtm) ? null : peTtm,
        pb: isNaN(pb) ? null : pb,
        ps: null,
        psTtm: null,
        marketCap: isNaN(marketCap) ? 0 : marketCap * 1e8, // 亿 → 元
        dividendYield: null,
        turnoverRate: parseFloat(vals[38]) || null,
        floatShares: isNaN(floatMarketCap) ? null : floatMarketCap * 1e8,
      });
    }

    return records;
  }
}
