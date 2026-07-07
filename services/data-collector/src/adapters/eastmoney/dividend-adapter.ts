/**
 * 分红送转适配器 — 东财 datacenter-web API
 *
 * 数据类型：dividend
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class DividendAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_dividend';
  supportedDomains = ['fundamental'];
  supportedDataTypes = ['dividend'];
  protected dataType = 'dividend';
  protected apiUrl = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

  protected buildParams(symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      reportName: 'RPT_SHAREBONUS_DET',
      sortColumns: 'REPORT_DATE',
      sortTypes: '-1',
      pageSize: 200,
      pageNumber: 1,
      filter: `(SECURITY_CODE="${symbol.replace(/^(sh|sz|SH|SZ)/, '')}")`,
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const reportDate = String(item.REPORT_DATE ?? '');
    const dateStr = reportDate.slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        symbol: item.SECURITY_CODE,
        name: item.SECURITY_NAME_ABBR,
        reportDate: dateStr,
        bonusRatio: Number(item.BONUS_RATIO_RMB ?? 0),
        capitalizationRatio: Number(item.INCREASING_RATIO ?? 0),
        dividendRatio: Number(item.ALLOTTING_RATIO ?? 0),
        exDate: String(item.EX_DIVIDEND_DATE ?? '').slice(0, 10).replace(/-/g, ''),
      },
      timestamp: ts,
      recordSymbol: String(item.SECURITY_CODE ?? 'UNKNOWN'),
    };
  }
}
