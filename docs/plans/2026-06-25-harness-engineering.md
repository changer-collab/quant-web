# Agent 包装层实现计划

> **For agentic workers:** 使用 subagent-driven-development 或 executing-plans 实施此计划。

**Goal:** 为 Worker 中的现有模块（backtest-handler, factor-eval-handler, python-bridge）构建统一的 Agent 包装层，使其能被标准化调用，并为 Loop Engineering 的迭代执行提供统一接口。

**Architecture:** 在 `apps/worker/src/agents/` 目录下创建 Agent 抽象层，定义统一的 `AgentExecutor` 接口。每个 Agent 包装一个现有 Handler，将异步任务转化为标准化的 Agent 调用。Loop Handler 通过 Agent 接口调度每次迭代，实现循环编排与执行解耦。

**Tech Stack:** TypeScript, 现有 TaskHandler/PythonBridge 基础设施

---

## 文件结构

| 文件                                                | 职责                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `apps/worker/src/agents/base.ts`                  | Agent 接口定义（AgentExecutor, AgentRequest, AgentResponse） |
| `apps/worker/src/agents/backtest-agent.ts`        | 包装 BacktestHandler，标准化回测调用                         |
| `apps/worker/src/agents/python-agent.ts`          | 包装 PythonBridge，提供通用 Python Agent 能力                |
| `apps/worker/src/agents/index.ts`                 | 统一导出                                                     |
| `apps/worker/tests/agents/base.test.ts`           | Agent 接口测试                                               |
| `apps/worker/tests/agents/backtest-agent.test.ts` | BacktestAgent 测试                                           |
| `apps/worker/tests/agents/python-agent.test.ts`   | PythonAgent 测试                                             |

---

## Task 1: 定义 Agent 接口

**Files:**

- Create: `apps/worker/src/agents/base.ts`
- Test: `apps/worker/tests/agents/base.test.ts`

- [ ] **Step 1: 创建测试文件，定义 Agent 接口期望**

```typescript
// apps/worker/tests/agents/base.test.ts
import { describe, it, expect } from 'vitest';
import type { AgentExecutor, AgentRequest, AgentResponse } from '../../src/agents/base.js';

describe('Agent interfaces', () => {
  it('AgentRequest has required fields', () => {
    const request: AgentRequest = {
      agentType: 'backtest',
      taskId: 'task-1',
      params: { strategy: 'dual_ma' },
    };
    expect(request.agentType).toBe('backtest');
    expect(request.taskId).toBe('task-1');
  });

  it('AgentResponse has required fields', () => {
    const response: AgentResponse = {
      success: true,
      taskId: 'task-1',
      data: { result: 'ok' },
    };
    expect(response.success).toBe(true);
    expect(response.taskId).toBe('task-1');
  });
});
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `cd apps/worker && npx vitest run tests/agents/base.test.ts`
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 Agent 接口定义**

```typescript
// apps/worker/src/agents/base.ts
/**
 * Agent 包装层 — 统一的 Agent 执行接口
 *
 * 为现有 Handler 提供标准化的 Agent 调用协议，
 * 使 Loop Engine 能通过统一接口调度不同类型的子任务。
 */

/** Agent 类型 */
export type AgentType = 'backtest' | 'factor_eval' | 'factor_compute' | 'ai_train' | 'collect';

/** Agent 请求 */
export interface AgentRequest {
  agentType: AgentType;
  taskId: string;
  params: Record<string, unknown>;
  /** 可选：事件回调（用于流式输出） */
  onEvent?: (event: { event: string; [key: string]: unknown }) => void;
}

/** Agent 响应 */
export interface AgentResponse {
  success: boolean;
  taskId: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  /** 执行时长（毫秒） */
  durationMs?: number;
}

/** Agent 执行器接口 */
export interface AgentExecutor {
  /** Agent 类型 */
  readonly agentType: AgentType;

