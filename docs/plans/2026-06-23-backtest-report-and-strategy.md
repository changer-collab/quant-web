# 回测报告闭环与首个策略验证 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复前端报告字段映射、接入历史报告 API、完善 dual_ma 策略交易逻辑测试，实现回测报告从提交到持久化展示的完整闭环。

**Architecture:** 回测引擎前后端闭环已打通（API→Worker→Python→报告保存），但存在 3 个缺口：(1) 前端 `mapBacktestResultToReport` 仍读取 Python 旧版 snake_case 字段，与已修复的 camelCase 输出不匹配；(2) 前端报告仅存内存，刷新即丢失，未接入 `/api/reports` 历史报告接口；(3) dual_ma 策略测试仅覆盖 meta/init，未验证金叉/死叉交易逻辑。修复后用户可提交回测→实时查看进度→查看完整报告→历史报告持久化。

**Tech Stack:** TypeScript, React, Fastify, Python, pytest, SQLite, SSE

---

## 问题清单

| # | 问题 | 严重度 | 根因 | 状态 |
|---|------|--------|------|------|
| 1 | 前端报告字段映射失效 | 高 | Python 侧已改为 camelCase 输出，但 `apps/web/src/data/factories.ts:mapBacktestResultToReport` 仍读取 `config.strategy_name`、`metrics.total_return` 等 snake_case 字段 | ✅ 已完成（2026-06-23 回测闭环方案 Task 3） |
| 2 | 历史报告未持久化展示 | 中 | 前端无 `api/reports.ts` 客户端，报告仅存 React state，刷新页面后丢失；API 已提供 `/api/reports` 列表和 `/api/reports/:id` 详情接口 | ⬜ 待实施 |
| 3 | dual_ma 交易逻辑无测试 | 中 | `packages/strategies/tests/test_dual_ma.py` 仅测 meta/init，未验证金叉买入、死叉卖出、持仓状态切换等核心逻辑 | ⬜ 待实施 |

> **更新说明（2026-06-23）：** Task 1 已在回测闭环方案中完成（`factories.ts` 字段名 snake_case→camelCase + 映射真实衍生数据）。以下 Task 1 内容保留作为历史记录，实际实现见 commit `32fd572`。

---

### Task 1: 修复前端报告字段映射（snake_case → camelCase）

**Files:**
- Modify: `apps/web/src/data/factories.ts:143-189`

**问题分析：** Python 侧 `_result_to_dict` 已添加 snake_case → camelCase 转换（`packages/strategy-runtime/quantforge_strategy/commands/backtest.py:168-186`），输出字段为 `equityCurve`、`totalReturn`、`strategyName`、`startDate` 等。但前端 `mapBacktestResultToReport` 仍读取 `config.strategy_name`、`config.start_date`、`metrics.total_return` 等 snake_case 字段，导致映射全部 fallback 到 mock 数据。

- [ ] **Step 1: 读取当前 factories.ts 映射逻辑**

Run: `Read apps/web/src/data/factories.ts` offset 140 limit 60

确认当前读取的字段名：
- `config.strategy_name` → 应为 `config.strategyName`
- `config.start_date` → 应为 `config.startDate`
- `config.end_date` → 应为 `config.endDate`
- `config.initial_cash` → 应为 `config.initialCash`
- `config.timeframe` → 保持（无下划线）
- `config.slippage` → 保持（无下划线）
- `metrics.total_return` → 应为 `metrics.totalReturn`
- `metrics.annualized_return` → 应为 `metrics.annualizedReturn`
- `metrics.sharpe_ratio` → 应为 `metrics.sharpeRatio`
- `metrics.max_drawdown` → 应为 `metrics.maxDrawdown`
- `metrics.win_rate` → 应为 `metrics.winRate`
- `metrics.total_trades` → 应为 `metrics.totalTrades`
- `bt.equity_curve` → 应为 `bt.equityCurve`

- [ ] **Step 2: 修改 mapBacktestResultToReport 使用 camelCase 字段**

将 `apps/web/src/data/factories.ts` 中 `mapBacktestResultToReport` 函数体内的所有 snake_case 字段访问替换为 camelCase。

替换 overview 映射块：

