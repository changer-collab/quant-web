/**
 * 限售解禁适配器 — 东财 datacenter-web API
 *
 * 数据类型：lockup
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class LockupAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_lockup';
  supportedDomains = ['event'];
  supportedDataTypes = ['lockup'];
  protected dataType = 'lockup';
  protected apiUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

  protected buildParams(symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      reportName: 'RPT_SHARE_FLOATING_NPL',
      sortColumns: 'LISTING_DATE',
      sortTypes: '1',
      pageSize: 200,
      pageNumber: 1,
      filter: `(SECURITY_CODE="${symbol.replace(/^(sh|sz|SH|SZ)/, '')}")`,
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const listingDate = String(item.LISTING_DATE ?? '');
    const dateStr = listingDate.slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        symbol: item.SECURITY_CODE,
        name: item.SECURITY_NAME_ABBR,
        listingDate: dateStr,
        floatShares: Number(item.FLOATING_SHARSES ?? 0),
        floatRatio: Number(item.FLOATING_SHARSES_RATIO ?? 0),
        floatMarketValue: Number(item.FLOATING_MARKET_VALUE ?? 0),
      },
      timestamp: ts,
      recordSymbol: String(item.SECURITY_CODE ?? 'UNKNOWN'),
    };
  }
}
