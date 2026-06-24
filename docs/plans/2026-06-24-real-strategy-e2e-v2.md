# 真实策略端到端验证 (v2 修正版)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用真实A股数据跑通5个策略的完整回测->报告->前端展示链路。

**Architecture:** 分四阶段：(0) 修复已知问题; (1) 数据检查; (2) Python直接回测验证; (3) Worker+API全链路验证; (4) 前端展示验证。

**Tech Stack:** Python (baostock), TypeScript (vitest, Node.js)

---

## v1 -> v2 修正清单

| # | 问题                          | 修正              |
| - | ----------------------------- | ----------------- |
| 1 | API入口文件写成 src/server.ts | 改为 src/index.ts |
| 2 | 多处端口写3000，实际监听3002  | 全部改为300       |
| 3 | data/quant.db 实际已存在      | 更新问题分析      |
| 4 | 缺少Worker启动步骤            | Phase 3新增       |
| 5 | report-mapper数据丢失         | 新增Task 0.1      |
| 6 | commit data/quant.db          | gitignore db文件  |
| 7 | 前端proxy验证缺失             | 补充              |
| 8 | 工作目录依赖未说明            | 补充              |

---

## 关键事实

- API监听端口 **3002** (apps/api/src/index.ts: `await app.listen({ port: 3002 })`)
- API入口是 **src/index.ts** (非 server.ts)
- Worker独立进程，默认轮询 `http://127.0.0.1:3002`
- 前端vite proxy指向 `http://localhost:3002` (apps/web/vite.config.ts)
- PythonBridge用 `findProjectRoot()` 定位 `data/quant.db`
- data/quant.db 已存在，包含10个标的日K线数据

---

## 前置: Task 0.1 修复report-mapper数据丢失

**Files:** Modify `apps/api/src/services/report-mapper.ts`

Python返回的 drawdownCurve/monthlyReturns/annualReturns 已转camelCase，但mapper没读取。

- [ ] **Step 1:** 在 report-mapper.ts 的 equityData 中，将空数组改为从result读取：

```typescript
// 将 monthlyReturns: [], annualReturns: [], drawdownSeries: [] 改为:
monthlyReturns: Array.isArray((result as any).monthlyReturns)
  ? (result as any).monthlyReturns : [],
annualReturns: Array.isArray((result as any).annualReturns)
  ? (result as any).annualReturns : [],
drawdownSeries: Array.isArray((result as any).drawdownCurve)
  ? (result as any).drawdownCurve : [],
```

- [ ] **Step 2:** Commit

## 前置: Task 0.2 gitignore修复

- [ ] **Step 1:** 修改 .gitignore: 将 `data/` 改为 `data/*.db` + `data/*.db-journal` + `data/*.db-wal`
- [ ] **Step 2:** 确保 data/.gitkeep 存在
- [ ] **Step 3:** Commit

---

## Phase 1: Task 1.1 数据检查

- [ ] **Step 1:** 验证数据库: `python -c "import sqlite3; conn=sqlite3.connect('data/quant.db'); print(conn.execute('SELECT COUNT(*) FROM bars').fetchone()[0]); print(conn.execute('SELECT DISTINCT symbol FROM bars').fetchall())"`
- [ ] **Step 2:** 如果数据不足，运行 `npx tsx scripts/seed-data.ts`
- [ ] **Step 3:** 确保Python依赖: `pip install baostock`

---

## Phase 2: Task 2.1 单策略回测验证

- [ ] **Step 1:** 调用Python CLI:

```bash
cd d:\quant-web
echo '{"command":"backtest","strategy":"dual_ma","config":{"initialCash":1000000,"slippage":0.001},"dataRange":{"dbPath":"data/quant.db","symbol":"600519","timeframe":"1d"}}' | python -m quantforge_strategy
```

- [ ] **Step 2:** 验证输出为camelCase字段名
- [ ] **Step 3:** 验证drawdownCurve/monthlyReturns/annualReturns存在

## Task 2.2 全5策略验证