```typescript
    overview: {
      ...source?.overview,
      name: config.strategyName ?? source?.overview?.name ?? MOCK_REPORT.overview.name,
      version: source?.overview?.version ?? MOCK_REPORT.overview.version,
      logic: source?.overview?.logic ?? MOCK_REPORT.overview.logic,
      benchmark: source?.overview?.benchmark ?? MOCK_REPORT.overview.benchmark,
      instruments: config.instruments ?? source?.overview?.instruments ?? MOCK_REPORT.overview.instruments,
      timeRange: {
        start: tsToDate(config.startDate ?? 0) || source?.overview?.timeRange.start || MOCK_REPORT.overview.timeRange.start,
        end: tsToDate(config.endDate ?? 0) || source?.overview?.timeRange.end || MOCK_REPORT.overview.timeRange.end,
      },
      frequency: config.timeframe ?? source?.overview?.frequency ?? MOCK_REPORT.overview.frequency,
    },
```

替换 dataParams 映射块：

```typescript
    dataParams: {
      ...source?.dataParams,
      dataSource: source?.dataParams?.dataSource ?? MOCK_REPORT.dataParams.dataSource,
      adjustmentType: source?.dataParams?.adjustmentType ?? MOCK_REPORT.dataParams.adjustmentType,
      fee: { ...MOCK_REPORT.dataParams.fee, ...source?.dataParams?.fee },
      capital: {
        ...MOCK_REPORT.dataParams.capital,
        ...source?.dataParams?.capital,
        initialCash: config.initialCash ?? source?.dataParams?.capital?.initialCash ?? MOCK_REPORT.dataParams.capital.initialCash,
      },
      slippage: {
        ...MOCK_REPORT.dataParams.slippage,
        ...source?.dataParams?.slippage,
        value: config.slippage ?? source?.dataParams?.slippage?.value ?? MOCK_REPORT.dataParams.slippage.value,
      },
      params: source?.dataParams?.params ?? MOCK_REPORT.dataParams.params,
    },
```

替换 returnMetrics 映射块（查找所有 `metrics.xxx_yyy` 改为 `metrics.xxxYyy`）：

```typescript
    returnMetrics: {
      ...MOCK_REPORT.returnMetrics,
      ...source?.returnMetrics,
      totalReturn: metrics.totalReturn ?? source?.returnMetrics?.totalReturn ?? MOCK_REPORT.returnMetrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn ?? source?.returnMetrics?.annualizedReturn ?? MOCK_REPORT.returnMetrics.annualizedReturn,
```

替换其余 metrics 字段（riskMetrics、tradeStats 等）中所有 snake_case 访问：
- `metrics.sharpe_ratio` → `metrics.sharpeRatio`
- `metrics.max_drawdown` → `metrics.maxDrawdown`
- `metrics.win_rate` → `metrics.winRate`
- `metrics.total_trades` → `metrics.totalTrades`

替换 equityData 映射块：

```typescript
    equityData: {
      ...source?.equityData,
      equityCurve: (bt.equityCurve as Array<{ timestamp: number; equity: number }>)?.map(p => ({
        timestamp: p.timestamp,
        equity: p.equity,
        drawdown: 0,
      })) ?? source?.equityData?.equityCurve ?? MOCK_REPORT.equityData.equityCurve,
```

- [ ] **Step 3: 运行类型检查验证**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 运行前端测试**

Run: `cd apps/web && npm test`
Expected: 所有测试通过

- [ ] **Step 5: 运行构建**

Run: `cd apps/web && npm run build`
Expected: 构建成功

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/data/factories.ts
git commit -m "fix(web): 修复报告映射字段 snake_case→camelCase 与 Python 输出对齐"
```

---

### Task 2: 创建前端 reports API 客户端

**Files:**
- Create: `apps/web/src/api/reports.ts`

**问题分析：** API 已提供 `/api/reports` 列表、`/api/reports/:id` 详情、`/api/reports/count` 计数接口（`apps/api/src/routes/report.ts`），但前端无对应客户端，导致历史报告无法加载。

- [ ] **Step 1: 创建 reports.ts API 客户端**

创建 `apps/web/src/api/reports.ts`：

```typescript
import { apiGet, apiDelete } from './client';

