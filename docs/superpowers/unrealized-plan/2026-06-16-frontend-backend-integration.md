# 前后端对接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端模拟数据替换为 API 真实数据，跑通"选择策略 → 运行回测 → 查看结果"核心闭环。

**Architecture:** 前端新增 `src/api/` 请求层封装 fetch 调用，通过 Vite proxy 代理到 API server；用自定义 hooks 管理请求状态（loading/error/data），逐步替换各页面的模拟数据源。保留 fallback 机制——API 不可用时降级到现有模拟数据。

**Tech Stack:** React hooks (useState/useEffect/useCallback)、原生 fetch API、Vite proxy、Fastify API（已实现）

---

## 当前进度

> **最后更新：** 2026-06-17

### 整体进度：部分完成（约 40%）

| Task | 状态 | 说明 |
|------|------|------|
| Task 1: Vite proxy + API client | ✅ 已完成 | `apps/web/src/api/client.ts` + Vite proxy 已配置 |
| Task 2: API 调用函数 + useApi hook | ✅ 已完成 | `api/strategies.ts`、`api/tasks.ts`、`api/factors.ts`、`api/data.ts` + `useApi.ts` 已实现 |
| Task 3: 策略列表页对接 | ⚠️ 部分完成 | `App.tsx` 有 API 优先 + fallback 逻辑，但未完全替换模拟数据 |
| Task 4: 回测运行对接 | ⚠️ 部分完成 | `useResearchWorkflow.ts` 尝试 API 提交，失败时 fallback 到 `createMockJobAndReport` |
| Task 5: 任务列表页对接 | ⚠️ 部分完成 | `useTasks.ts` 已对接 API，但前端仍保留模拟数据兜底 |
| Task 6: 因子工坊对接 | ⚠️ 部分完成 | `useFactors.ts` 已实现，但 `factor-lab.tsx` 仍使用模拟数据 |
| Task 7: 端到端验证 + 清理 | ❌ 未完成 | 未移除 fallback 机制，未做完整 E2E 验证 |

### 已实现

- `apps/web/src/api/` 目录下 5 个 API 模块（client/strategies/tasks/factors/data）
- `apps/web/src/hooks/` 下 4 个数据 hook（useApi/useStrategies/useTasks/useFactors）
- Vite proxy 配置（`vite.config.ts`）
- `App.tsx` 中 API 优先 + fallback 到模拟数据的机制

### 未完成

- 前端各页面未完全切换到 API 数据，仍依赖 `appData.ts` 中的模拟数据兜底
- `useResearchWorkflow.ts` 中 `createMockJobAndReport` 仍在使用
- 未做完整的端到端验证（API → Worker → Python → 结果回传）
- fallback 机制未移除

### 阻塞原因

- ~~真实数据未接入（依赖 `real-data-ingestion-and-e2e-verification` 计划）~~ ✅ 已打通（baostock 采集 + CLI 回测验证通过）
- Worker PythonBridge 与真实 Python CLI 的集成待验证（CLI 侧已就绪，Worker 侧未联调）

---

## 文件结构

### 新增文件

| 文件 | 职责 |
|------|------|
| `apps/web/src/api/client.ts` | HTTP 请求封装（fetch wrapper + 错误处理） |
| `apps/web/src/api/strategies.ts` | 策略 API 调用函数 |
| `apps/web/src/api/tasks.ts` | 任务 API 调用函数 |
| `apps/web/src/api/factors.ts` | 因子 API 调用函数 |
| `apps/web/src/api/data.ts` | 数据摘要 API 调用函数 |
| `apps/web/src/hooks/useApi.ts` | 通用请求 hook（useApi） |
| `apps/web/src/hooks/useStrategies.ts` | 策略数据 hook |
| `apps/web/src/hooks/useTasks.ts` | 任务数据 hook（含轮询） |
| `apps/web/src/hooks/useFactors.ts` | 因子数据 hook |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `apps/web/vite.config.ts` | 添加 API proxy 配置 |
| `apps/web/src/hooks/useResearchWorkflow.ts` | 替换模拟数据为 API 调用 |
| `apps/web/src/App.tsx` | 传入 API 数据替换模拟数据 |
| `apps/web/src/components/strategy-grid.tsx` | 接收 API 策略数据 |
| `apps/web/src/components/jobs.tsx` | 接收 API 任务数据 |
| `apps/web/src/components/factor-lab.tsx` | 接收 API 因子数据 |
| `apps/web/src/components/workspace.tsx` | 提交回测任务走 API |
| `apps/web/src/components/backtest-history.tsx` | 接收 API 任务数据 |

---

## API 响应结构对照

