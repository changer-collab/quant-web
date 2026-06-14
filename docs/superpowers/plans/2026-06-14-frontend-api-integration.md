# Task 4: 前端对接后端实施计划

## 目标

将 `apps/web` 从纯模拟数据切换为对接 API 后端，实现真实数据流。当前前端使用 `appData.ts` 中的静态数据，需要引入 API 客户端层，逐步替换模拟数据。

## 前置条件

- Task 3（API HTTP 入口）已完成，API 可用
- API 端点：`/api/strategies`、`/api/tasks`、`/api/factors`、`/api/data`

## 文件结构变更

```
apps/web/src/
├── api/                     # 新增：API 客户端层
│   ├── client.ts            # 基础 HTTP 客户端
│   ├── strategy.ts          # 策略 API
│   ├── task.ts              # 任务 API
│   ├── factor.ts            # 因子 API
│   └── data.ts              # 数据 API
├── hooks/
│   ├── useLanguage.ts       # 不变
│   ├── useResearchWorkflow.ts  # 改造：对接真实 API
│   └── useApi.ts            # 新增：通用 API hook
├── components/              # 逐步改造，props 不变
├── appData.ts               # 保留作为 fallback
└── App.tsx                  # 改造：注入 API 数据
```

## 实施步骤

### Step 1: API 客户端层

**`src/api/client.ts`** — 基础 HTTP 客户端：

```typescript
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json() as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json() as T;
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const apiClient = new ApiClient();
```

### Step 2: 各模块 API 封装

**`src/api/strategy.ts`**：

```typescript
import { apiClient } from './client.js';
import type { StrategyRow } from '../appData.js';

export async function fetchStrategies(): Promise<StrategyRow[]> {
  const data = await apiClient.get<Array<{ name: string; description: string; params: StrategyParamDef[] }>>('/api/strategies');
  // 将 API 响应映射为前端 StrategyRow 类型
  return data.map(s => mapToStrategyRow(s));
}
```

**`src/api/task.ts`**：

```typescript
import { apiClient } from './client.js';
import type { TaskType } from '@quant/common';

export async function submitTask(type: TaskType, payload: Record<string, unknown>) {
  return apiClient.post<{ id: string; status: string }>('/api/tasks', { type, payload });
}

export async function fetchTasks() {
  return apiClient.get<Array<TaskRecord>>('/api/tasks');
}

export async function fetchTask(id: string) {
  return apiClient.get<TaskRecord>(`/api/tasks/${id}`);
}
```

**`src/api/factor.ts`**：

```typescript
import { apiClient } from './client.js';
import type { FactorDisplayRow, FactorEvalDisplayResult } from '../appData.js';

export async function fetchFactors(): Promise<FactorDisplayRow[]> {
  const data = await apiClient.get<FactorDefinition[]>('/api/factors');
  return data.map(mapToFactorDisplayRow);
}

export async function createFactor(definition: FactorDefinition) {
  return apiClient.post<FactorDefinition>('/api/factors', definition);
}

export async function triggerEvaluation(factorId: string) {
  return apiClient.post<{ taskId: string; status: string }>(`/api/factors/${factorId}/evaluate`);
}

export async function triggerCompute(payload: { factorIds: string[]; instruments: string[]; startDate: number; endDate: number }) {
  return apiClient.post<{ taskId: string; status: string }>('/api/factors/compute', payload);
}
```

**`src/api/data.ts`**：

```typescript
import { apiClient } from './client.js';
import type { MarketTick } from '../appData.js';

export async function fetchInstruments(query?: { symbols?: string }) {
  return apiClient.get<Array<Instrument>>('/api/data/instruments' + (query ? `?symbols=${query.symbols}` : ''));
}

export async function fetchBars(params: { symbol: string; timeframe: string; start?: number; end?: number }) {
  const qs = new URLSearchParams(params as any).toString();
  return apiClient.get<Array<Bar>>(`/api/data/bars?${qs}`);
}
```

### Step 3: 通用 API Hook

**`src/hooks/useApi.ts`**：

```typescript
import { useState, useEffect, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null });

  const fetch = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: String(err) });
    }
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...state, refetch: fetch };
}
```

### Step 4: 改造 App.tsx

**核心思路**：App.tsx 中调用 API 获取数据，如果 API 不可用则 fallback 到模拟数据。组件 props 接口不变。

```typescript
// App.tsx 改造示意
import { useApi } from './hooks/useApi';
import { fetchStrategies } from './api/strategy';
import { fetchFactors } from './api/factor';
import { getStrategies, getFactors } from './appData'; // fallback

function App() {
  const strategiesApi = useApi(fetchStrategies);
  const factorsApi = useApi(fetchFactors);

  // API 失败时 fallback 到模拟数据
  const strategies = strategiesApi.data ?? getStrategies();
  const factors = factorsApi.data ?? getFactors();

  // 传递给组件，props 接口不变
  return <StrategyTable strategies={strategies} ui={ui} />;
}
```

### Step 5: 改造研究工作流

**`src/hooks/useResearchWorkflow.ts`** — 对接任务提交 API：

```typescript
import { submitTask, fetchTask } from '../api/task';

export function useResearchWorkflow() {
  // ... 现有逻辑保留

  // 新增：提交回测任务到后端
  async function submitBacktest(config: BacktestConfig) {
    const result = await submitTask(TaskType.Backtest, config);
    // 轮询任务状态或使用现有 job 机制
    return result;
  }

  // 新增：提交因子评估任务
  async function submitFactorEval(factorId: string) {
    return triggerEvaluation(factorId);
  }
}
```

### Step 6: 环境变量配置

**`.env.development`**：

```
VITE_API_BASE=http://localhost:3000
```

**`.env.production`**：

```
VITE_API_BASE=
```

## 测试计划

### 单元测试

| 测试文件 | 覆盖内容 |
|---------|---------|
| `__tests__/api/client.test.ts` | HTTP 客户端 GET/POST、错误处理 |
| `__tests__/api/strategy.test.ts` | 策略 API 映射 |
| `__tests__/api/task.test.ts` | 任务提交/查询 |
| `__tests__/api/factor.test.ts` | 因子 CRUD、评估触发 |
| `__tests__/hooks/useApi.test.ts` | hook 状态管理、loading/error |

### 测试策略

- API 客户端测试用 `fetch` mock（`vi.fn`）
- hook 测试用 `@testing-library/react-hooks` 或 Vitest 的 `renderHook`
- 组件测试不变，仍用模拟数据验证 UI 逻辑
- 不启动真实后端

### 关键测试用例

```typescript
// client.test.ts
test('GET 请求正常返回数据', async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{ name: 'dual-ma' }]),
  });
  globalThis.fetch = mockFetch;

  const client = new ApiClient('http://test');
  const data = await client.get('/api/strategies');
  expect(data).toEqual([{ name: 'dual-ma' }]);
});

// useApi.test.ts
test('API 失败时 error 非空', async () => {
  const { result } = renderHook(() => useApi(() => Promise.reject('Network error')));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.data).toBeNull();
});
```

## 验证标准

1. `npm test` 全部通过
2. `npm run build` 无类型错误
3. API 不可用时，前端自动 fallback 到模拟数据，页面正常显示
4. API 可用时，策略列表、因子列表、任务提交使用真实数据
5. 组件 props 接口不变，组件内部逻辑不变
6. 不引入路由库、状态管理库（除非用户明确要求）
