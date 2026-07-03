import { describe, it, expect, vi } from 'vitest';
import { BacktestResultProcessor } from '../../src/services/result-processors/backtest-result-processor.js';
import { DiagnosticsResultProcessor } from '../../src/services/result-processors/diagnostics-result-processor.js';
import { createResultProcessorRegistry } from '../../src/services/result-processors/index.js';
import { TaskType } from '../../src/types.js';
import type { ResultProcessor } from '../../src/services/result-processors/types.js';
import type { ReportRepository } from '../../src/storage/report-repo.js';
import type { DiagnosticService } from '../../src/services/diagnostic-service.js';
import type { BacktestReport } from '../../src/types.js';

describe('BacktestResultProcessor', () => {
  it('returns resultId / resultType / data on success', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockRepo = { save: mockSave } as unknown as ReportRepository;
    const processor = new BacktestResultProcessor(mockRepo);

    const envelope = await processor.process({
      task: {
        id: 'task-1',
        type: TaskType.Backtest,
        payload: {
          strategy: 'test-ma',
          symbol: '000300.SH',
          timeframe: '1d',
          startTs: 1700000000000,
          endTs: 1700086400000,
        },
      },
      result: {
        backtestResult: {
          config: {},
          trades: [],
          equityCurve: [{ timestamp: 1700000000000, equity: 1000000 }],
          metrics: {
            totalReturn: 0.05,
            annualizedReturn: 0.12,
            sharpeRatio: 1.5,
            maxDrawdown: -0.05,
            winRate: 0.6,
            totalTrades: 10,
            sortinoRatio: 1.2,
            calmarRatio: 2.4,
            annualizedVolatility: 0.08,
            maxDrawdownDuration: 5,
          },
          profitLossRatio: 1.5,
          avgHoldingDays: 3,
          maxSingleProfit: 5000,
          maxSingleLoss: -2000,
          drawdownCurve: [{ timestamp: 1700000000000, drawdown: 0 }],
          monthlyReturns: [],
          annualReturns: [],
        },
      },
    });

    expect(envelope.resultId).toBeDefined();
    expect(typeof envelope.resultId).toBe('string');
    expect(envelope.resultId).toMatch(/^report-/);
    expect(envelope.resultType).toBe('backtest');
    expect(envelope.data).toHaveProperty('backtestResult');
    expect(mockSave).toHaveBeenCalledTimes(1);

    // verify save was called with expected fields
    const savedReport = mockSave.mock.calls[0][0] as BacktestReport;
    expect(savedReport.taskId).toBe('task-1');
    expect(savedReport.strategyName).toBe('test-ma');
    expect(savedReport.symbol).toBe('000300.SH');
  });

  it('configSnapshot category/subcategory/hash flows to report metadata', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockRepo = { save: mockSave } as unknown as ReportRepository;
    const processor = new BacktestResultProcessor(mockRepo);

    await processor.process({
      task: {
        id: 'task-cfg',
        type: TaskType.Backtest,
        payload: {
          strategy: 'test-ma',
          symbol: '000300.SH',
          timeframe: '1d',
          configSnapshot: {
            strategy: 'test-ma',
            category: 'factor_based',
            subcategory: 'linear_multi_factor',
            hash: 'cfg-hash-abc',
            params: { period: 20 },
          },
        },
      },
      result: {
        backtestResult: {
          config: {},
          trades: [],
          equityCurve: [{ timestamp: 1700000000000, equity: 1000000 }],
          metrics: {
            totalReturn: 0.05,
            annualizedReturn: 0.12,
            sharpeRatio: 1.5,
            maxDrawdown: -0.05,
            winRate: 0.6,
            totalTrades: 10,
            sortinoRatio: 1.2,
            calmarRatio: 2.4,
            annualizedVolatility: 0.08,
            maxDrawdownDuration: 5,
          },
          profitLossRatio: 1.5,
          avgHoldingDays: 3,
          maxSingleProfit: 5000,
          maxSingleLoss: -2000,
          drawdownCurve: [],
          monthlyReturns: [],
          annualReturns: [],
        },
      },
    });

    const savedReport = mockSave.mock.calls[0][0] as BacktestReport;
    expect(savedReport.reportData.strategyCategory).toBe('factor_based');
    expect(savedReport.reportData.strategySubcategory).toBe('linear_multi_factor');
    expect(savedReport.reportData.configHash).toBe('cfg-hash-abc');
  });

  it('throws when report save fails', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('DB error'));
    const mockRepo = { save: mockSave } as unknown as ReportRepository;
    const processor = new BacktestResultProcessor(mockRepo);

    await expect(
      processor.process({
        task: {
          id: 'task-2',
          type: TaskType.Backtest,
          payload: { strategy: 'test', symbol: 'A', timeframe: '1d' },
        },
        result: {
          backtestResult: {
            config: {},
            trades: [],
            equityCurve: [],
            metrics: {
              totalReturn: 0,
              annualizedReturn: 0,
              sharpeRatio: 0,
              maxDrawdown: 0,
              winRate: 0,
              totalTrades: 0,
              sortinoRatio: 0,
              calmarRatio: 0,
              annualizedVolatility: 0,
              maxDrawdownDuration: 0,
            },
            profitLossRatio: 0,
            avgHoldingDays: 0,
            maxSingleProfit: 0,
            maxSingleLoss: 0,
            drawdownCurve: [],
            monthlyReturns: [],
            annualReturns: [],
          },
        },
      })
    ).rejects.toThrow('DB error');
  });
});