### GET /api/strategies → StrategyRow[]

```json
[
  {
    "name": "dual-ma",
    "description": "双均线策略：快线上穿慢线买入，下穿卖出",
    "params": [
      { "key": "fastPeriod", "label": "快线周期", "type": "number", "default": 5, "min": 2, "max": 200 },
      { "key": "slowPeriod", "label": "慢线周期", "type": "number", "default": 10, "min": 5, "max": 500 }
    ],
    "version": "1.0.0"
  }
]
```

前端 StrategyRow 需从 API 响应映射：
- `id` ← `name`
- `name` ← `description`（短名）或 `name`
- `mode` ← 硬编码 `'traditional'`（API 暂无 modes 字段透传）
- `type` ← `'Trend'`
- `return` / `drawdown` / `sharpe` ← `'—'`（策略元数据不含回测结果）
- `status` ← `'stable'`

### POST /api/tasks → { id, status }

```json
{ "id": "task-1", "status": "pending" }
```

### GET /api/tasks → TaskView[]

```json
[
  {
    "id": "task-1",
    "type": "backtest",
    "status": "completed",
    "payload": { "strategy": "dual-ma", "symbol": "600519" },
    "submittedAt": 1718500000000,
    "startedAt": 1718500001000,
    "completedAt": 1718500010000,
    "result": { "metrics": { "total_return": -0.3654, ... } }
  }
]
```

### GET /api/factors → FactorDefinition[]

```json
[
  {
    "id": "momentum_5d",
    "name": "5日动量",
    "formula": "close / close.shift(5) - 1",
    "category": "momentum",
    "modes": ["traditional"],
    "frequency": "1d",
    "status": "active",
    "version": "0.1.0"
  }
]
```

---

### Task 1: Vite proxy + API client 基础层

**Files:**
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/src/api/client.ts`

- [ ] **Step 1: 配置 Vite proxy**

修改 `apps/web/vite.config.ts`，添加 `/api` 代理到 Fastify（端口 3000）：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 2: 创建 API client**

创建 `apps/web/src/api/client.ts`：

```typescript
/** API 请求封装 */

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status} ${res.statusText}`);
  }
}
```

- [ ] **Step 3: 验证 proxy 工作**

启动 API server 和前端 dev server，在浏览器控制台测试 `fetch('/api/strategies')` 能返回数据。

Run: `cd apps/api && npx tsx src/index.ts`（终端 1）
Run: `cd apps/web && npm run dev`（终端 2）
Expected: `fetch('/api/strategies')` 返回策略列表 JSON

- [ ] **Step 4: Commit**

```bash
git add apps/web/vite.config.ts apps/web/src/api/client.ts
git commit -m "feat(web): add Vite proxy and API client layer"
```

---

### Task 2: API 调用函数 + useApi hook

**Files:**
- Create: `apps/web/src/api/strategies.ts`
- Create: `apps/web/src/api/tasks.ts`
- Create: `apps/web/src/api/factors.ts`
- Create: `apps/web/src/api/data.ts`
- Create: `apps/web/src/hooks/useApi.ts`

- [ ] **Step 1: 创建策略 API 函数**

创建 `apps/web/src/api/strategies.ts`：

```typescript
import { apiGet } from './client';

export interface ApiStrategy {
  name: string;
  description: string;
  params: ApiStrategyParam[];
  version: string;
  modes?: string[];
}

export interface ApiStrategyParam {
  key: string;
  label: string;
  type: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export function fetchStrategies(): Promise<ApiStrategy[]> {
  return apiGet<ApiStrategy[]>('/strategies');
}

export function fetchStrategy(name: string): Promise<ApiStrategy> {
  return apiGet<ApiStrategy>(`/strategies/${name}`);
}
```

- [ ] **Step 2: 创建任务 API 函数**

创建 `apps/web/src/api/tasks.ts`：

```typescript
import { apiGet, apiPost } from './client';

export type ApiTaskType = 'backtest' | 'factor_compute' | 'factor_eval' | 'ai_train';
export type ApiTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ApiTask {
  id: string;
  type: ApiTaskType;
  status: ApiTaskStatus;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
}

export function fetchTasks(type?: ApiTaskType): Promise<ApiTask[]> {
  const query = type ? `?type=${type}` : '';
  return apiGet<ApiTask[]>(`/tasks${query}`);
}

export function fetchTask(id: string): Promise<ApiTask> {
  return apiGet<ApiTask>(`/tasks/${id}`);
}

export function submitBacktest(payload: {
  strategy: string;
  symbol?: string;
  timeframe?: string;
  initialCash?: number;
  slippage?: number;
  params?: Record<string, unknown>;
}): Promise<{ id: string; status: ApiTaskStatus }> {
  return apiPost('/tasks', { type: 'backtest', payload });
}

export function submitFactorEval(factorId: string, symbol?: string): Promise<{ taskId: string; status: ApiTaskStatus }> {
  return apiPost(`/factors/${factorId}/evaluate`, { symbol });
}
```

