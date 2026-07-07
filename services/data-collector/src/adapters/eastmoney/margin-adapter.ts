/**
 * 融资融券适配器 — 东财 datacenter-web API
 *
 * 数据类型：margin
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class MarginAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_margin';
  supportedDomains = ['fundamental'];
  supportedDataTypes = ['margin'];
  protected dataType = 'margin';
  protected apiUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

  protected buildParams(symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      reportName: 'RPTA_WEB_RZRQ_GGMX',
      sortColumns: 'TRADE_DATE',
      sortTypes: '-1',
      pageSize: 200,
      pageNumber: 1,
      filter: `(SCODE="${symbol.replace(/^(sh|sz|SH|SZ)/, '')}")`,
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const tradeDate = String(item.TRADE_DATE ?? '');
    const dateStr = tradeDate.slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        symbol: item.SCODE,
        name: item.SECNAME,
        tradeDate: dateStr,
        marginBuy: Number(item.RZYE ?? 0),
        marginRepay: Number(item.RQYE ?? 0),
        marginNetBuy: Number(item.RZRQYE ?? 0),
      },
      timestamp: ts,
      recordSymbol: String(item.SCODE ?? 'UNKNOWN'),
    };
  }
}
