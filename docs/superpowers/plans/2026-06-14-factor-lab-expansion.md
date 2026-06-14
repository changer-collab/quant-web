# Task 1: 因子工坊（Factor Lab）扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现因子计算引擎、因子注册中心和因子评估调度接口，使因子工坊从类型骨架升级为可运行的计算模块。

**Architecture:** 在现有 factor-lab 包（仅 re-export common 类型）基础上新增 4 个模块：compute（因子计算函数）、registry（因子注册中心）、engine（批量计算引擎）、evaluator（评估调度接口）。评估指标的实际计算委托给回测引擎，factor-lab 只定义调度接口。

**Tech Stack:** TypeScript, Vitest, @quant/common

---

## 依赖关系

```text
@quant/factor-lab -> @quant/common（仅依赖）
@quant/backtest-engine -> @quant/factor-lab（回测引擎依赖因子工坊类型）
apps/worker -> @quant/factor-lab（Worker 编排因子计算和评估任务）
```

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| 修改 | `packages/factor-lab/package.json` | 升级版本、添加依赖和脚本 |
| 新建 | `packages/factor-lab/src/compute.ts` | 因子计算函数类型和内置计算器 |
| 新建 | `packages/factor-lab/src/registry.ts` | 因子注册中心 |
| 新建 | `packages/factor-lab/src/engine.ts` | 因子计算引擎（批量计算） |
| 新建 | `packages/factor-lab/src/evaluator.ts` | 因子评估调度接口 |
| 修改 | `packages/factor-lab/src/index.ts` | 统一导出 |
| 新建 | `packages/factor-lab/tests/compute.test.ts` | 计算函数测试 |
| 新建 | `packages/factor-lab/tests/registry.test.ts` | 注册中心测试 |
| 新建 | `packages/factor-lab/tests/engine.test.ts` | 计算引擎测试 |
| 新建 | `packages/factor-lab/tests/evaluator.test.ts` | 评估调度器测试 |

---

## Task 1: 更新 package.json

**Files:**
- Modify: `packages/factor-lab/package.json`

- [ ] **Step 1: 更新 package.json**

```json
{
  "name": "@quant/factor-lab",
  "version": "0.2.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/ tests/"
  },
  "dependencies": {
    "@quant/common": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^3.2.6"
  }
}
```

- [ ] **Step 2: 运行 pnpm install**

Run: `pnpm install`
Expected: 依赖安装成功

---

## Task 2: 创建 src/compute.ts — 因子计算函数

**Files:**
- Create: `packages/factor-lab/src/compute.ts`

- [ ] **Step 1: 创建因子计算模块**

```typescript
import type { Bar } from '@quant/common';
import type { FactorDefinition } from '@quant/common';

/** 因子计算函数：输入 K 线序列，输出因子值序列 */
export type FactorComputeFn = (bars: Bar[]) => FactorValue[];

/** 因子值（时间戳 + 数值） */
export interface FactorValue {
  timestamp: number;
  value: number;
}

/** 因子计算器 — 将 FactorDefinition 的 formula 绑定到具体计算逻辑 */
export interface FactorComputer {
  readonly definition: FactorDefinition;
  compute(bars: Bar[]): FactorValue[];
}

/** 简单因子计算器实现 */
export class SimpleFactorComputer implements FactorComputer {
  constructor(
    public readonly definition: FactorDefinition,
    private readonly fn: FactorComputeFn,
  ) {}

  compute(bars: Bar[]): FactorValue[] {
    return this.fn(bars);
  }
}

// ─── 内置因子计算函数 ───────────────────────────────────

/** 收益率因子 */
export function returnRate(bars: Bar[]): FactorValue[] {
  return bars.slice(1).map((bar, i) => ({
    timestamp: bar.timestamp,
    value: (bar.close - bars[i].close) / bars[i].close,
  }));
}

/** N 日均线因子 */
export function movingAverage(period: number): FactorComputeFn {
  return (bars: Bar[]): FactorValue[] => {
    const result: FactorValue[] = [];
    for (let i = period - 1; i < bars.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += bars[j].close;
      result.push({ timestamp: bars[i].timestamp, value: sum / period });
    }
    return result;
  };
}

/** N 日波动率因子 */
export function volatility(period: number): FactorComputeFn {
  return (bars: Bar[]): FactorValue[] => {
    const result: FactorValue[] = [];
    for (let i = period; i < bars.length; i++) {
      const returns: number[] = [];
      for (let j = i - period + 1; j <= i; j++) {
        returns.push((bars[j].close - bars[j - 1].close) / bars[j - 1].close);
      }
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
      result.push({ timestamp: bars[i].timestamp, value: Math.sqrt(variance) });
    }
    return result;
  };
}

/** N 日动量因子 */
export function momentum(period: number): FactorComputeFn {
  return (bars: Bar[]): FactorValue[] => {
    return bars.slice(period).map((bar, i) => ({
      timestamp: bar.timestamp,
      value: (bar.close - bars[i].close) / bars[i].close,
    }));
  };
}
```

