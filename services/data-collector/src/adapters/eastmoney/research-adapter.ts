/**
 * 研报适配器 — 东财 reportapi
 *
 * 数据类型：research_report
 * 存储到：external_records 表
 */
import { EastMoneyBaseAdapter } from './base-adapter.js';
import type { AdapterFetchOptions } from '../types.js';

export class ResearchReportAdapter extends EastMoneyBaseAdapter {
  name = 'eastmoney_research';
  supportedDomains = ['event'];
  supportedDataTypes = ['research_report'];
  protected dataType = 'research_report';
  protected apiUrl = 'https://reportapi.eastmoney.com/report/list';

  protected buildParams(symbol: string, _options: AdapterFetchOptions): Record<string, string | number> {
    return {
      industryCode: '*',
      pageSize: 200,
      industry: '*',
      rating: '*',
      ratingChange: '*',
      beginTime: '',
      endTime: '',
      pageNo: 1,
      fields: '',
      qType: 0,
      orgCode: '',
      code: symbol.replace(/^(sh|sz|SH|SZ)/, ''),
    };
  }

  protected parseItem(item: Record<string, unknown>, _symbol: string) {
    const publishDate = String(item.publishDate ?? item['publishDate'] ?? '');
    const dateStr = publishDate.slice(0, 10).replace(/-/g, '');
    const ts = dateStr.length === 8
      ? Date.UTC(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)))
      : Date.now();
    return {
      payload: {
        symbol: item.code,
        name: item.stockName,
        title: item.title,
        publishDate: dateStr,
        orgName: item.orgName,
        orgSName: item.orgSName,
        researcher: item.researcher,
        rating: item.emRatingName,
        ratingChange: item.ratingChangeName,
        predictThisYearEps: Number(item.predictThisYearEps ?? 0),
        predictThisYearPe: Number(item.predictThisYearPe ?? 0),
      },
      timestamp: ts,
      recordSymbol: String(item.code ?? 'UNKNOWN'),
    };
  }
}
