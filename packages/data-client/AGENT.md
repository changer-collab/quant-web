# packages/data-client/AGENT.md

## 必须遵守

- 所有回复使用中文。
- data-client 只做轻量 SQLite 数据读取,不存储数据、不提供 HTTP 接口、不做数据清洗。
- data-client 是 Python 侧数据访问层,直接读取 data-collector 写入、data-center 标准化的 SQLite 文件,不调用 data-center 的 HTTP 服务。
- 接口优先稳定,避免过度抽象。
- 行情类型(Bar、Tick、TimeFrame、Instrument、MarketEvent)的所有权在 data-center(TS 层),Python 侧由 strategy-runtime re-export,data-client 消费这些类型,不重复定义。
- 更新本目录能力或进度时,同步更新本目录 `README.md` 和 `AGENT.md`,并按需同步根级文档。

## 当前阶段

```text
已实现轻量 SQLite 数据客户端:DataClient 支持 bars 查询、合约列表、活跃标的筛选
```

## 已有能力

```text
- DataClient 类(轻量 SQLite 读取器)
    query_bars(symbol, timeframe, start, end)        — 查询 K 线数据(返回 Bar 列表)
    query_bars_df(symbol, timeframe, start, end)     — 查询 K 线数据(返回 pandas DataFrame)
    list_symbols()                                    — 列出所有合约代码
    list_instruments()                                — 列出所有合约信息
    get_active_symbols(date)                          — 获取指定时间点活跃的标的列表
```

## 边界

只负责:

```text
读取 SQLite 数据库文件中的标准化行情和合约数据
提供 Python 友好的查询接口(Bar 列表、DataFrame 两种形式)
为回测引擎、AI 引擎、因子工坊、obsidian-sync 提供 Python 侧数据访问能力
```

## 不负责

```text
数据存储和 HTTP 查询接口(data-center 负责)
数据采集和清洗(data-collector 负责)
策略实现(strategies 负责)
回测撮合(backtest-engine 负责)
因子计算和评估(factor-lab 负责)
模型训练和预测(ai-engine 负责)
HTTP API(api 负责)
任务编排(worker 负责)
```

## 拥有的类型

按 AGENTS.md 类型归属原则,data-client 拥有:

```text
DataClient
```

行情类型(Bar、Tick、TimeFrame、Instrument、MarketEvent、ResearchMode)的所有权在 data-center(TS 层),Python 侧由 strategy-runtime re-export,data-client 通过依赖 quantforge-strategy 获取这些类型,不重复定义。

## 依赖

```text
quantforge-strategy  — 行情类型(Bar、TimeFrame 等,re-export 自 data-center 概念)
pandas               — DataFrame 形式的 K 线数据返回
```

运行时还需 SQLite3 标准库(随 Python 自带)。

## 被依赖方向

```text
packages/strategy-runtime → data-client(CLI 命令运行时延迟导入)
packages/ai-engine        → data-client
packages/factor-lab       → data-client
packages/obsidian-sync    → data-client(数据概览同步)
```

依赖链:

```text
data-client → strategy-runtime(行情类型)
```

## 运行约束

```text
需要 SQLite 数据库文件路径(通常由 data-collector 写入、data-center 标准化)
数据库路径通过调用方传入(如 CLI 的 dataRange.dbPath),不读取环境变量
不依赖 data-center HTTP 服务,直接读 SQLite 文件
```