---

## Task 3: 创建 src/registry.ts — 因子注册中心

**Files:**
- Create: `packages/factor-lab/src/registry.ts`

- [ ] **Step 1: 创建因子注册中心**

```typescript
import type { FactorDefinition } from '@quant/common';
import type { FactorComputer, FactorComputeFn } from './compute.js';
import { SimpleFactorComputer } from './compute.js';

/** 因子注册中心 — 管理因子定义和计算器的映射 */
export class FactorRegistry {
  private readonly computers = new Map<string, FactorComputer>();

  /** 注册因子：定义 + 计算函数 */
  register(definition: FactorDefinition, computeFn: FactorComputeFn): void {
    if (this.computers.has(definition.id)) {
      throw new Error(`因子已注册: ${definition.id}`);
    }
    this.computers.set(definition.id, new SimpleFactorComputer(definition, computeFn));
  }

  /** 获取因子计算器 */
  get(factorId: string): FactorComputer | undefined {
    return this.computers.get(factorId);
  }

  /** 列出所有已注册因子定义 */
  listDefinitions(): FactorDefinition[] {
    return Array.from(this.computers.values()).map((c) => c.definition);
  }

  /** 按分类筛选因子 */
  listByCategory(category: string): FactorDefinition[] {
    return this.listDefinitions().filter((d) => d.category === category);
  }

  /** 按状态筛选因子 */
  listByStatus(status: string): FactorDefinition[] {
    return this.listDefinitions().filter((d) => d.status === status);
  }

  /** 注销因子 */
  unregister(factorId: string): boolean {
    return this.computers.delete(factorId);
  }

  /** 已注册因子数量 */
  get size(): number {
    return this.computers.size;
  }
}
```

---

## Task 4: 创建 src/engine.ts — 因子计算引擎

**Files:**
- Create: `packages/factor-lab/src/engine.ts`

- [ ] **Step 1: 创建因子计算引擎**

```typescript
import type { Bar } from '@quant/common';
import type { FactorRegistry } from './registry.js';
import type { FactorValue } from './compute.js';

/** 因子计算请求 */
export interface FactorComputeRequest {
  factorId: string;
  symbol: string;
  bars: Bar[];
}

/** 单因子计算结果 */
export interface FactorComputeResult {
  factorId: string;
  symbol: string;
  values: FactorValue[];
  computedAt: number;
}

/** 批量计算结果 */
export interface BatchComputeResult {
  results: FactorComputeResult[];
  errors: Array<{ factorId: string; error: string }>;
}

/** 因子计算引擎 — 编排因子批量计算 */
export class FactorEngine {
  constructor(private readonly registry: FactorRegistry) {}

  /** 计算单个因子 */
  compute(request: FactorComputeRequest): FactorComputeResult {
    const computer = this.registry.get(request.factorId);
    if (!computer) throw new Error(`因子未注册: ${request.factorId}`);
    const values = computer.compute(request.bars);
    return {
      factorId: request.factorId,
      symbol: request.symbol,
      values,
      computedAt: Date.now(),
    };
  }

  /** 批量计算多个因子 */
  computeBatch(requests: FactorComputeRequest[]): BatchComputeResult {
    const results: FactorComputeResult[] = [];
    const errors: Array<{ factorId: string; error: string }> = [];
    for (const req of requests) {
      try {
        results.push(this.compute(req));
      } catch (err) {
        errors.push({ factorId: req.factorId, error: String(err) });
      }
    }
    return { results, errors };
  }
}
```

---

## Task 5: 创建 src/evaluator.ts — 因子评估调度接口

