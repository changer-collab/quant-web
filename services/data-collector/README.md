# services/data-collector

`services/data-collector` 是独立的数据管道服务，负责从外部数据源拉取原始数据、清洗标准化后写入数据中心。可独立部署，按需启停。

## 当前阶段

```text
数据采集器完整实现，已对接 6 个数据源（CSV / Tushare / AKShare / Baostock / efinance / yfinance），支持多源优先级回退和增量采集
```

## 已完成

```text
- 采集层公共类型（CollectorDomain、CollectorTask、CollectorResult、CollectorConfig）
- 适配器接口（DataSourceAdapter）+ 6 个适配器：
  - CSV 适配器（CsvAdapter）
  - Tushare 适配器（TushareAdapter，HTTP API，带限流和重试）
  - AKShare 适配器（AkshareAdapter，Python 桥接）
  - Baostock 适配器（BaostockAdapter，Python 桥接，支持 bar/instrument/adjustment_factor/financial_report/shareholder_metrics/valuation）
  - efinance 适配器（EfinanceAdapter，Python 桥接，支持 bar/instrument/shareholder_metrics）
  - yfinance 适配器（YfinanceAdapter，Python 桥接，支持全球日K/分钟K）
- 适配器注册中心（AdapterRegistryImpl）
- 数据清洗器（DataCleaner，支持 bar/tick/instrument/financial_report/adjustment_factor/calendar/announcement_event/news/shareholder_metrics）
- 采集调度器（CollectorScheduler，水位增量采集、分批写入、自动推断日期格式）
- 预设任务工厂（CollectorPresets，一键创建标准化采集任务）
- 启动入口（createCollector，注册全部适配器）
- 数据源选择器（source-selector.ts，优先级配置 + executeWithFallback 自动回退）
- 统一导出
```

## 子模块规划

| 子模块 | 目录 | 职责 |
|--------|------|------|
| 采集层公共类型 | `src/types.ts` | CollectorTask、CollectorResult、Watermark、CollectorDomain |
| 采集调度器 | `src/scheduler.ts` | 任务提交、水位管理、分批写入 |
| 数据源适配器 | `src/adapters/` | DataSourceAdapter 接口 + CSV/Tushare/AKShare/Baostock/efinance/yfinance |
| 适配器注册中心 | `src/registry/` | AdapterRegistry 接口、适配器注册/查找/列表 |
| 预设任务 | `src/presets.ts` | CollectorPresets 工厂 |
| 启动入口 | `src/bootstrap.ts` | createCollector |
| 数据源选择 | `src/source-selector.ts` | 优先级配置 + 回退执行 |

## 核心设计

- **适配器模式**：同一数据子域可有多个数据源适配器，通过配置切换；支持 Python 桥接（Baostock/efinance/yfinance/AKShare）和 HTTP 直连（Tushare）
- **水位机制**：记录每个数据源的采集水位（watermark），支持增量采集
- **幂等写入**：基于 unique key 去重，重复采集不产生重复记录
- **流式拉取**：适配器通过 AsyncIterable 逐条返回原始数据，降低内存压力
- **多源冗余**：`source-selector.ts` 按数据类型配置优先级（如 bar 优先 akshare → baostock → efinance → yfinance → tushare），自动回退
- **Python 桥接**：Baostock/efinance/yfinance/AKShare 通过子进程调用 Python 脚本，输出 JSON 到 stdout

### 数据源优先级

```text
bar:               akshare → baostock → efinance → yfinance → tushare
instrument:        akshare → baostock → efinance → tushare
adjustment_factor: baostock → akshare → tushare
financial_report:  baostock → akshare → tushare
shareholder_metrics: baostock → efinance → tushare
valuation:         baostock → tushare
calendar:          tushare
news:              akshare
```

## 依赖

```text
@quant/data-center   — 数据中心写入接口（Repository 层）+ 数据类型定义
```

data-collector 不依赖 @quant/common，所有数据类型从 data-center 获取。

## 不负责

```text
数据存储（数据中心负责）
数据查询（数据中心负责）
策略、回测、AI 等业务逻辑
HTTP API
真实下单
```

## 被依赖方向

```text
无 — data-collector 不被任何模块依赖，它是数据中心的纯上游
```

## 验证

```bash
pnpm --filter @quant/data-collector build
pnpm --filter @quant/data-collector test
```

## 外部依赖

数据采集依赖本地 Python 环境安装对应库：

```bash
pip install akshare baostock efinance yfinance
```

Tushare 需通过 `extra.token` 传入 Pro API token。