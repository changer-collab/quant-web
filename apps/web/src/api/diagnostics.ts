import { apiGet } from './client';
import type { DiagnosticResult } from '../data/types';

/** 获取单个诊断结果 */
export function fetchDiagnostic(resultId: string): Promise<DiagnosticResult | null> {
  return apiGet<DiagnosticResult | null>(`/diagnostics/${encodeURIComponent(resultId)}`);
}

/** 按策略名称获取诊断历史 */
export function fetchDiagnosticsByStrategy(strategyName: string): Promise<DiagnosticResult[]> {
  return apiGet<DiagnosticResult[]>(`/diagnostics?strategy=${encodeURIComponent(strategyName)}`);
}
