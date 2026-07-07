/**
 * 热门股适配器 — 东财 push2 API
 *
 * 数据类型：hot_stocks
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class HotStocksAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_hot_stocks';
  supportedDomains = ['event'];
  supportedDataTypes = ['hot_stocks'];
  protected dataType = 'hot_stocks';
  protected apiUrl = 'https://push2.eastmoney.com/api/qt/clist/get';

  protected buildParams(_symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      fid: 'f3',
      po: 1,
      pz: 50,
      pn: 1,
      np: 1,
      fltt: 2,
      invt: 2,
      fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048',
      fields: 'f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f14,f15,f16,f17,f18',
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const ts = Date.now();
    return {
      payload: {
        symbol: item.f12,
        name: item.f14,
        price: Number(item.f2 ?? 0),
        changeRate: Number(item.f3 ?? 0),
        changeAmount: Number(item.f4 ?? 0),
        volume: Number(item.f5 ?? 0),
        turnover: Number(item.f6 ?? 0),
        amplitude: Number(item.f7 ?? 0),
        turnoverRate: Number(item.f8 ?? 0),
        pe: Number(item.f9 ?? 0),
      },
      timestamp: ts,
      recordSymbol: String(item.f12 ?? 'UNKNOWN'),
    };
  }
}
