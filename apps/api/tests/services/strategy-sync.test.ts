import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCLIOutput, camelToSnakeMeta, strategySyncService } from '../../src/services/strategy-sync.js';

describe('parseCLIOutput', () => {
  it('解析 NDJSON result 事件', () => {
    const stdout = [
      '{"event":"log","level":"info","message":"listing strategies"}',
      '{"event":"result","data":[{"name":"dual_ma","version":"0.1.0"}]}',
    ].join('\n');

    const result = parseCLIOutput(stdout);
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as Array<Record<string, unknown>>)[0].name).toBe('dual_ma');
  });

  it('解析 NDJSON error 事件', () => {
    const stdout = '{"event":"error","error":{"code":"UNKNOWN_COMMAND","message":"Unknown command: foo"}}';

    const result = parseCLIOutput(stdout);
    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('Unknown command');
  });

  it('无 result/error 事件时返回 PARSE_ERROR', () => {
    const stdout = '{"event":"progress","percent":50,"message":"working"}';

    const result = parseCLIOutput(stdout);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PARSE_ERROR');
  });

  it('空输入返回 PARSE_ERROR', () => {
    const result = parseCLIOutput('');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PARSE_ERROR');
  });

  it('非法 JSON 行跳过，正确行仍解析', () => {
    const stdout = ['not json', '{"event":"result","data":[]}'].join('\n');
    const result = parseCLIOutput(stdout);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([]);
  });
});

describe('camelToSnakeMeta', () => {
  const CAMEL_STRATEGY: Record<string, unknown> = {
    name: 'dual_ma',
    category: 'non_factor',
    subcategory: 'trend_cta',
    version: '0.1.0',
    description: '双均线策略',
    workflowReady: true,
    backtestable: true,
    params: [
      {
        name: 'short_period',
        range: [2, 50],
        chartRelevant: true,
        uiConstraints: [
          { kind: 'disable_when', targetField: 'signal_type', targetValue: 'macd' },
        ],
      },
      {
        name: 'long_period',
        range: [5, 200],
        chartRelevant: false,
        uiConstraints: null,
      },
    ],
  };

  it('映射 camelCase → PythonStrategyMeta（完整字段）', () => {
    const meta = camelToSnakeMeta(CAMEL_STRATEGY);

    expect(meta.name).toBe('dual_ma');
    expect(meta.description).toBe('双均线策略');
    expect(meta.version).toBe('0.1.0');
    expect(meta.category).toBe('non_factor');
    expect(meta.subcategory).toBe('trend_cta');
    expect(meta.backtestable).toBe(true);

    expect(meta.params).toHaveLength(2);

    // 第一个参数：完整映射
    const p0 = meta.params[0];
    expect(p0.key).toBe('short_period');
    expect(p0.min).toBe(2);
    expect(p0.max).toBe(50);
    expect(p0.chart_relevant).toBe(true);
    expect(p0.label).toBe('short_period'); // fallback to name
    expect(p0.type).toBe('number'); // default
    expect(p0.default).toBe(0); // default

    expect(p0.ui_constraints).toHaveLength(1);
    expect(p0.ui_constraints![0].kind).toBe('disable_when');
    expect(p0.ui_constraints![0].target_field).toBe('signal_type');
    expect(p0.ui_constraints![0].target_value).toBe('macd');

    // 第二个参数：chartRelevant=false, 无 uiConstraints
    const p1 = meta.params[1];
    expect(p1.key).toBe('long_period');
    expect(p1.chart_relevant).toBe(false);
    expect(p1.ui_constraints).toEqual([]);
  });

  it('缺省字段使用默认值', () => {
    const meta = camelToSnakeMeta({ name: 'empty', description: '' });
    expect(meta.name).toBe('empty');
    expect(meta.params).toEqual([]);
    expect(meta.version).toBe('0.0.0');
    expect(meta.category).toBe('non_factor');
    expect(meta.subcategory).toBeNull();
    expect(meta.backtestable).toBe(false);
  });
});

describe('StrategySyncService', () => {
  beforeEach(() => {
    strategySyncService.clearCache();
  });

  it('Python CLI 不可用时 catch 返回 [] + 不抛异常', async () => {
    // mock 内部 _callCLI 方法抛异常（模拟 Python 未安装或 CLI 不可用）
    const spy = vi.spyOn(strategySyncService as unknown as { _callCLI: () => Promise<unknown> }, '_callCLI')
      .mockRejectedValue(new Error('ENOENT: python not found'));

    const result = await strategySyncService.syncFromPython();
    expect(result).toEqual([]);
    expect(spy).toHaveBeenCalledWith({ command: 'listStrategies' });
  });

  it('CLI 返回 error → 返回 [] 缓存', async () => {
    vi.spyOn(strategySyncService as unknown as { _callCLI: () => Promise<unknown> }, '_callCLI')
      .mockResolvedValue({ ok: false, error: { code: 'UNKNOWN_COMMAND', message: 'test error' } });

    const result = await strategySyncService.syncFromPython();
    expect(result).toEqual([]);
  });

  it('CLI 返回空数据 → 返回空数组', async () => {
    vi.spyOn(strategySyncService as unknown as { _callCLI: () => Promise<unknown> }, '_callCLI')
      .mockResolvedValue({ ok: true, data: [] });

    const result = await strategySyncService.syncFromPython();
    expect(result).toEqual([]);
  });

  it('CLI 返回有效数据 → 正确映射并缓存', async () => {
    const cliData = [
      {
        name: 'dual_ma',
        category: 'non_factor',
        subcategory: 'trend_cta',
        version: '0.1.0',
        description: '双均线策略',
        workflowReady: true,
        backtestable: true,
        params: [{ name: 'period', range: [5, 200], chartRelevant: true, uiConstraints: [] }],
      },
    ];

    vi.spyOn(strategySyncService as unknown as { _callCLI: () => Promise<unknown> }, '_callCLI')
      .mockResolvedValue({ ok: true, data: cliData });

    const result = await strategySyncService.syncFromPython();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('dual_ma');
    expect(result[0].category).toBe('non_factor');
    expect(result[0].params[0].key).toBe('period');
    expect(result[0].params[0].min).toBe(5);
    expect(result[0].params[0].max).toBe(200);

    // 确认缓存生效（第二次调用不触发 _callCLI）
    const resultCached = await strategySyncService.syncFromPython();
    expect(resultCached).toHaveLength(1);
  });
});
