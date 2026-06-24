import { apiGet, apiDelete } from './client';

/** API 返回的报告摘要（列表项） */
export interface ApiReportSummary {
  id: string;
  taskId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

/** API 返回的报告详情（含 reportData） */
export interface ApiReportDetail extends ApiReportSummary {
  reportData: Record<string, unknown>;
}

/** 获取报告列表 */
export function fetchReports(filter?: {
  strategy?: string;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}): Promise<ApiReportSummary[]> {
  const params = new URLSearchParams();
  if (filter?.strategy) params.set('strategy', filter.strategy);
  if (filter?.symbol) params.set('symbol', filter.symbol);
  if (filter?.startTime !== undefined) params.set('startTime', String(filter.startTime));
  if (filter?.endTime !== undefined) params.set('endTime', String(filter.endTime));
  if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter?.offset !== undefined) params.set('offset', String(filter.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<ApiReportSummary[]>(`/reports${query}`);
}

/** 获取报告详情 */
export function fetchReport(id: string): Promise<ApiReportDetail> {
  return apiGet<ApiReportDetail>(`/reports/${id}`);
}

/** 删除报告 */
export function deleteReport(id: string): Promise<void> {
  return apiDelete(`/reports/${id}`);
}

/** 获取报告数量 */
export function fetchReportCount(filter?: {
  strategy?: string;
  symbol?: string;
}): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (filter?.strategy) params.set('strategy', filter.strategy);
  if (filter?.symbol) params.set('symbol', filter.symbol);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<{ count: number }>(`/reports/count${query}`);
}