**Files:**
- Create: `packages/factor-lab/src/evaluator.ts`

- [ ] **Step 1: 创建因子评估调度接口**

```typescript
import type { FactorMetrics } from '@quant/common';
import type { FactorValue } from './compute.js';

/** 因子评估请求 */
export interface FactorEvalRequest {
  factorId: string;
  symbol: string;
  factorValues: FactorValue[];
  evalStart: number;
  evalEnd: number;
}

/** 因子评估结果（扩展 common 的 FactorMetrics） */
export interface FactorEvalResult {
  factorId: string;
  symbol: string;
  evalWindow: { start: number; end: number };
  metrics: FactorMetrics;
  /** IC 序列（按月/周） */
  icSeries: Array<{ timestamp: number; ic: number }>;
  /** 分组收益 */
  groupReturns: Array<{ group: string; return: number }>;
}

/** 因子评估器接口 — 评估指标的计算委托给回测引擎 */
export interface FactorEvaluator {
  evaluate(request: FactorEvalRequest): Promise<FactorEvalResult>;
}

/** 因子评估调度器 — 编排评估任务 */
export class FactorEvalScheduler {
  constructor(private readonly evaluator: FactorEvaluator) {}

  /** 评估单个因子 */
  async evaluateFactor(request: FactorEvalRequest): Promise<FactorEvalResult> {
    return this.evaluator.evaluate(request);
  }

  /** 批量评估 */
  async evaluateBatch(requests: FactorEvalRequest[]): Promise<Array<FactorEvalResult | Error>> {
    return Promise.all(
      requests.map((req) => this.evaluator.evaluate(req).catch((err) => err as Error)),
    );
  }
}
```

---

## Task 6: 更新 src/index.ts — 统一导出

**Files:**
- Modify: `packages/factor-lab/src/index.ts`

- [ ] **Step 1: 替换 index.ts 内容**

```typescript
// compute — 因子计算
export { SimpleFactorComputer } from './compute.js';
export type { FactorComputeFn, FactorComputer, FactorValue } from './compute.js';
export { returnRate, movingAverage, volatility, momentum } from './compute.js';

// registry — 因子注册中心
export { FactorRegistry } from './registry.js';

// engine — 因子计算引擎
export { FactorEngine } from './engine.js';
export type { FactorComputeRequest, FactorComputeResult, BatchComputeResult } from './engine.js';

// evaluator — 因子评估
export { FactorEvalScheduler } from './evaluator.js';
export type { FactorEvalRequest, FactorEvalResult, FactorEvaluator } from './evaluator.js';

// 从 @quant/common 重新导出因子类型（作为权威来源）
export { FactorEvalTab, FactorStatus } from '@quant/common';
export type { FactorDefinition, FactorMetrics, FactorEvaluationResult, FactorRow } from '@quant/common';
```

---

## Task 7: 编写测试 — tests/compute.test.ts

**Files:**
- Create: `packages/factor-lab/tests/compute.test.ts`

- [ ] **Step 1: 创建计算函数测试**

```typescript
import { describe, it, expect } from 'vitest';
import { returnRate, movingAverage, volatility, momentum, SimpleFactorComputer } from '../src/compute.js';
import type { Bar } from '@quant/common';
import { TimeFrame, FactorStatus } from '@quant/common';

function makeBars(count: number, basePrice = 100): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    symbol: 'TEST',
    timeframe: TimeFrame.D1,
    timestamp: 1000 + i * 86400000,
    open: basePrice + i,
    high: basePrice + i + 2,
    low: basePrice + i - 1,
    close: basePrice + i + 1,
    volume: 10000,
  }));
}

describe('因子计算函数', () => {
  it('returnRate 计算收益率', () => {
    const bars = makeBars(5, 100);
    const values = returnRate(bars);
    expect(values).toHaveLength(4);
    // close: 101, 102, 103, 104, 105
    // returnRate[0] = (102 - 101) / 101
    expect(values[0].value).toBeCloseTo(1 / 101, 6);
  });

  it('movingAverage 计算 3 日均线', () => {
    const bars = makeBars(5, 100);
    const values = movingAverage(3)(bars);
    expect(values).toHaveLength(3);
    // close: 101, 102, 103, 104, 105
    // MA3[0] = (101+102+103)/3 = 102
    expect(values[0].value).toBeCloseTo(102, 6);
  });

  it('volatility 计算波动率', () => {
    const bars = makeBars(20, 100);
    const values = volatility(10)(bars);
    expect(values.length).toBeGreaterThan(0);
    values.forEach((v) => expect(v.value).toBeGreaterThanOrEqual(0));
  });

  it('momentum 计算动量', () => {
    const bars = makeBars(10, 100);
    const values = momentum(5)(bars);
    expect(values).toHaveLength(5);
    // close[5]=106, close[0]=101, 动量 = 5/101
    expect(values[0].value).toBeCloseTo(5 / 101, 6);
  });

  it('SimpleFactorComputer 包装计算函数', () => {
    const def = {
      id: 'test-ma5', name: 'MA5', formula: 'ma(close, 5)',
      category: 'technical', modes: [], frequency: '1d',
      status: FactorStatus.Active, version: '1.0.0',
    };
    const computer = new SimpleFactorComputer(def, movingAverage(5));
    const bars = makeBars(10, 100);
    const values = computer.compute(bars);
    expect(values.length).toBeGreaterThan(0);
    expect(computer.definition.id).toBe('test-ma5');
  });
});
```

