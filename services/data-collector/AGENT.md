# services/data-collector/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 数据采集器是独立数据管道服务，不是网站后端。
- 不存储数据、不提供查询接口，数据写入数据中心。
- 不感知因子、策略、回测等上层业务逻辑。
- 依赖 `@quant/data-center`，不依赖其他业务模块。数据类型（Bar, Instrument 等）从 data-center 获取。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
数据采集器完整实现，已对接 6 个数据源（CSV / Tushare / AKShare / Baostock / efinance / yfinance），支持多源优先级回退和增量采集
```

## 已有能力

```text
- 采集层公共类型（CollectorDomain、CollectorTask、CollectorResult、CollectorConfig）
- 适配器接口（DataSourceAdapter、AdapterFetchOptions、RawDataRecord）
- 6 个数据源适配器：
  - CSV 适配器（CsvAdapter）
  - Tushare 适配器（TushareAdapter，HTTP REST API + 限流 + 指数退避重试）
  - AKShare 适配器（AkshareAdapter，Python 桥接）
  - Baostock 适配器（BaostockAdapter，Python 桥接，支持 bar/instrument/adjustment_factor/financial_report/shareholder_metrics/valuation）
  - efinance 适配器（EfinanceAdapter，Python 桥接，支持 bar/instrument/shareholder_metrics）
  - yfinance 适配器（YfinanceAdapter，Python 桥接，支持全球日K/分钟K）
- 适配器注册中心（AdapterRegistryImpl，按名称/域/类型查找）
- 数据清洗器（DataCleaner，支持 bar/tick/instrument/financial_report/adjustment_factor/calendar/announcement_event/news/shareholder_metrics）
- 采集调度器（CollectorScheduler，水位增量采集、分批写入数据中心、自动推断日期格式）
- 预设任务工厂（CollectorPresets，dailyBar/minuteBar/instruments/calendar/adjustmentFactor/financialReport/shareholderMetrics/valuation/news/initAll）
- 启动入口（createCollector，注册全部适配器）
- 数据源选择器（source-selector.ts，优先级配置 + executeWithFallback 自动回退）
- 统一导出（src/index.ts）
```

## 边界

只负责：

```text
数据源适配（从外部数据源拉取原始数据）
数据清洗（原始数据 → 标准化类型）
采集调度（任务管理、水位、增量采集）
适配器注册（多数据源适配器的注册和查找）
写入数据中心（通过 storage 层写入接口）
多源冗余回退（按数据类型优先级自动降级）
```

## 不负责

```text
数据存储（数据中心负责）
数据查询（数据中心负责）
策略、回测、AI 等业务逻辑
HTTP API
真实下单
```

## 依赖

```text
@quant/data-center   — 数据中心写入接口（Repository 层）+ 数据类型定义
```

data-collector 不依赖 @quant/common，所有数据类型从 data-center 获取。

## 被依赖方向

```text
无 — data-collector 不被任何模块依赖，它是数据中心的纯上游
```

依赖链：

```text
data-collector → data-center（独立，无 common 依赖）
```