  /** 执行 Agent 任务 */
  execute(request: AgentRequest): Promise<AgentResponse>;
}
```

- [ ] **Step 4: 运行测试，验证通过**

Run: `cd apps/worker && npx vitest run tests/agents/base.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/agents/base.ts apps/worker/tests/agents/base.test.ts
git commit -m "feat(agent-harness): define AgentExecutor interface"
```

---

## Task 2: 实现 PythonAgent

**Files:**

- Create: `apps/worker/src/agents/python-agent.ts`
- Test: `apps/worker/tests/agents/python-agent.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
// apps/worker/tests/agents/python-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PythonAgent } from '../../src/agents/python-agent.js';
import type { PythonBridge } from '../../src/python-bridge.js';

function createMockBridge(returnData: Record<string, unknown> = {}): PythonBridge {
  return {
    call: vi.fn().mockResolvedValue({ ok: true, data: returnData }),
    streamCall: vi.fn().mockResolvedValue({ ok: true, data: returnData }),
  } as unknown as PythonBridge;
}

describe('PythonAgent', () => {
  it('executes command via PythonBridge', async () => {
    const bridge = createMockBridge({ result: 'ok' });
    const agent = new PythonAgent(bridge);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-1',
      params: { command: 'backtest', strategy: 'dual_ma' },
    });

    expect(response.success).toBe(true);
    expect(response.taskId).toBe('task-1');
    expect(bridge.call).toHaveBeenCalledWith({ command: 'backtest', strategy: 'dual_ma' });
  });

  it('handles bridge error', async () => {
    const bridge = {
      call: vi.fn().mockResolvedValue({ ok: false, error: { code: 'PYTHON_ERROR', message: 'Failed' } }),
      streamCall: vi.fn(),
    } as unknown as PythonBridge;
    const agent = new PythonAgent(bridge);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-2',
      params: { command: 'backtest' },
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('PYTHON_ERROR');
  });

  it('supports stream mode with onEvent callback', async () => {
    const bridge = createMockBridge({ result: 'ok' });
    const agent = new PythonAgent(bridge);
    const onEvent = vi.fn();

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-3',
      params: { command: 'backtest' },
      onEvent,
    });

    expect(bridge.streamCall).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `cd apps/worker && npx vitest run tests/agents/python-agent.test.ts`
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 PythonAgent**

```typescript
// apps/worker/src/agents/python-agent.ts
/**
 * Python Agent — 通过 PythonBridge 调用 Python 引擎
 *
 * 将 PythonBridge 的 call/streamCall 封装为 AgentExecutor 接口，
 * 使上层（LoopHandler、Worker）能通过统一接口调用 Python 引擎。
 */

import type { PythonBridge } from '../python-bridge.js';
import type { AgentExecutor, AgentRequest, AgentResponse } from './base.js';

export class PythonAgent implements AgentExecutor {
  readonly agentType = 'backtest' as const;

  constructor(private readonly bridge: PythonBridge) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      let result;
      if (request.onEvent) {
        result = await this.bridge.streamCall(
          request.params,
          request.onEvent as (event: { event: string; [key: string]: unknown }) => void,
        );
      } else {
        result = await this.bridge.call(request.params);
      }

      const durationMs = Date.now() - startTime;

      if (result.ok) {
        return {
          success: true,
          taskId: request.taskId,
          data: result.data as Record<string, unknown>,
          durationMs,
        };
      } else {
        return {
          success: false,
          taskId: request.taskId,
          error: result.error,
          durationMs,
        };
      }
    } catch (err) {
      return {
        success: false,
        taskId: request.taskId,
        error: { code: 'AGENT_ERROR', message: String(err) },
        durationMs: Date.now() - startTime,
      };
    }
  }
}
```

- [ ] **Step 4: 运行测试，验证通过**

Run: `cd apps/worker && npx vitest run tests/agents/python-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/agents/python-agent.ts apps/worker/tests/agents/python-agent.test.ts
git commit -m "feat(agent-harness): implement PythonAgent wrapping PythonBridge"
```

