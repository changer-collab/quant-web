/**
 * ResultProcessor 注册表工厂
 *
 * 创建 TaskType → ResultProcessor 映射。
 * 每个已注册的任务类型在 complete 时由对应 processor 产出带信封的结果。
 */
import { TaskType } from '../../types.js';
import type { ResultProcessor } from './types.js';
import { BacktestResultProcessor } from './backtest-result-processor.js';
import { DiagnosticsResultProcessor } from './diagnostics-result-processor.js';
import type { ReportRepository } from '../../storage/report-repo.js';
import type { DiagnosticService } from '../diagnostic-service.js';

export interface ProcessorRegistryDeps {
  reportRepository: ReportRepository;
  diagnosticService: DiagnosticService;
}

export function createResultProcessorRegistry(deps: ProcessorRegistryDeps): Map<TaskType, ResultProcessor> {
  const registry = new Map<TaskType, ResultProcessor>();

  registry.set(TaskType.Backtest, new BacktestResultProcessor(deps.reportRepository));
  registry.set(TaskType.Diagnostics, new DiagnosticsResultProcessor(deps.diagnosticService));

  return registry;
}