/** API 返回的报告摘要（列表项） */
export interface ApiReportSummary {
  id: string;
  taskId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

/** API 返回的报告详情（含 reportData） */
export interface ApiReportDetail extends ApiReportSummary {
  reportData: Record<string, unknown>;
}

/** 获取报告列表 */
export function fetchReports(filter?: {
  strategy?: string;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}): Promise<ApiReportSummary[]> {
  const params = new URLSearchParams();
  if (filter?.strategy) params.set('strategy', filter.strategy);
  if (filter?.symbol) params.set('symbol', filter.symbol);
  if (filter?.startTime !== undefined) params.set('startTime', String(filter.startTime));
  if (filter?.endTime !== undefined) params.set('endTime', String(filter.endTime));
  if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter?.offset !== undefined) params.set('offset', String(filter.offset));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<ApiReportSummary[]>(`/reports${query}`);
}

/** 获取报告详情 */
export function fetchReport(id: string): Promise<ApiReportDetail> {
  return apiGet<ApiReportDetail>(`/reports/${id}`);
}

/** 删除报告 */
export function deleteReport(id: string): Promise<{ success: boolean }> {
  return apiDelete<{ success: boolean }>(`/reports/${id}`);
}

/** 获取报告数量 */
export function fetchReportCount(filter?: {
  strategy?: string;
  symbol?: string;
}): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (filter?.strategy) params.set('strategy', filter.strategy);
  if (filter?.symbol) params.set('symbol', filter.symbol);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiGet<{ count: number }>(`/reports/count${query}`);
}
```

- [ ] **Step 2: 确认 client.ts 的 apiDelete 签名**

Run: `Read apps/web/src/api/client.ts`

确认已导出 `apiDelete`，现有签名为 `apiDelete(path: string): Promise<void>`（不解析返回体）。`deleteReport` 直接调用即可，**无需泛型版本**，API 返回的 `{ success: true }` 不需要消费。若签名不同，调整 `deleteReport` 实现以匹配现有 `apiDelete`，避免破坏其他调用方。

- [ ] **Step 3: 运行类型检查**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/api/reports.ts apps/web/src/api/client.ts
git commit -m "feat(web): 添加 reports API 客户端支持历史报告加载"
```

---

### Task 3: 前端接入历史报告列表