---

## Task 8: 编写测试 — tests/registry.test.ts

**Files:**
- Create: `packages/factor-lab/tests/registry.test.ts`

- [ ] **Step 1: 创建注册中心测试**

```typescript
import { describe, it, expect } from 'vitest';
import { FactorRegistry } from '../src/registry.js';
import { movingAverage, volatility } from '../src/compute.js';
import { FactorStatus } from '@quant/common';

function makeDef(id: string, category = 'technical') {
  return {
    id, name: id, formula: `formula(${id})`,
    category, modes: [], frequency: '1d',
    status: FactorStatus.Active, version: '1.0.0',
  };
}

describe('FactorRegistry', () => {
  it('注册和获取因子', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    const computer = registry.get('ma5');
    expect(computer).toBeDefined();
    expect(computer!.definition.id).toBe('ma5');
  });

  it('重复注册抛错', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    expect(() => registry.register(makeDef('ma5'), movingAverage(5))).toThrow('因子已注册');
  });

  it('列出所有定义', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    registry.register(makeDef('vol10'), volatility(10));
    expect(registry.listDefinitions()).toHaveLength(2);
    expect(registry.size).toBe(2);
  });

  it('按分类筛选', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5', 'technical'), movingAverage(5));
    registry.register(makeDef('vol10', 'volatility'), volatility(10));
    expect(registry.listByCategory('technical')).toHaveLength(1);
    expect(registry.listByCategory('volatility')).toHaveLength(1);
  });

  it('注销因子', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    expect(registry.unregister('ma5')).toBe(true);
    expect(registry.get('ma5')).toBeUndefined();
    expect(registry.size).toBe(0);
  });
});
```

---

## Task 9: 编写测试 — tests/engine.test.ts

**Files:**
- Create: `packages/factor-lab/tests/engine.test.ts`

- [ ] **Step 1: 创建计算引擎测试**

```typescript
import { describe, it, expect } from 'vitest';
import { FactorEngine } from '../src/engine.js';
import { FactorRegistry } from '../src/registry.js';
import { movingAverage, volatility } from '../src/compute.js';
import { TimeFrame, FactorStatus } from '@quant/common';
import type { Bar } from '@quant/common';

function makeDef(id: string) {
  return {
    id, name: id, formula: `formula(${id})`,
    category: 'technical', modes: [], frequency: '1d',
    status: FactorStatus.Active, version: '1.0.0',
  };
}

function makeBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    symbol: 'TEST', timeframe: TimeFrame.D1,
    timestamp: 1000 + i * 86400000,
    open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 10000,
  }));
}

describe('FactorEngine', () => {
  it('计算单个因子', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    const engine = new FactorEngine(registry);
    const result = engine.compute({ factorId: 'ma5', symbol: 'TEST', bars: makeBars(10) });
    expect(result.factorId).toBe('ma5');
    expect(result.symbol).toBe('TEST');
    expect(result.values.length).toBeGreaterThan(0);
    expect(result.computedAt).toBeGreaterThan(0);
  });

  it('未注册因子抛错', () => {
    const registry = new FactorRegistry();
    const engine = new FactorEngine(registry);
    expect(() => engine.compute({ factorId: 'unknown', symbol: 'TEST', bars: [] })).toThrow('因子未注册');
  });

  it('批量计算', () => {
    const registry = new FactorRegistry();
    registry.register(makeDef('ma5'), movingAverage(5));
    registry.register(makeDef('vol10'), volatility(10));
    const engine = new FactorEngine(registry);
    const bars = makeBars(20);
    const result = engine.computeBatch([
      { factorId: 'ma5', symbol: 'TEST', bars },
      { factorId: 'vol10', symbol: 'TEST', bars },
      { factorId: 'unknown', symbol: 'TEST', bars },
    ]);
    expect(result.results).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });
});
```

