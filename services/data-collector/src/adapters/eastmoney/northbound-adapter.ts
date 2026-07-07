/**
 * 北向资金适配器 — 东财 push2his API
 *
 * 数据类型：northbound_flow
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class NorthboundFlowAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_northbound';
  supportedDomains = ['event'];
  supportedDataTypes = ['northbound_flow'];
  protected dataType = 'northbound_flow';
  protected apiUrl = 'https://push2his.eastmoney.com/api/qt/kamt.kline/get';

  protected buildParams(_symbol: string, options: AdapterFetchOptions): Record<string, string | number> {
    const startDate = options.start ? new Date(options.start).toISOString().slice(0, 10).replace(/-/g, '') : '20200101';
    const endDate = options.end ? new Date(options.end).toISOString().slice(0, 10).replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return {
      fields1: 'f1,f2,f3,f4',
      fields2: 'f51,f52,f53,f54,f55,f56',
      klt: 101,
      lmt: 200,
      sdate: startDate,
      edate: endDate,
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    // 北向资金返回的是数组 [date, hkToSh, shBuy, shSell, hkToSz, szBuy, szSell]
    // data 字段是字符串数组，需要解析
    const line = Array.isArray(item) ? item : [item];
    const dateStr = String(line[0] ?? '').slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        date: dateStr,
        hkToSh: Number(line[1] ?? 0),
        hkToSz: Number(line[4] ?? 0),
        totalInflow: Number(line[1] ?? 0) + Number(line[4] ?? 0),
      },
      timestamp: ts,
      recordSymbol: 'NORTHBOUND',
    };
  }
}
