/**
 * 大宗交易适配器 — 东财 datacenter-web API
 *
 * 数据类型：block_trade
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class BlockTradeAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_block_trade';
  supportedDomains = ['event'];
  supportedDataTypes = ['block_trade'];
  protected dataType = 'block_trade';
  protected apiUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

  protected buildParams(symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      reportName: 'RPT_BLOCKTRADE_DETAIL',
      sortColumns: 'TRADE_DATE',
      sortTypes: '-1',
      pageSize: 200,
      pageNumber: 1,
      filter: `(SECURITY_CODE="${symbol.replace(/^(sh|sz|SH|SZ)/, '')}")`,
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
        symbol: item.SECURITY_CODE,
        name: item.SECURITY_NAME_ABBR,
        tradeDate: dateStr,
        price: Number(item.PRICE ?? 0),
        volume: Number(item.VOLUME ?? 0),
        amount: Number(item.DEAL_AMT ?? 0),
        buyer: item.BUYER_NAME,
        seller: item.SELLER_NAME,
      },
      timestamp: ts,
      recordSymbol: String(item.SECURITY_CODE ?? 'UNKNOWN'),
    };
  }
}
