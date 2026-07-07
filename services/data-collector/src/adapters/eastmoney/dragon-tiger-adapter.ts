/**
 * 龙虎榜适配器 — 东财 datacenter-web API
 *
 * 数据类型：dragon_tiger
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class DragonTigerAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_dragon_tiger';
  supportedDomains = ['event'];
  supportedDataTypes = ['dragon_tiger'];
  protected dataType = 'dragon_tiger';
  protected apiUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

  protected buildParams(_symbol: string, options: AdapterFetchOptions): Record<string, string | number> {
    const startDate = options.start ? new Date(options.start).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const endDate = options.end ? new Date(options.end).toISOString().slice(0, 10).replace(/-/g, '') : '';
    return {
      reportName: 'RPT_DAILYBILLBOARD_DETAILS',
      sortColumns: 'TRADE_DATE',
      sortTypes: '-1',
      pageSize: 200,
      pageNumber: 1,
      ...(startDate && { filter: `(TRADE_DATE>='${startDate}')(TRADE_DATE<='${endDate}')` }),
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const tradeDate = String(item.TRADE_DATE ?? item['TRADE_DATE'] ?? '');
    // 解析日期：可能是 '2024-01-15T00:00:00' 格式
    const dateStr = tradeDate.slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        symbol: item.SECURITY_CODE ?? item['SECURITY_CODE'],
        name: item.SECURITY_NAME_ABBR ?? item['SECURITY_NAME_ABBR'],
        tradeDate: dateStr,
        close: Number(item.CLOSE_PRICE ?? 0),
        changeRate: Number(item.CHANGE_RATE ?? 0),
        turnoverRate: Number(item.TURNOVERRATE ?? 0),
        netBuy: Number(item.NET_AMOUNT ?? 0),
        buySeats: Number(item.BUY ?? 0),
        sellSeats: Number(item.SELL ?? 0),
        reason: item.EXPLAIN ?? '',
      },
      timestamp: ts,
      recordSymbol: String(item.SECURITY_CODE ?? 'UNKNOWN'),
    };
  }
}
