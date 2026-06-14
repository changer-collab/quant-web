# Task 3: API HTTP 入口实施计划

## 目标

为 `apps/api` 实现 Fastify HTTP 入口，提供策略查询、任务提交/查询、因子 CRUD、数据摘要等接口。API 层保持薄，不承载业务计算逻辑。

## 依赖关系

```
apps/api -> @quant/common
apps/api -> @quant/data-center
apps/api -> @quant/strategies
```

API 不直接依赖 `@quant/backtest-engine`、`@quant/ai-engine`、`@quant/factor-lab`。回测、因子计算等通过 Worker 任务队列间接触发。

## 文件结构

```
apps/api/
├── src/
│   ├── index.ts              # 启动入口
│   ├── app.ts                # Fastify 应用组装
│   ├── routes/
│   │   ├── strategy.ts       # 策略路由
│   │   ├── task.ts           # 任务路由
│   │   ├── factor.ts         # 因子路由
│   │   └── data.ts           # 数据摘要路由
│   └── plugins/
│       └── data-center.ts    # DataCenter 装饰器插件
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 实施步骤

### Step 1: 项目基础设施

**修改 `package.json`**：

```json
{
  "name": "@quant/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "vitest run",
    "lint": "exit 0"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@quant/common": "workspace:*",
    "@quant/data-center": "workspace:*",
    "@quant/strategies": "workspace:*"
  },
  "devDependencies": {
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0"
  }
}
```

**修改 `tsconfig.json`**：继承根配置，设置 `outDir` 和 `rootDir`。

### Step 2: Fastify 应用组装

**`src/app.ts`**：

```typescript
import Fastify from 'fastify';
import { strategyRoutes } from './routes/strategy.js';
import { taskRoutes } from './routes/task.js';
import { factorRoutes } from './routes/factor.js';
import { dataRoutes } from './routes/data.js';
import { dataCenterPlugin } from './plugins/data-center.js';

export async function buildApp(options?: { dataCenter?: DataCenter }) {
  const app = Fastify({ logger: true });

  // 注册 DataCenter 插件
  await app.register(dataCenterPlugin, { dataCenter: options?.dataCenter });

  // 注册路由
  await app.register(strategyRoutes, { prefix: '/api/strategies' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(factorRoutes, { prefix: '/api/factors' });
  await app.register(dataRoutes, { prefix: '/api/data' });

  return app;
}
```

**`src/index.ts`**：

```typescript
import { buildApp } from './app.js';
import { createDataCenter } from '@quant/data-center';

const dataCenter = await createDataCenter({ storageType: 'sqlite' });
const app = await buildApp({ dataCenter });

await app.listen({ port: 3000, host: '0.0.0.0' });
```

### Step 3: DataCenter 插件

**`src/plugins/data-center.ts`**：

```typescript
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';
import type { DataCenter } from '@quant/data-center';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    dataCenter: DataCenter;
  }
}

export const dataCenterPlugin: FastifyPluginCallback<{ dataCenter?: DataCenter }> = fp(
  async (app, options) => {
    const dc = options.dataCenter ?? await createDefaultDataCenter();
    app.decorate('dataCenter', dc);
  }
);
```

### Step 4: 策略路由

**`src/routes/strategy.ts`**：

```
GET    /           -> 列出所有策略
GET    /:name      -> 获取策略详情（参数定义、默认值）
```

策略数据来自 `@quant/strategies`，API 只做 HTTP 入口和参数格式化。

```typescript
import { DualMAStrategy, RSIStrategy } from '@quant/strategies';
import type { FastifyInstance } from 'fastify';

const BUILTIN_STRATEGIES = [DualMAStrategy, RSIStrategy];

export async function strategyRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return BUILTIN_STRATEGIES.map(s => ({
      name: s.name,
      description: s.description,
      params: s.paramDefs,
    }));
  });

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const strategy = BUILTIN_STRATEGIES.find(s => s.name === req.params.name);
    if (!strategy) return reply.code(404).send({ error: 'Strategy not found' });
    return strategy;
  });
}
```

### Step 5: 任务路由

**`src/routes/task.ts`**：

```
POST   /           -> 提交任务（回测/训练/因子计算/因子评估）
GET    /           -> 查询任务列表
GET    /:id        -> 查询单个任务状态和结果
```

当前阶段任务提交写入内存队列（与 Worker 共享），后续可替换为 Redis 队列。

```typescript
import { TaskType, TaskStatus } from '@quant/common';
import type { FastifyInstance } from 'fastify';

// 内存任务存储（与 Worker 共享）
export const taskStore = new Map<string, TaskRecord>();