---

## Task 3: 实现 BacktestAgent

**Files:**

- Create: `apps/worker/src/agents/backtest-agent.ts`
- Test: `apps/worker/tests/agents/backtest-agent.test.ts`

- [ ] **Step 1: 创建测试文件**

```typescript
// apps/worker/tests/agents/backtest-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { BacktestAgent } from '../../src/agents/backtest-agent.js';
import type { AgentExecutor } from '../../src/agents/base.js';

function createMockExecutor(returnData: Record<string, unknown> = {}): AgentExecutor {
  return {
    agentType: 'backtest',
    execute: vi.fn().mockResolvedValue({
      success: true,
      taskId: 'task-1',
      data: returnData,
    }),
  };
}

describe('BacktestAgent', () => {
  it('wraps PythonAgent for backtest execution', async () => {
    const inner = createMockExecutor({ metrics: { sharpeRatio: 1.5 } });
    const agent = new BacktestAgent(inner);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-1',
      params: {
        command: 'backtest',
        strategy: 'dual_ma',
        config: { initialCash: 100000 },
        dataRange: { symbol: '000001.SZ', timeframe: '1d' },
      },
    });

    expect(response.success).toBe(true);
    expect(response.data?.metrics).toEqual({ sharpeRatio: 1.5 });
  });

  it('transforms params to Python CLI format', async () => {
    const inner = createMockExecutor();
    const agent = new BacktestAgent(inner);

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-2',
      params: {
        strategy: 'dual_ma',
        symbol: '000001.SZ',
        timeframe: '1d',
        initialCash: 100000,
      },
    });

    // 验证参数转换
    expect(inner.execute).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        command: 'backtest',
        strategy: 'dual_ma',
      }),
    }));
  });
});
```

- [ ] **Step 2: 运行测试，验证失败**

Run: `cd apps/worker && npx vitest run tests/agents/backtest-agent.test.ts`
Expected: FAIL - 模块不存在

- [ ] **Step 3: 实现 BacktestAgent**

```typescript
// apps/worker/src/agents/backtest-agent.ts
/**
 * Backtest Agent — 标准化回测调用
 *
 * 将前端/Loop 的回测请求转换为 Python CLI 格式，
 * 通过 PythonAgent 执行并返回标准化结果。
 */

import type { AgentExecutor, AgentRequest, AgentResponse } from './base.js';

/** 回测参数（前端/Loop 格式） */
export interface BacktestParams {
  strategy: string;
  symbol?: string;
  symbols?: string[];
  timeframe?: string;
  initialCash?: number;
  slippage?: number;
  startTs?: number;
  endTs?: number;
  params?: Record<string, unknown>;
}

export class BacktestAgent implements AgentExecutor {
  readonly agentType = 'backtest' as const;

  constructor(private readonly inner: AgentExecutor) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const params = request.params as BacktestParams;

    // 转换为 Python CLI 格式
    const cliParams = {
      command: 'backtest',
      strategy: params.strategy,
      config: {
        initialCash: params.initialCash,
        slippage: params.slippage,
        strategyParams: params.params ?? {},
      },
      dataRange: {
        symbol: params.symbol,
        symbols: params.symbols,
        timeframe: params.timeframe ?? '1d',
        startTs: params.startTs,
        endTs: params.endTs,
      },
    };

    return this.inner.execute({
      ...request,
      params: cliParams,
    });
  }
}
```

- [ ] **Step 4: 运行测试，验证通过**

Run: `cd apps/worker && npx vitest run tests/agents/backtest-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/agents/backtest-agent.ts apps/worker/tests/agents/backtest-agent.test.ts
git commit -m "feat(agent-harness): implement BacktestAgent with param transformation"
```

---

## Task 4: 创建 Agent 工厂和统一导出

**Files:**

- Create: `apps/worker/src/agents/index.ts`

- [ ] **Step 1: 创建统一导出**