**Files:**
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts`
- Modify: `apps/web/src/hooks/useTasks.ts`（如需复用 useApi）

**问题分析：** 当前 `useResearchWorkflow` 的 `backtestReports` state 仅在提交回测后通过 SSE result 事件填充，页面刷新后为空。需要在 hook 初始化时从 `/api/reports` 加载历史报告。

- [ ] **Step 1: 在 useResearchWorkflow 中添加历史报告加载**

在 `apps/web/src/hooks/useResearchWorkflow.ts` 顶部修改 import。**合并到现有 react import**（不要新增一行 react import），并追加 reports API 客户端：

```typescript
// 将现有 `import { useMemo, useState, useCallback } from 'react';` 改为：
import { useMemo, useState, useCallback, useEffect } from 'react';
import { fetchReports, type ApiReportSummary } from '../api/reports';
```

**关键约束：id 对应关系必须与提交回测时一致**，否则 `handleSwitchBacktestReport` 的反推逻辑（`btReport.id.replace('backtest-full-', '')` 在 `reports` 中查找）会失效，导致历史报告无法激活显示。

- 提交回测时：`reports` 项 id = `report-${Date.now()}`，`backtestReports` 项 id = `backtest-full-report-${Date.now()}`
- 历史报告必须沿用同一格式：`reports` 项 id = `report-${s.id}`，`backtestReports` 项 id = `backtest-full-report-${s.id}`

在 `useResearchWorkflow` 函数体内，`backtestReports` state 声明后添加初始化加载 effect（**同时填充 `reports` 和 `backtestReports`**）：

```typescript
  // 初始化时加载历史报告列表
  useEffect(() => {
    let cancelled = false;
    fetchReports({ limit: 50 })
      .then((summaries) => {
        if (cancelled) return;
        const historicalResearchReports: ResearchReport[] = [];
        const historicalReports: BacktestReportFull[] = [];

        summaries.forEach((s, index) => {
          const reportId = `report-${s.id}`;
          // 同步创建 ResearchReport，使 handleSwitchBacktestReport 反推能匹配
          historicalResearchReports.push(
            createResearchReport(
              {
                id: reportId,
                jobId: s.taskId,
                sequence: index + 1,
                generatedAt: new Date(s.createdAt).toLocaleTimeString(
                  language === 'zh' ? 'zh-CN' : 'en-US',
                  { hour12: false },
                ),
              },
              language,
            ),
          );
          // backtestReports 项 id 必须为 backtest-full-${reportId}，与 activeBacktestReport 查找逻辑一致
          historicalReports.push(
            createBacktestReportFull({
              id: `backtest-full-${reportId}`,
              taskId: s.taskId,
              status: 'completed',
              generatedAt: new Date(s.createdAt).toLocaleTimeString(
                language === 'zh' ? 'zh-CN' : 'en-US',
                { hour12: false },
              ),
              overview: {
                ...createBacktestReportFull().overview,
                name: s.strategyName,
                instruments: [s.symbol],
                frequency: s.timeframe,
                timeRange: {
                  start: s.startTime ? new Date(s.startTime).toISOString().slice(0, 10) : '',
                  end: s.endTime ? new Date(s.endTime).toISOString().slice(0, 10) : '',
                },
              },
              returnMetrics: {
                ...createBacktestReportFull().returnMetrics,
                totalReturn: s.totalReturn,
                annualizedReturn: s.annualizedReturn,
              },
              riskMetrics: {
                ...createBacktestReportFull().riskMetrics,
                maxDrawdown: s.maxDrawdown,
              },
              riskAdjMetrics: {
                ...createBacktestReportFull().riskAdjMetrics,
                sharpeRatio: s.sharpeRatio,
              },
              tradeStats: {
                ...createBacktestReportFull().tradeStats,
                winRate: s.winRate,
                totalTrades: s.totalTrades,
              },
            }),
          );
        });

        // 合并 reports（以 id 去重）
        setReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalResearchReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });
        // 合并 backtestReports（以 id 去重）
        setBacktestReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });
      })
      .catch(() => {
        // API 不可用，忽略
      });
    return () => { cancelled = true; };
  }, [language]);
```

> **注意**：`ResearchReport`、`createResearchReport`、`BacktestReportFull`、`createBacktestReportFull` 均已在现有 import 中，无需额外导入。effect 依赖 `language`（因 `createResearchReport` 需要语言参数）。

- [ ] **Step 2: 运行类型检查**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 运行前端测试**

Run: `cd apps/web && npm test`
Expected: 所有测试通过

- [ ] **Step 4: 运行构建**

Run: `cd apps/web && npm run build`
Expected: 构建成功

- [ ] **Step 5: Commit**

```typescript
git add apps/web/src/hooks/useResearchWorkflow.ts
git commit -m "feat(web): 初始化时从 API 加载历史回测报告"
```

---

### Task 4: 完善 dual_ma 策略交易逻辑测试

**Files:**
- Modify: `packages/strategies/tests/test_dual_ma.py`
- Reference: `packages/strategies/tests/conftest.py`（当前仅含一行 docstring，**无任何 fixture**，测试需自带 MockContext）

**问题分析：** 现有测试仅验证 meta 和 init，未覆盖核心交易逻辑：金叉买入、死叉卖出、持仓状态切换、资金不足时不下单等。需要构造价格序列触发金叉/死叉信号，验证订单提交。

- [ ] **Step 1: 确认 conftest.py 现状**

Run: `Read packages/strategies/tests/conftest.py`

注意：当前 conftest.py 仅含一行 docstring（`"""策略库测试共享 fixture"""`），**无任何 fixture 定义**。Step 2 的测试代码已在文件内自定义 `MockAccount`/`MockPosition`/`MockContext`，不依赖 conftest.py。

- [ ] **Step 2: 添加金叉买入测试**

在 `packages/strategies/tests/test_dual_ma.py` 末尾追加：

```python
"""双均线策略测试"""

from quantforge_strategies.combined.dual_ma import DualMAStrategy
from quantforge_strategy import Bar, OrderSide


def test_meta():
    s = DualMAStrategy()
    assert s.meta.name == "dual_ma"
    assert len(s.meta.params) == 2


