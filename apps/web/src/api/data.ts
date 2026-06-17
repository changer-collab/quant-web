import { apiGet } from './client';

export interface ApiInstrument {
  symbol: string;
  name: string;
  exchange: string;
  industry?: string;
  sector?: string;
  status: string;
}

export function fetchInstruments(params?: {
  industry?: string;
  sector?: string;
  status?: string;
}): Promise<ApiInstrument[]> {
  const query = new URLSearchParams();
  if (params?.industry) query.set('industry', params.industry);
  if (params?.sector) query.set('sector', params.sector);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiGet<ApiInstrument[]>(`/data/instruments${qs ? `?${qs}` : ''}`);
}
