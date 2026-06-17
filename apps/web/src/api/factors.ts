import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface ApiFactor {
  id: string;
  name: string;
  formula: string;
  category: string;
  modes: string[];
  frequency: string;
  status: string;
  version: string;
}

export function fetchFactors(): Promise<ApiFactor[]> {
  return apiGet<ApiFactor[]>('/factors');
}

export function fetchFactor(id: string): Promise<ApiFactor> {
  return apiGet<ApiFactor>(`/factors/${id}`);
}

export function createFactor(factor: Omit<ApiFactor, 'version'> & { version?: string }): Promise<ApiFactor> {
  return apiPost<ApiFactor>('/factors', factor);
}

export function updateFactor(id: string, updates: Partial<ApiFactor>): Promise<ApiFactor> {
  return apiPut<ApiFactor>(`/factors/${id}`, updates);
}

export function deleteFactor(id: string): Promise<void> {
  return apiDelete(`/factors/${id}`);
}