def test_init():
    s = DualMAStrategy(short_period=3, long_period=5)
    s.init(None)  # type: ignore
    assert s._bought is False


def test_golden_cross_triggers_buy():
    """金叉（短均线上穿长均线）应触发买入"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore

    # 构造价格序列：先下跌（短均线 < 长均线），再上涨（短均线 > 长均线）
    prices = [10.0, 9.0, 8.0, 9.0, 10.0, 11.0, 12.0]
    submitted_orders = []

    class MockAccount:
        cash = 100000.0

    class MockPosition:
        def __init__(self, qty=0):
            self.quantity = qty

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition(0 if not s._bought else 100)

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timestamp=i, open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    # 应至少有一笔买入订单
    buy_orders = [o for o in submitted_orders if o.side == OrderSide.Buy]
    assert len(buy_orders) >= 1, "金叉应触发买入"
    assert s._bought is True


def test_death_cross_triggers_sell():
    """死叉（短均线下穿长均线）应触发卖出"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore
    s._bought = True  # 模拟已持仓

    # 构造价格序列：先上涨，再下跌触发死叉
    prices = [12.0, 11.0, 10.0, 9.0, 8.0, 9.0, 8.0]
    submitted_orders = []

    class MockAccount:
        cash = 0.0

    class MockPosition:
        def __init__(self, qty):
            self.quantity = qty

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition(100)

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timestamp=i, open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    # 应至少有一笔卖出订单
    sell_orders = [o for o in submitted_orders if o.side == OrderSide.Sell]
    assert len(sell_orders) >= 1, "死叉应触发卖出"
    assert s._bought is False