export async function taskRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const { type, payload } = req.body as { type: TaskType; payload: Record<string, unknown> };
    // 创建任务记录，写入 taskStore
    // 返回 202 + 任务 ID
    return reply.code(202).send({ id, status: TaskStatus.Pending });
  });

  app.get('/', async () => {
    return Array.from(taskStore.values());
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const task = taskStore.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
  });
}
```

### Step 6: 因子路由

**`src/routes/factor.ts`**：

```
GET    /                -> 列出因子定义
POST   /                -> 创建因子定义
GET    /:id             -> 获取因子详情
PUT    /:id             -> 更新因子定义
DELETE /:id             -> 删除因子定义
POST   /:id/evaluate    -> 触发因子评估（提交到任务队列）
POST   /compute         -> 触发因子批量计算（提交到任务队列）
```

因子 CRUD 只做 HTTP 入口，数据存储在 DataCenter 或内存注册表。因子计算和评估通过任务队列委托给 Worker。

```typescript
import { FactorStatus } from '@quant/common';
import type { FastifyInstance } from 'fastify';

// 内存因子注册表（后续迁移到 DataCenter）
export const factorStore = new Map<string, FactorDefinition>();

export async function factorRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return Array.from(factorStore.values());
  });

  app.post('/', async (req, reply) => {
    const definition = req.body as FactorDefinition;
    factorStore.set(definition.id, definition);
    return reply.code(201).send(definition);
  });

  app.post<{ Params: { id: string } }>('/:id/evaluate', async (req, reply) => {
    // 提交因子评估任务到 taskStore
    return reply.code(202).send({ taskId, status: TaskStatus.Pending });
  });

  app.post('/compute', async (req, reply) => {
    // 提交因子批量计算任务到 taskStore
    return reply.code(202).send({ taskId, status: TaskStatus.Pending });
  });
}
```

### Step 7: 数据摘要路由

**`src/routes/data.ts`**：

```
GET    /instruments       -> 查询标的列表
GET    /bars              -> 查询 K 线数据（分页）
GET    /coverage          -> 查询数据覆盖率
GET    /quality           -> 查询数据质量报告
```

数据查询委托给 DataCenter Provider。

```typescript
export async function dataRoutes(app: FastifyInstance) {
  app.get('/instruments', async (req) => {
    const { symbols, status } = req.query as { symbols?: string; status?: string };
    return app.dataCenter.reference.queryInstruments({ symbols, status });
  });

  app.get('/bars', async (req) => {
    const { symbol, timeframe, start, end, limit } = req.query;
    return app.dataCenter.market.queryBars({ symbol, timeframe, start, end, limit });
  });

  app.get('/coverage', async () => {
    return app.dataCenter.quality.checkCoverage();
  });

  app.get('/quality', async () => {
    return app.dataCenter.quality.generateReport();
  });
}
```

## 测试计划

### 单元测试

| 测试文件 | 覆盖内容 |
|---------|---------|
| `__tests__/app.test.ts` | 应用启动、插件注册、路由挂载 |
| `__tests__/routes/strategy.test.ts` | 策略列表、策略详情、404 |
| `__tests__/routes/task.test.ts` | 任务提交、任务查询、任务状态 |
| `__tests__/routes/factor.test.ts` | 因子 CRUD、评估触发、计算触发 |
| `__tests__/routes/data.test.ts` | 标的查询、K 线查询、覆盖率、质量 |

### 测试策略

- 使用 `fastify.inject()` 做请求注入测试，不启动真实 HTTP 服务
- DataCenter 用内存 SQLite 实例或 mock
- 每个路由测试覆盖：正常响应、参数校验、404、错误处理

### 关键测试用例

```typescript
// strategy.test.ts
test('GET /api/strategies 返回策略列表', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/strategies' });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toBeArray();
  expect(res.json()[0]).toHaveProperty('name');
});

// task.test.ts
test('POST /api/tasks 提交回测任务返回 202', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/tasks',
    payload: { type: 'backtest', payload: { strategyName: 'dual-ma' } },
  });
  expect(res.statusCode).toBe(202);
  expect(res.json()).toHaveProperty('id');
  expect(res.json().status).toBe('pending');
});

// factor.test.ts
test('POST /api/factors 创建因子定义返回 201', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/factors',
    payload: { id: 'ma5', name: 'MA5', formula: 'ma(close,5)', ... },
  });
  expect(res.statusCode).toBe(201);
});
```

## 验证标准

1. `npm test` 全部通过
2. `npm run build` 无类型错误
3. `npm run dev` 可启动，`curl http://localhost:3000/api/strategies` 返回策略列表
4. 所有路由有对应测试覆盖
5. API 层不含回测计算、因子计算、模型训练逻辑