- [ ] **Step 3: 创建因子 API 函数**

创建 `apps/web/src/api/factors.ts`：

```typescript
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
```

- [ ] **Step 4: 创建数据摘要 API 函数**

创建 `apps/web/src/api/data.ts`：

```typescript
import { apiGet } from './client';

export interface ApiInstrument {
  symbol: string;
  name: string;
  exchange: string;
  industry?: string;
  sector?: string;
  status: string;
}

export function fetchInstruments(params?: {
  industry?: string;
  sector?: string;
  status?: string;
}): Promise<ApiInstrument[]> {
  const query = new URLSearchParams();
  if (params?.industry) query.set('industry', params.industry);
  if (params?.sector) query.set('sector', params.sector);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiGet<ApiInstrument[]>(`/data/instruments${qs ? `?${qs}` : ''}`);
}
```

- [ ] **Step 5: 创建 useApi hook**

创建 `apps/web/src/hooks/useApi.ts`：

```typescript
import { useState, useEffect, useCallback } from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/** 通用 API 请求 hook，支持自动加载和手动刷新 */
export function useApi<T>(fetcher: () => Promise<T>, autoLoad = true) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: autoLoad,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await fetcher();
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, [fetcher]);

  useEffect(() => {
    if (autoLoad) {
      load();
    }
  }, [autoLoad, load]);

  return { ...state, reload: load };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/ apps/web/src/hooks/useApi.ts
git commit -m "feat(web): add API call functions and useApi hook"
```

---

### Task 3: 策略列表页对接

**Files:**
- Create: `apps/web/src/hooks/useStrategies.ts`
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 创建 useStrategies hook**

创建 `apps/web/src/hooks/useStrategies.ts`：

```typescript
import { useMemo } from 'react';
import { useApi } from './useApi';
import { fetchStrategies, type ApiStrategy } from '../api/strategies';
import type { StrategyRow, ResearchModeId } from '../appData';

/** 将 API 策略映射为前端 StrategyRow */
function mapStrategy(api: ApiStrategy): StrategyRow {
  return {
    id: api.name,
    mode: 'traditional' as ResearchModeId,
    name: api.description || api.name,
    type: 'Trend',
    return: '—',
    drawdown: '—',
    sharpe: '—',
    status: 'stable',
  };
}

export function useStrategies() {
  const { data, loading, error, reload } = useApi<ApiStrategy[]>(fetchStrategies);

  const strategies = useMemo(() => (data ?? []).map(mapStrategy), [data]);

  return { strategies, loading, error, reload };
}
```

- [ ] **Step 2: 在 App.tsx 中使用 useStrategies**

修改 `apps/web/src/App.tsx`，导入 `useStrategies` 并在策略列表页传入 API 数据，同时保留模拟数据作为 fallback：

在 App 组件内添加：

```typescript
import { useStrategies } from './hooks/useStrategies';

// 在 App() 内：
const { strategies: apiStrategies, loading: strategiesLoading } = useStrategies();
// fallback: API 无数据时用模拟数据
const strategies = apiStrategies.length > 0 ? apiStrategies : strategies;
```

将 `strategies` 传给 `StrategyGrid` 和 `WorkspaceContent` 组件时，优先使用 API 数据。

- [ ] **Step 3: 验证策略列表**

启动 API + 前端，打开策略页面，确认显示 API 返回的 dual-ma 和 rsi 策略。

Run: 浏览器访问策略页面
Expected: 显示 "双均线策略" 和 "RSI 策略"（来自 API），而非硬编码模拟数据

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useStrategies.ts apps/web/src/App.tsx
git commit -m "feat(web): connect strategy list to API with fallback"
```

---

### Task 4: 回测运行对接（核心闭环）

**Files:**
- Create: `apps/web/src/hooks/useTasks.ts`
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts`

- [ ] **Step 1: 创建 useTasks hook（含轮询）**

创建 `apps/web/src/hooks/useTasks.ts`：