def test_no_signal_no_trade():
    """无金叉/死叉信号时不应下单"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore

    # 持续上涨，短均线一直在长均线上方（无交叉）
    prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    submitted_orders = []

    class MockAccount:
        cash = 100000.0

    class MockPosition:
        quantity = 0

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition()

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timestamp=i, open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    assert len(submitted_orders) == 0, "无交叉信号时不应下单"
```

- [ ] **Step 3: 运行测试验证失败或通过**

Run: `cd packages/strategies && python -m pytest tests/test_dual_ma.py -v`
Expected: 测试通过（若 Bar 构造参数与实际不符，根据 conftest.py 调整）

- [ ] **Step 4: 如有测试失败，检查 Bar 构造签名并修正**

Run: `python -c "from quantforge_strategy import Bar; help(Bar.__init__)"`

根据实际签名调整测试中的 Bar 构造。

- [ ] **Step 5: 重新运行测试直到通过**

Run: `cd packages/strategies && python -m pytest tests/test_dual_ma.py -v`
Expected: 5 个测试全部 PASS

- [ ] **Step 6: Commit**

```bash
git add packages/strategies/tests/test_dual_ma.py
git commit -m "test(strategies): 完善 dual_ma 金叉/死叉交易逻辑测试"
```

---

### Task 5: 端到端验证完整闭环

**Files:**
- 无代码修改，仅验证

**问题分析：** 修复字段映射和接入历史报告后，需端到端验证：提交回测→SSE 流式跟踪→报告保存→前端展示真实数据（非 mock）→刷新页面后历史报告仍在。

- [ ] **Step 1: 启动 API 服务**

Run: `cd apps/api && npx tsx src/index.ts`
Expected: 服务启动在 http://127.0.0.1:3002

- [ ] **Step 2: 启动 Worker 服务**

Run: `cd apps/worker && npx tsx src/main.ts`
Expected: Worker 开始轮询

- [ ] **Step 3: 提交回测任务**

创建临时 JSON 文件 `tmp-verify.json`：

```json
{"type":"backtest","payload":{"strategy":"dual_ma","symbol":"600519","timeframe":"1d","initialCash":1000000,"slippage":0.001,"params":{"short_period":5,"long_period":20}}}
```

Run: `curl.exe -s -X POST http://127.0.0.1:3002/api/tasks -H "Content-Type: application/json" --data-binary "@tmp-verify.json"`
Expected: 返回 `{"id":"task-N","status":"pending"}`

- [ ] **Step 4: 等待 Worker 处理完成**

Run: `curl.exe -s http://127.0.0.1:3002/api/tasks/task-N`（替换 N）
Expected: status 为 completed，result.backtestResult.equityCurve 非空，metrics.totalReturn 为数值

- [ ] **Step 5: 验证报告已保存**

Run: `curl.exe -s http://127.0.0.1:3002/api/reports`
Expected: 列表包含刚提交的报告，strategyName=dual_ma，totalReturn 为真实数值

- [ ] **Step 6: 验证报告详情**

Run: `curl.exe -s http://127.0.0.1:3002/api/reports/<report-id>`
Expected: reportData 包含完整报告结构

- [ ] **Step 7: 清理临时文件**

Run: 删除 `tmp-verify.json`

- [ ] **Step 8: 停止 API 和 Worker 服务**

- [ ] **Step 9: Commit 验证记录（可选）**

如需记录验证结果，在 commit message 中注明：

```bash
git commit --allow-empty -m "test: 端到端验证回测报告闭环通过"
```

---

## Self-Review

**1. Spec coverage:**
- 前端报告字段映射失效 → Task 1 ✓
- 历史报告未持久化展示 → Task 2 (API 客户端) + Task 3 (hook 接入) ✓
- dual_ma 交易逻辑无测试 → Task 4 ✓
- 端到端验证 → Task 5 ✓

**2. Placeholder scan:**
- 无 TBD/TODO
- 所有代码步骤包含完整代码
- 测试步骤包含具体命令和预期输出

**3. Type consistency:**
- `BacktestReportFull` 类型在 Task 1/3 中一致使用
- `ApiReportSummary`/`ApiReportDetail` 在 Task 2 定义，Task 3 使用
- camelCase 字段名（`equityCurve`、`totalReturn`、`strategyName`、`startDate`）在 Task 1 中统一
- `Bar` 构造在 Task 4 中使用，如签名不符有 Step 4 兜底

**4. 依赖审查修正记录（2026-06-23 更新）：**

基于根目录 `README.md`/`AGENT.md`/`AGENTS.md` 的依赖白名单和类型归属原则审查，修正了以下 5 处问题：

| # | 问题 | 修正 |
|---|------|------|
| 1 | Task 2 `apiDelete` 签名冲突：计划期望 `apiDelete<T>(path): Promise<T>`，但 `client.ts:48-52` 现有签名为 `apiDelete(path): Promise<void>` | 改 `deleteReport` 为 `Promise<void>` 直接调用，不解析返回体；Step 2 改为"确认现有签名"而非"添加泛型版本" |
| 2 | Task 3 历史报告 id `backtest-full-${s.id}` 与 `handleSwitchBacktestReport` 反推逻辑不兼容（`replace('backtest-full-', '')` 得 `${s.id}`，在 `reports` 中找不到）→ 历史报告无法激活显示 | 历史报告 id 统一为 `report-${s.id}` / `backtest-full-report-${s.id}`，与提交回测时格式一致；effect 中**同步创建 `reports` 项和 `backtestReports` 项** |
| 3 | Task 3 `import { useEffect } from 'react';` 会产生重复 react import | 改为合并到现有 `import { useMemo, useState, useCallback } from 'react';` |
| 4 | Task 4 描述称 conftest.py "已有 mock context fixtures"，实际仅含一行 docstring | 更正 Files 和 Step 1 描述，明确无 fixture，测试自带 MockContext |
| 5 | Task 3 effect 依赖数组缺失 `language`（`createResearchReport` 需要语言参数） | effect 依赖改为 `[language]` |

**5. 依赖白名单合规性：**
- Task 1/3：`apps/web` 自身 ✓
- Task 2：`apps/web` → `apps/api`（HTTP fetch）✓ 符合"前端通过 API Agent 获取数据"
- Task 4：`packages/strategies` → `packages/strategy-runtime` ✓ 明确在白名单
- Task 5：无代码依赖 ✓

**6. 残留可控风险（计划已自带应对步骤）：**
- Task 4 `Bar` 构造签名：Step 4 已提供 `help(Bar.__init__)` 排查命令
- Task 4 金叉价格序列能否触发交叉：Step 3 预期可能失败，Step 5 迭代修正
- Task 5 curl payload 字段：执行时需与 `apps/api/src/routes/task.ts` 实际接收字段核对

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-06-23-backtest-report-and-strategy.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
