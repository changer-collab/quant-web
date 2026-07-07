# services/data-collector

`services/data-collector` 是独立的数据管道服务，负责从外部数据源拉取原始数据、清洗标准化后写入数据中心。可独立部署，按需启停。

## 当前阶段

```text
数据采集器完整实现，已对接 17 个数据源适配器（9 个独立源 + 8 个东财子源），支持多源优先级回退和增量采集
```

## 已完成

```text
- 采集层公共类型（CollectorDomain、CollectorTask、CollectorResult、CollectorConfig）
- 适配器接口（DataSourceAdapter）+ 17 个适配器：
  - CSV 适配器（CsvAdapter）
  - Tushare 适配器（TushareAdapter，HTTP API，带限流和重试）
  - AKShare 适配器（AkshareAdapter，Python 桥接）
  - Baostock 适配器（BaostockAdapter，Python 桥接，支持 bar/instrument/adjustment_factor/financial_report/shareholder_metrics/valuation）
  - efinance 适配器（EfinanceAdapter，Python 桥接，支持 bar/instrument/shareholder_metrics）
  - yfinance 适配器（YfinanceAdapter，Python 桥接，支持全球日K/分钟K）
  - mootdx 适配器（MootdxAdapter，Python 桥接，TCP 直连通达信行情服务器，支持 bar/trade_record/l2_snapshot/f10；默认不启用，需在 createCollector({sources:[...]}) 显式开启）
  - tencent 适配器（TencentAdapter，HTTP 直连腾讯财经，提供 PE(TTM)/PB/总市值/流通市值/换手率/5日均量/量比/委差/涨停跌停等实时估值；默认不启用，需在 createCollector({sources:[...]}) 显式开启）
  - Parquet 适配器（ParquetAdapter，Python + pyarrow 桥接，流式读取本地 parquet 文件，支持 bar/tick/trade_record/order_record/l2_snapshot；默认不启用，需显式开启）
  - 东财统一 HTTP 客户端（emClient 单例 + EastMoneyBaseAdapter 抽象基类，串行队列 + ≥1s 限流 + 429/5xx 重试 + 会话复用）
  - 东财龙虎榜适配器（DragonTigerAdapter，RPT_DAILYBILLBOARD_DETAILS）
  - 东财限售解禁适配器（LockupAdapter，RPT_SHARE_FLOATING_NPL）
  - 东财融资融券适配器（MarginAdapter，RPTA_WEB_RZRQ_GGMX）
  - 东财大宗交易适配器（BlockTradeAdapter，RPT_BLOCKTRADE_DETAIL）
  - 东财分红送转适配器（DividendAdapter，RPT_SHAREBONUS_DET）
  - 东财研报适配器（ResearchReportAdapter，reportapi.eastmoney.com）
  - 东财热门股适配器（HotStocksAdapter，push2 API）
  - 东财北向资金适配器（NorthboundFlowAdapter，push2his kamnt.kline）
- 适配器注册中心（AdapterRegistryImpl）
- 数据清洗器（DataCleaner，支持 bar/tick/instrument/financial_report/adjustment_factor/calendar/announcement_event/news/shareholder_metrics/trade_record/l2_snapshot）
- 采集调度器（CollectorScheduler，水位增量采集、分批写入、自动推断日期格式；writeToDataCenter 支持 13 类数据：bar/tick/instrument/financial_report/adjustment_factor/calendar/announcement_event/news/shareholder_metrics/valuation/trade_record/l2_snapshot/external）
- 预设任务工厂（CollectorPresets，一键创建标准化采集任务）
- 启动入口（createCollector，注册全部适配器；默认启用 6 个：csv/tushare/akshare/baostock/efinance/yfinance，mootdx/tencent/parquet/东财 8 个需显式启用）
- 数据源选择器（source-selector.ts，优先级配置 + executeWithFallback 自动回退）
- 统一导出
```

## 子模块规划

| 子模块         | 目录                     | 职责                                                                    |
| -------------- | ------------------------ | ----------------------------------------------------------------------- |
| 采集层公共类型 | `src/types.ts`           | CollectorTask、CollectorResult、Watermark、CollectorDomain              |
| 采集调度器     | `src/scheduler.ts`       | 任务提交、水位管理、分批写入                                            |
| 数据源适配器   | `src/adapters/`          | DataSourceAdapter 接口 + CSV/Tushare/AKShare/Baostock/efinance/yfinance/mootdx/tencent/parquet + eastmoney/ 子目录（8 个东财适配器 + emClient） |
| 适配器注册中心 | `src/registry/`          | AdapterRegistry 接口、适配器注册/查找/列表                              |
| 预设任务       | `src/presets.ts`         | CollectorPresets 工厂                                                   |
| 启动入口       | `src/bootstrap.ts`       | createCollector                                                         |
| 数据源选择     | `src/source-selector.ts` | 优先级配置 + 回退执行                                                   |

## 核心设计

- **适配器模式**：同一数据子域可有多个数据源适配器，通过配置切换；支持 Python 桥接（Baostock/efinance/yfinance/AKShare/mootdx）和 HTTP 直连（Tushare/tencent）
- **水位机制**：记录每个数据源的采集水位（watermark），支持增量采集
- **幂等写入**：基于 unique key 去重，重复采集不产生重复记录
- **流式拉取**：适配器通过 AsyncIterable 逐条返回原始数据，降低内存压力
- **多源冗余**：`source-selector.ts` 按数据类型配置优先级（如 bar 优先 mootdx → akshare → baostock → efinance → yfinance → tushare），自动回退
- **Python 桥接**：Baostock/efinance/yfinance/AKShare/mootdx 通过子进程调用 Python 脚本，输出 JSON 到 stdout

### 数据源优先级

```text
bar:                 mootdx → akshare → baostock → efinance → yfinance → tushare
tick:                tushare
trade_record:        mootdx
l2_snapshot:         mootdx
f10:                 mootdx
instrument:          akshare → baostock → efinance → tushare
adjustment_factor:   baostock → akshare → tushare
financial_report:    baostock → akshare → tushare
shareholder_metrics: baostock → efinance → tushare
valuation:           baostock → tushare → tencent
calendar:            tushare
news:                akshare
dragon_tiger:        eastmoney_dragon_tiger
lockup:              eastmoney_lockup
margin:              eastmoney_margin
block_trade:         eastmoney_block_trade
dividend:            eastmoney_dividend
research_report:     eastmoney_research
hot_stocks:          eastmoney_hot_stocks
northbound_flow:     eastmoney_northbound
```

> 注：东财 8 个适配器全部复用 `emClient` 单例（串行队列 + ≥1s 限流 + 429/5xx 重试 + 会话复用），默认不启用，需在 `createCollector({sources:[...]})` 显式开启。

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
pip install akshare baostock efinance yfinance mootdx pyarrow
```

Tushare 需通过 `extra.token` 传入 Pro API token。
tencent 适配器走 HTTP 直连，无需 Python 依赖。
东财 8 个适配器走 HTTP 直连 `emClient`，无需 Python 依赖。
ParquetAdapter 需 `pyarrow`（v24+），通过 `ParquetFile.iter_batches()` 流式读取。