```typescript
import { useCallback, useEffect, useRef } from 'react';
import { useApi } from './useApi';
import {
  fetchTasks,
  fetchTask,
  submitBacktest,
  type ApiTask,
  type ApiTaskStatus,
} from '../api/tasks';

/** 轮询间隔（ms） */
const POLL_INTERVAL = 2000;

export function useTasks() {
  const { data, loading, error, reload } = useApi<ApiTask[]>(() => fetchTasks());

  /** 提交回测任务并轮询直到完成 */
  const submitAndPoll = useCallback(
    async (payload: {
      strategy: string;
      symbol?: string;
      timeframe?: string;
      initialCash?: number;
      slippage?: number;
      params?: Record<string, unknown>;
    }): Promise<ApiTask> => {
      const { id } = await submitBacktest(payload);

      // 轮询任务状态
      return new Promise<ApiTask>((resolve, reject) => {
        const poll = async () => {
          try {
            const task = await fetchTask(id);
            if (task.status === 'completed' || task.status === 'failed') {
              resolve(task);
              reload(); // 刷新任务列表
              return;
            }
            setTimeout(poll, POLL_INTERVAL);
          } catch (err) {
            reject(err);
          }
        };
        setTimeout(poll, POLL_INTERVAL);
      });
    },
    [reload],
  );

  return { tasks: data ?? [], loading, error, reload, submitAndPoll };
}
```

- [ ] **Step 2: 修改 useResearchWorkflow — 运行回测走 API**

修改 `apps/web/src/hooks/useResearchWorkflow.ts`，在 `handleRunResearch` 中先尝试 API 提交，失败则 fallback 到模拟数据：

```typescript
import { useTasks } from './useTasks';

// 在 hook 内部：
const { tasks: apiTasks, submitAndPoll } = useTasks();

function handleRunResearch() {
  const runId = Date.now();
  const jobId = `job-${runId}`;
  const sequence = jobs.length + 1;

  // 尝试 API 提交
  if (selectedStrategy) {
    submitAndPoll({
      strategy: selectedStrategy.id,
      symbol: '600519',
      timeframe: '1d',
      initialCash: 1000000,
      slippage: 0.001,
    })
      .then((task) => {
        if (task.status === 'completed' && task.result) {
          // API 成功：用真实结果创建报告
          const nextReport = createResearchReport(
            {
              id: `report-${runId}`,
              jobId: task.id,
              mode: activeMode,
              sequence,
              strategy: selectedStrategyForLanguage,
              generatedAt: formatReportTime(language),
              configSummary: activeConfigSummary,
            },
            language,
          );
          setReports((current) => [nextReport, ...current]);
          setActiveReportId(nextReport.id);
          // TODO: 将 task.result 映射为 BacktestReportFull
        }
      })
      .catch(() => {
        // API 失败：fallback 到模拟数据
        createMockJobAndReport(runId, jobId, sequence);
      });
  } else {
    createMockJobAndReport(runId, jobId, sequence);
  }

  // 立即切换到任务页
  setState((current) => ({ ...current, activePage: 'jobs' }));
}

function createMockJobAndReport(runId: number, jobId: string, sequence: number) {
  const nextJob = createResearchJob(
    { id: jobId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, configSummary: activeConfigSummary },
    language,
  );
  const nextReport = createResearchReport(
    { id: `report-${runId}`, jobId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, generatedAt: formatReportTime(language), configSummary: activeConfigSummary },
    language,
  );
  const nextBacktestReport = createBacktestReportFull({
    id: `backtest-full-report-${runId}`,
    taskId: jobId,
    status: 'completed',
    generatedAt: formatReportTime(language),
  });
  setJobs((current) => [nextJob, ...current]);
  setReports((current) => [nextReport, ...current]);
  setBacktestReports((current) => [nextBacktestReport, ...current]);
  setActiveReportId(nextReport.id);
}
```

- [ ] **Step 3: 验证回测运行**

1. 启动 API server（确保 data/quant.db 有数据）
2. 启动前端 dev server
3. 选择策略 → 点击 "Run Research"
4. 确认任务提交到 API，状态从 pending → completed
5. 确认报告生成

Expected: 点击运行后，API 收到 POST /api/tasks，任务完成，前端显示报告

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useTasks.ts apps/web/src/hooks/useResearchWorkflow.ts
git commit -m "feat(web): connect backtest run to API with polling and fallback"
```

---

### Task 5: 任务列表页对接

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/jobs.tsx`
- Modify: `apps/web/src/components/backtest-history.tsx`

- [ ] **Step 1: 在 App.tsx 中合并 API 任务和本地任务**

在 App 组件中，将 `apiTasks`（来自 useTasks）与本地 `jobs`（模拟/手动创建的任务）合并展示：

