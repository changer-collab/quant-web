/**
 * 真实端到端集成测试 — SQLite + PythonBridge 全链路
 *
 * 前置条件:
 * - Python 包已安装 (pip install -e .)
 * - data/quant.db 已有数据 (npx tsx scripts/seed-data.ts)
 *
 * 用法: npx vitest run tests/e2e-pipeline.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PythonBridge } from '../src/python-bridge.js';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_PATH = resolve(import.meta.dirname, '..', '..', '..', 'data', 'quant.db');

describe('端到端管道测试', () => {
  let bridge: PythonBridge;

  beforeAll(() => {
    bridge = new PythonBridge({ timeout: 60_000 });
    if (!existsSync(DB_PATH)) {
      throw new Error(`数据库不存在: ${DB_PATH}，请先运行 npx tsx scripts/seed-data.ts`);
    }
  });

  it('PythonBridge → 双均线策略回测 → 完整结果', async () => {
    const result = await bridge.call({
      command: 'backtest',
      strategy: 'dual_ma',
      config: { initialCash: 1000000, slippage: 0.001 },
      dataRange: {
        dbPath: DB_PATH,
        symbol: '600519',
        timeframe: '1d',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data as any;
    // 验证回测配置
    expect(data.config).toBeDefined();
    // 验证交易记录
    expect(Array.isArray(data.trades)).toBe(true);
    expect(data.trades.length).toBeGreaterThan(0);
    // 验证权益曲线 (Python 返回 camelCase: equityCurve)
    expect(Array.isArray(data.equityCurve)).toBe(true);
    expect(data.equityCurve.length).toBeGreaterThan(0);
    // 验证指标 (Python 返回 camelCase)
    expect(data.metrics).toBeDefined();
    expect(typeof data.metrics.totalReturn).toBe('number');
    expect(typeof data.metrics.annualizedReturn).toBe('number');
    expect(typeof data.metrics.sharpeRatio).toBe('number');
    expect(typeof data.metrics.maxDrawdown).toBe('number');
    expect(typeof data.metrics.winRate).toBe('number');
    expect(typeof data.metrics.totalTrades).toBe('number');
    expect(data.metrics.totalTrades).toBeGreaterThan(0);
  });

  it('PythonBridge → 不存在的策略 → 报错', async () => {
    const result = await bridge.call({
      command: 'backtest',
      strategy: 'nonexistent_strategy',
      config: { initialCash: 1000000 },
      dataRange: {
        dbPath: DB_PATH,
        symbol: '600519',
        timeframe: '1d',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBeDefined();
  });

  it('PythonBridge → 不存在的标的 → 报错 NO_DATA', async () => {
    const result = await bridge.call({
      command: 'backtest',
      strategy: 'dual_ma',
      config: { initialCash: 1000000 },
      dataRange: {
        dbPath: DB_PATH,
        symbol: '999999',
        timeframe: '1d',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe('NO_DATA');
  });

  it('PythonBridge → 无效 JSON 命令 → 报错', async () => {
    // PythonBridge 本身会发送有效 JSON，但命令不存在
    const result = await bridge.call({
      command: 'invalid_command',
    });

    expect(result.ok).toBe(false);
    expect(result.error!.code).toBe('UNKNOWN_COMMAND');
  });
});