describe('DiagnosticsResultProcessor', () => {
  it('returns resultId / resultType / data on success', async () => {
    const mockStore = vi.fn().mockResolvedValue(undefined);
    const mockDiagService = { storeResult: mockStore } as unknown as DiagnosticService;
    const processor = new DiagnosticsResultProcessor(mockDiagService);

    const envelope = await processor.process({
      task: {
        id: 'task-3',
        type: TaskType.Diagnostics,
        payload: {
          strategy: 'test-strat',
          category: 'factor_based',
          configSnapshot: { strategy: 'test-strat', params: {} },
        },
      },
      result: {
        diagnostics: {
          type: 'factor_based',
          ic_series: [{ period: '2024-01', ic: 0.05, rank_ic: 0.04 }],
        },
      },
    });

    expect(envelope.resultId).toBeDefined();
    expect(typeof envelope.resultId).toBe('string');
    expect(envelope.resultType).toBe('diagnostics');
    expect(envelope.data).toHaveProperty('category', 'factor_based');
    expect(envelope.data).toHaveProperty('diagnostics');
    expect(mockStore).toHaveBeenCalledTimes(1);
  });

  it('throws when diagnostic store fails', async () => {
    const mockStore = vi.fn().mockRejectedValue(new Error('Storage error'));
    const mockDiagService = { storeResult: mockStore } as unknown as DiagnosticService;
    const processor = new DiagnosticsResultProcessor(mockDiagService);

    await expect(
      processor.process({
        task: {
          id: 'task-4',
          type: TaskType.Diagnostics,
          payload: { strategy: 'test', category: 'non_factor' },
        },
        result: { diagnostics: { type: 'non_factor' } },
      })
    ).rejects.toThrow('Storage error');
  });

  it('falls back to default category when payload has none', async () => {
    const saved: unknown[] = [];
    const mockStore = vi.fn().mockImplementation((r: unknown) => {
      saved.push(r);
    });
    const mockDiagService = { storeResult: mockStore } as unknown as DiagnosticService;
    const processor = new DiagnosticsResultProcessor(mockDiagService);

    const envelope = await processor.process({
      task: {
        id: 'task-5',
        type: TaskType.Diagnostics,
        payload: { strategy: 'test' },
      },
      result: { diagnostics: { type: 'non_factor' } },
    });

    expect(envelope.resultType).toBe('diagnostics');
    expect(envelope.data.category).toBe('non_factor');
  });
});

describe('createResultProcessorRegistry', () => {
  it('registers backtest and diagnostics processors', () => {
    const mockRepo = {} as unknown as ReportRepository;
    const mockDiag = {} as unknown as DiagnosticService;

    const registry = createResultProcessorRegistry({
      reportRepository: mockRepo,
      diagnosticService: mockDiag,
    });

    expect(registry.has(TaskType.Backtest)).toBe(true);
    expect(registry.has(TaskType.Diagnostics)).toBe(true);
    expect(registry.size).toBe(2);
  });

  it('processors created via registry produce correct resultId/resultType', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    const mockStore = vi.fn().mockResolvedValue(undefined);
    const mockRepo = { save: mockSave } as unknown as ReportRepository;
    const mockDiag = { storeResult: mockStore } as unknown as DiagnosticService;

    const registry = createResultProcessorRegistry({
      reportRepository: mockRepo,
      diagnosticService: mockDiag,
    });

    // Backtest processor via registry
    const backtestProc = registry.get(TaskType.Backtest)!;
    const btEnvelope = await backtestProc.process({
      task: {
        id: 'bt-1',
        type: TaskType.Backtest,
        payload: { strategy: 's', symbol: 'A', timeframe: '1d' },
      },
      result: {
        backtestResult: {
          config: {},
          trades: [],
          equityCurve: [],
          metrics: {
            totalReturn: 0,
            annualizedReturn: 0,
            sharpeRatio: 0,
            maxDrawdown: 0,
            winRate: 0,
            totalTrades: 0,
            sortinoRatio: 0,
            calmarRatio: 0,
            annualizedVolatility: 0,
            maxDrawdownDuration: 0,
          },
          profitLossRatio: 0,
          avgHoldingDays: 0,
          maxSingleProfit: 0,
          maxSingleLoss: 0,
          drawdownCurve: [],
          monthlyReturns: [],
          annualReturns: [],
        },
      },
    });
    expect(btEnvelope.resultType).toBe('backtest');
    expect(btEnvelope.resultId).toMatch(/^report-/);

    // Diagnostics processor via registry
    const diagProc = registry.get(TaskType.Diagnostics)!;
    const diagEnvelope = await diagProc.process({
      task: {
        id: 'diag-1',
        type: TaskType.Diagnostics,
        payload: { strategy: 's', category: 'factor_based' },
      },
      result: { diagnostics: { type: 'factor_based', ic_series: [] } },
    });
    expect(diagEnvelope.resultType).toBe('diagnostics');
    expect(diagEnvelope.resultId).toBeDefined();

    // Unregistered type not in registry
    expect(registry.has(TaskType.Collect)).toBe(false);
  });
});