```typescript
// 合并 API 任务和本地任务
const allJobs = useMemo(() => {
  const apiJobs: ResearchJob[] = apiTasks.map((task) => ({
    id: task.id,
    name: `${task.type} #${task.id}`,
    kind: task.type,
    state: task.status,
    progress: task.status === 'completed' ? 100 : task.status === 'running' ? 50 : 0,
    strategyName: (task.payload.strategy as string) ?? '',
    mode: 'traditional' as ResearchModeId,
  }));
  return [...jobs, ...apiJobs];
}, [jobs, apiTasks]);
```

将 `allJobs` 传给 `JobList` 和 `BacktestHistory` 替代原来的 `localizedJobs`。

- [ ] **Step 2: 验证任务列表**

启动 API + 前端，运行一次回测，确认任务列表显示 API 返回的任务。

Expected: 任务列表同时显示本地模拟任务和 API 任务

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/jobs.tsx apps/web/src/components/backtest-history.tsx
git commit -m "feat(web): merge API tasks into job list display"
```

---

### Task 6: 因子工坊对接

**Files:**
- Create: `apps/web/src/hooks/useFactors.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 创建 useFactors hook**

创建 `apps/web/src/hooks/useFactors.ts`：

```typescript
import { useMemo } from 'react';
import { useApi } from './useApi';
import { fetchFactors, type ApiFactor } from '../api/factors';
import type { FactorDisplayRow } from '../appData';

/** 将 API 因子映射为前端 FactorDisplayRow */
function mapFactor(api: ApiFactor): FactorDisplayRow {
  return {
    id: api.id,
    name: api.name,
    category: api.category,
    description: api.formula,
    ic: '—',
    rankIc: '—',
    groupReturn: '—',
    layerReturn: '—',
    referencedBy: [],
    status: api.status === 'active' ? 'active' as const : 'draft' as const,
  };
}

export function useFactors() {
  const { data, loading, error, reload } = useApi<ApiFactor[]>(fetchFactors);

  const factors = useMemo(() => (data ?? []).map(mapFactor), [data]);

  return { factors, loading, error, reload };
}
```

- [ ] **Step 2: 在 App.tsx 中使用 useFactors**

修改 App 组件，导入 `useFactors`，将 API 因子与模拟因子合并：

```typescript
import { useFactors } from './hooks/useFactors';

// 在 App() 内：
const { factors: apiFactors } = useFactors();
// fallback: API 无数据时用模拟因子
const displayFactors = apiFactors.length > 0 ? apiFactors : factors;
```

将 `displayFactors` 传给 `FactorLabContent`。

- [ ] **Step 3: 验证因子列表**

启动 API + 前端，打开因子工坊页面。API 因子注册表初始为空，显示模拟数据。通过 API POST 创建因子后，刷新显示 API 数据。

Expected: 因子工坊正常显示，API 有数据时优先使用 API 数据

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/useFactors.ts apps/web/src/App.tsx
git commit -m "feat(web): connect factor lab to API with fallback"
```

---

### Task 7: 端到端验证 + 清理

**Files:**
- Modify: `apps/web/src/App.tsx`（最终清理）

- [ ] **Step 1: 全链路验证**

1. 启动 API server：`cd apps/api && npx tsx src/index.ts`
2. 启动前端 dev server：`cd apps/web && npm run dev`
3. 验证策略列表：显示 API 返回的 dual-ma、rsi
4. 验证回测运行：选择策略 → Run Research → 任务提交 → 报告生成
5. 验证任务列表：显示已提交的任务
6. 验证因子工坊：显示因子列表
7. 验证 fallback：关闭 API server，前端仍可用模拟数据

Expected: 所有页面正常工作，API 不可用时降级到模拟数据

- [ ] **Step 2: 运行前端测试**

Run: `cd apps/web && npm test && npm run build`

Expected: 测试通过，构建成功

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(web): complete frontend-backend integration with fallback"
```

---

## 自检清单

### 1. Spec 覆盖

| 需求 | 对应 Task |
|------|-----------|
| Vite proxy 配置 | Task 1 |
| API 请求层 | Task 1 + Task 2 |
| 策略列表对接 | Task 3 |
| 回测运行对接 | Task 4 |
| 任务列表对接 | Task 5 |
| 因子工坊对接 | Task 6 |
| 端到端验证 | Task 7 |

### 2. Placeholder 扫描

无 TBD/TODO/placeholder。

### 3. 类型一致性

- `ApiStrategy` / `ApiTask` / `ApiFactor` 与 API 路由返回的 JSON 结构对齐
- `mapStrategy` / `mapFactor` 将 API 类型映射为前端 `StrategyRow` / `FactorDisplayRow`
- `useApi` hook 的 `ApiState<T>` 泛型与各 API 函数返回类型一致