```typescript
// apps/worker/src/agents/index.ts
/**
 * Agent 包装层 — 统一导出
 */

export type { AgentExecutor, AgentRequest, AgentResponse, AgentType } from './base.js';
export { PythonAgent } from './python-agent.js';
export { BacktestAgent } from './backtest-agent.js';

import type { PythonBridge } from '../python-bridge.js';
import type { AgentExecutor } from './base.js';
import { PythonAgent } from './python-agent.js';
import { BacktestAgent } from './backtest-agent.js';

/** 创建回测 Agent（带参数转换） */
export function createBacktestAgent(bridge: PythonBridge): AgentExecutor {
  const pythonAgent = new PythonAgent(bridge);
  return new BacktestAgent(pythonAgent);
}

/** 创建通用 Python Agent（直接调用 Python CLI） */
export function createPythonAgent(bridge: PythonBridge): AgentExecutor {
  return new PythonAgent(bridge);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker/src/agents/index.ts
git commit -m "feat(agent-harness): add agent factory and exports"
```

---

## Task 5: 更新 LoopHandler 使用 Agent 接口

**Files:**

- Modify: `apps/worker/src/handlers/loop-handler.ts`

- [ ] **Step 1: 读取现有 LoopHandler**

确认当前实现：loop-handler.ts 当前是骨架，直接返回空结果。

- [ ] **Step 2: 修改 LoopHandler，注入 AgentExecutor**

```typescript
// apps/worker/src/handlers/loop-handler.ts（修改后）
/**
 * 循环任务处理器 — 编排多次子任务迭代
 *
 * 通过 AgentExecutor 接口调用子任务，实现循环编排与执行解耦。
 * 循环状态由 Worker 通过 API 任务表持久化，不在 Handler 内部管理。
 */
import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { AgentExecutor, AgentRequest } from '../agents/base.js';
import type { PythonBridge } from '../python-bridge.js';
import { createBacktestAgent } from '../agents/index.js';

/** 循环任务参数 */
export interface LoopPayload {
  id: string;
  type: string;
  maxIterations: number;
  subtaskConfig: Record<string, unknown>;
}

/** 单次迭代记录（只存引用和摘要，不内联完整结果） */
export interface IterationRecord {
  id: string;
  loopId: string;
  sequence: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  subtaskId?: string;
  summary: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
}

/** 循环任务结果 */
export interface LoopResult {
  loopId: string;
  config: LoopPayload;
  status: 'completed' | 'failed' | 'cancelled';
  iterations: IterationRecord[];
  summary: {
    totalIterations: number;
    completedIterations: number;
    failedIterations: number;
    durationMs?: number;
    bestResult?: Record<string, unknown>;
  };
}

/** 循环任务处理器 — 编排多次子任务迭代 */
export class LoopHandler implements TaskHandler {
  readonly type = TaskType.Backtest; // 暂时复用 backtest 类型，后续可新增 Loop 类型

  private readonly agentExecutor: AgentExecutor;

  constructor(bridge: PythonBridge) {
    // 默认使用回测 Agent，可根据 loopType 动态切换
    this.agentExecutor = createBacktestAgent(bridge);
  }

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const config = task.payload as unknown as LoopPayload;
    const iterations: IterationRecord[] = [];

    // 当前阶段：骨架实现，只记录循环配置
    // 后续：根据 LoopConfig.type 调度多次子任务
    // 示例循环结构：
    // for (let i = 0; i < config.maxIterations; i++) {
    //   const iteration = await this.runIteration(config, i);
    //   iterations.push(iteration);
    //   if (this.shouldStop(iterations)) break;
    // }

    return {
      taskId: task.id,
      loopResult: {
        loopId: config.id,
        config,
        status: 'completed',
        iterations,
        summary: {
          totalIterations: 0,
          completedIterations: 0,
          failedIterations: 0,
        },
      } satisfies LoopResult,
    };
  }

  /** 执行单次迭代（骨架） */
  private async runIteration(
    config: LoopPayload,
    sequence: number,
  ): Promise<IterationRecord> {
    const request: AgentRequest = {
      agentType: 'backtest',
      taskId: `${config.id}-iter-${sequence}`,
      params: config.subtaskConfig,
    };

    const response = await this.agentExecutor.execute(request);

    return {
      id: request.taskId,
      loopId: config.id,
      sequence,
      status: response.success ? 'completed' : 'failed',
      summary: response.data ?? {},
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/handlers/loop-handler.ts
git commit -m "refactor(loop-handler): inject AgentExecutor for iteration execution"
```