---

## Task 10: 编写测试 — tests/evaluator.test.ts

**Files:**
- Create: `packages/factor-lab/tests/evaluator.test.ts`

- [ ] **Step 1: 创建评估调度器测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { FactorEvalScheduler } from '../src/evaluator.js';
import type { FactorEvaluator, FactorEvalRequest, FactorEvalResult } from '../src/evaluator.js';

function makeMockEvaluator(): FactorEvaluator {
  return {
    evaluate: vi.fn(async (req: FactorEvalRequest): Promise<FactorEvalResult> => ({
      factorId: req.factorId,
      symbol: req.symbol,
      evalWindow: { start: req.evalStart, end: req.evalEnd },
      metrics: {
        ic: 0.05, rankIc: 0.06, longShortReturn: 0.1,
        maxDrawdown: -0.05, icWinRate: 0.55, turnover: 0.3,
      },
      icSeries: [{ timestamp: req.evalStart, ic: 0.05 }],
      groupReturns: [{ group: 'Q1', return: 0.02 }],
    })),
  };
}

describe('FactorEvalScheduler', () => {
  it('评估单个因子', async () => {
    const scheduler = new FactorEvalScheduler(makeMockEvaluator());
    const result = await scheduler.evaluateFactor({
      factorId: 'ma5', symbol: 'TEST',
      factorValues: [], evalStart: 1000, evalEnd: 2000,
    });
    expect(result.factorId).toBe('ma5');
    expect(result.metrics.ic).toBe(0.05);
  });

  it('批量评估', async () => {
    const scheduler = new FactorEvalScheduler(makeMockEvaluator());
    const results = await scheduler.evaluateBatch([
      { factorId: 'ma5', symbol: 'TEST', factorValues: [], evalStart: 1000, evalEnd: 2000 },
      { factorId: 'vol10', symbol: 'TEST', factorValues: [], evalStart: 1000, evalEnd: 2000 },
    ]);
    expect(results).toHaveLength(2);
  });

  it('批量评估中单个失败不影响其他', async () => {
    const evaluator: FactorEvaluator = {
      evaluate: vi.fn(async (req) => {
        if (req.factorId === 'bad') throw new Error('评估失败');
        return {
          factorId: req.factorId, symbol: req.symbol,
          evalWindow: { start: req.evalStart, end: req.evalEnd },
          metrics: { ic: 0.05, rankIc: 0.06, longShortReturn: 0.1, maxDrawdown: -0.05, icWinRate: 0.55, turnover: 0.3 },
          icSeries: [], groupReturns: [],
        };
      }),
    };
    const scheduler = new FactorEvalScheduler(evaluator);
    const results = await scheduler.evaluateBatch([
      { factorId: 'good', symbol: 'TEST', factorValues: [], evalStart: 1000, evalEnd: 2000 },
      { factorId: 'bad', symbol: 'TEST', factorValues: [], evalStart: 1000, evalEnd: 2000 },
    ]);
    expect(results[0]).not.toBeInstanceOf(Error);
    expect(results[1]).toBeInstanceOf(Error);
  });
});
```

---

## Task 11: 运行测试验证

- [ ] **Step 1: 运行测试**

Run: `pnpm --filter @quant/factor-lab test`
Expected: 全部通过

- [ ] **Step 2: 运行构建**

Run: `pnpm --filter @quant/factor-lab build`
Expected: 编译通过

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `pnpm test`
Expected: 全部通过

---

## Task 12: Commit

- [ ] **Step 1: 提交**

```bash
git add packages/factor-lab/
git commit -m "feat(factor-lab): add compute engine, registry, and evaluator interfaces"
```