- [ ] 依次回测 rsi, bollinger_band, macd, kdj，每个验证 totalTrades > 0
- [ ] 运行 scripts/compare_strategies.py 汇总对比

---

## Phase 3: Task 3.1 PythonBridge验证

- [ ] **Step 1:** 运行e2e测试: `cd apps/worker && npx vitest run tests/e2e-pipeline.test.ts`
- [ ] **Step 2:** 如果跳过，手动验证:

```bash
cd d:\quant-web\apps\worker
npx tsx -e "
import { PythonBridge } from './src/python-bridge.js';
const bridge = new PythonBridge({ timeout: 60000 });
const result = await bridge.call({
  command: 'backtest', strategy: 'dual_ma',
  config: { initialCash: 1000000, slippage: 0.001 },
  dataRange: { dbPath: 'data/quant.db', symbol: '600519', timeframe: '1d' },
});
console.log('ok:', result.ok);
console.log('metrics:', JSON.stringify(result.data?.metrics, null, 2));
console.log('equityCurve length:', result.data?.equityCurve?.length);
"
```

## Task 3.2 API端到端验证（v2修正）

- [ ] **Step 1:** 启动API服务（**修正: 入口是index.ts，端口3002**）:

```bash
cd d:\quant-web\apps\api && npx tsx src/index.ts
```

Expected: API服务启动在 http://127.0.0.1:3002

- [ ] **Step 2:** 启动Worker（**v2新增: Worker是独立进程**）:

```bash
cd d:\quant-web\apps\worker && npx tsx src/main.ts
```

Expected: Worker启动并开始轮询API

- [ ] **Step 3:** 提交回测任务（**修正: 端口3002**）:

```bash
curl -X POST http://127.0.0.1:3002/api/tasks -H "Content-Type: application/json" -d "{\"type\":\"backtest\",\"payload\":{\"strategy\":\"dual_ma\",\"symbol\":\"600519\",\"timeframe\":\"1d\",\"initialCash\":1000000,\"slippage\":0.001}}"
```

- [ ] **Step 4:** 等待任务完成后查询报告:

```bash
timeout 5 && curl http://127.0.0.1:3002/api/reports
```

---

## Phase 4: Task 4.1 前端构建验证

- [ ] **Step 1:** 构建前端: `cd apps/web && npm run build`
- [ ] **Step 2:** 运行前端测试: `cd apps/web && npx vitest run`

## Task 4.2 前端冒烟测试

- [ ] **Step 1:** 启动前端: `cd apps/web && npm run dev`
- [ ] **Step 2:** 确认vite proxy已配置指向3002（无需修改）
- [ ] **Step 3:** 浏览器验证页面

---

## 实现顺序

```
Task 0.1 (report-mapper修复) -> Task 0.2 (gitignore修复)
  -> Task 1.1 (数据检查)
    -> Task 2.1 (单策略验证) -> Task 2.2 (全策略对比)
      -> Task 3.1 (PythonBridge) -> Task 3.2 (Worker+API)
        -> Task 4.1 (构建) -> Task 4.2 (冒烟测试)
```

## 注意事项

1. 所有命令从项目根目录 d:\quant-web 执行
2. data/quant.db 已存在，Phase 1可能不需要seed
3. API和Worker都使用 findProjectRoot() 定位数据库，从子目录启动可能失败
4. 前端vite proxy已配置指向3002，无需额外配置
5. 增强方案(mootdx/腾讯适配器)不影响本方案的回测验证逻辑
6. mootdx 走 TCP 直连通达信服务器，需要国内网络。海外环境可跳过 mootdx 相关步骤，baostock 作为 fallback。
7. 腾讯估值数据是实时快照（当前时刻），不是历史序列。如需历史估值，需定期采集积累。
8. seed-data 新增了复权因子、财务报告和估值数据采集，总耗时约 3-5 分钟（取决于网络）。
9. data/ 目录已通过 .gitkeep 保留，数据库文件通过 .gitignore 排除。新开发者需运行 seed-data 获取本地数据。