---

## Task 6: 更新 Worker 初始化，注入 Agent

**Files:**

- Modify: `apps/worker/src/main.ts`

- [ ] **Step 1: 读取现有 main.ts**

确认 Worker 初始化方式。

- [ ] **Step 2: 确认修改点**

当前 `main.ts` 中 `BacktestHandler` 直接接收 `PythonBridge`，无需修改。Agent 包装层是可选的增强，现有 Handler 保持不变。

**结论**：此步骤无需修改，保持现有初始化逻辑。

---

## Task 7: 运行全量测试

- [ ] **Step 1: 运行 Worker 测试**

Run: `cd apps/worker && npx vitest run`
Expected: 所有测试通过（包括新增的 agent 测试）

- [ ] **Step 2: Commit（如有失败修复）**

---

## 与 Loop Engineering 的融合关系

### 当前阶段（骨架）

```
LoopHandler（调度）
    ↓ 调用
AgentExecutor（接口）
    ↓ 实现
BacktestAgent → PythonAgent → PythonBridge → Python CLI
```

### 未来演进（Loop 实现阶段）

```
LoopHandler（调度）
    ↓ 根据 LoopType 选择 Agent
    ├── BacktestAgent（回测循环）
    ├── FactorEvalAgent（因子评估循环）
    └── AITrainAgent（AI 训练循环）
    ↓ 执行
AgentExecutor.execute()
    ↓ 
Loop Condition（终止条件判断，来自 loop-engine）
    ↓
LoopRecord（迭代记录，存引用和摘要）
```

### 融合点

1. **循环迭代执行**：LoopHandler 通过 AgentExecutor 接口调度每次迭代
2. **终止条件**：loop-engine 的 `LoopCondition` 判断是否停止
3. **迭代记录**：IterationRecord 只存 subtaskId 和 summary，不内联完整结果
4. **状态持久化**：循环状态由 Worker 通过 API 任务表管理

---

## 未来发展方向（方案 1 + 方案 2 + Loop Engineering 融合）

### Phase 1: Agent 包装层（当前计划）

- 为现有模块创建 Agent 包装
- 统一 AgentExecutor 接口
- LoopHandler 通过 Agent 接口调度

### Phase 2: 通用 Agent Harness（方案 1）

- 创建 `packages/agent-harness` 通用框架
- 定义 Agent 角色、能力边界、工具接口
- 支持约束机制、反馈循环、可观测性
- 可被多个子项目复用

### Phase 3: Loop + Agent 深度融合

- Loop Engine 根据 LoopType 动态选择 Agent
- Agent 之间可以协作（如 backtest → ai_train → factor_eval）
- 循环内部支持条件分支和并行迭代
- 建立 Agent 测试评估框架

### 长期愿景

```
packages/agent-harness（通用 Agent 框架）
    ├── AgentExecutor 接口
    ├── Agent 角色定义
    ├── 工具系统
    └── 约束机制

apps/worker/src/agents/（具体 Agent 实现）
    ├── backtest-agent.ts
    ├── factor-agent.ts
    ├── ai-agent.ts
    └── collect-agent.ts

packages/loop-engine（循环编排）
    ├── LoopType → Agent 映射
    ├── LoopCondition → 终止判断
    └── IterationRecord → 执行记录

packages/agent-harness/tests/（Agent 测试评估）
    ├── 评估指标
    ├── 测试环境
    └── 反馈循环
```
