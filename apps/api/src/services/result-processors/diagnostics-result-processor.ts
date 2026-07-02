/**
 * 诊断结果处理器
 *
 * 将 Worker 返回的 diagnostics result 构造为 DiagnosticResult 对象
 * 并通过 DiagnosticService 持久化。
 */
import { randomUUID } from 'node:crypto';
import type { ResultProcessor, ResultProcessorContext, ResultProcessorOutput } from './types.js';
import type { DiagnosticService } from '../diagnostic-service.js';
import type { DiagnosticResult, ConfigSnapshot } from '../../types.js';

export class DiagnosticsResultProcessor implements ResultProcessor {
  constructor(private diagnosticService: DiagnosticService) {}

  async process(ctx: ResultProcessorContext): Promise<ResultProcessorOutput> {
    const { task, result } = ctx;
    const payload = task.payload as Record<string, unknown>;
    const diagData = (result as { diagnostics?: Record<string, unknown> }).diagnostics ?? result;

    const configSnapshot = (payload.configSnapshot as ConfigSnapshot) ?? {
      strategy: (payload.strategy as string) || 'unknown',
      params: {},
    };
    const now = Date.now();
    const diagnosticResult: DiagnosticResult = {
      id: randomUUID(),
      taskId: task.id,
      strategy: (payload.strategy as string) || 'unknown',
      category: (payload.category as DiagnosticResult['category']) || 'non_factor',
      subcategory: configSnapshot.subcategory ?? null,
      configSnapshot,
      dataJson: diagData,
      createdAt: now,
      engineVersion:
        ((result as Record<string, unknown>).engine_version as string) ??
        ((diagData as Record<string, unknown>).engine_version as string) ??
        'legacy',
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    };

    await this.diagnosticService.storeResult(diagnosticResult);

    return {
      resultId: diagnosticResult.id,
      resultType: 'diagnostics',
      data: { category: diagnosticResult.category, diagnostics: diagData },
    };
  }
}
