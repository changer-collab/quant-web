# packages/obsidian-sync/AGENT.md

## 必须遵守

- 所有回复使用中文。
- obsidian-sync 只做策略、回测结果、因子定义与评估、数据概览到 Obsidian vault 的同步,不实现业务算法。
- 接口优先稳定,避免过度抽象。
- 通过 Obsidian Local REST API 与 vault 通信,不直接读写本地文件系统。
- 笔记构建器只做 Markdown 内容组装,不调用业务引擎。
- 更新本目录能力或进度时,同步更新本目录 `README.md` 和 `AGENT.md`,并按需同步根级文档。

## 当前阶段

```text
已实现核心同步逻辑:SyncService 支持 sync_all / sync_strategy / sync_backtest_result / sync_factor / sync_data_overview
```

## 已有能力

```text
- SyncService 类(sync_all / sync_strategy / sync_backtest_result / sync_factor / sync_data_overview)
- ObsidianClient 类(get_note / put_note / list_dir),_encode_path 路径编码工具
- 笔记构建器(builders/):
    strategy.py  — build_strategy_overview / build_strategy_note
    backtest.py  — build_backtest_overview / build_backtest_report
    factor.py    — build_factor_overview / build_factor_note
    dashboard.py — build_dashboard
    data.py      — build_data_overview / build_instrument_list
- 通过 Obsidian Local REST API 与 vault 通信(默认 http://localhost:27123)
```

## 边界

只负责:

```text
将策略元数据、回测结果、因子定义与评估、数据概览同步到 Obsidian vault
构建 Obsidian 笔记 Markdown 内容
通过 ObsidianClient 与 Local REST API 通信
```

## 不负责

```text
策略实现(strategies 负责)
回测撮合(backtest-engine 负责)
因子计算和评估(factor-lab 负责)
模型训练和预测(ai-engine 负责)
数据存储和查询(data-center 负责)
HTTP API(api 负责)
任务编排(worker 负责)
```

## 拥有的类型

按 AGENTS.md 类型归属原则,obsidian-sync 拥有:

```text
SyncService, ObsidianClient, _safe_put, _encode_path,
build_strategy_overview, build_strategy_note,
build_backtest_overview, build_backtest_report,
build_factor_overview, build_factor_note,
build_dashboard,
build_data_overview, build_instrument_list
```

其他模块通过合法依赖链获取这些类型,不重复定义。

## 依赖

```text
quantforge-strategy  — 策略运行时类型(StrategyMeta、StrategyResult 等)
quantforge-backtest  — 回测结果类型(BacktestResult、BacktestMetrics 等)
quantforge-factor    — 因子定义与评估类型(FactorDefinition、FactorEvaluationResult 等)
quantforge-data      — 数据客户端(DataClient,用于查询数据概览)
httpx                — HTTP 客户端(调用 Obsidian Local REST API)
```

## 被依赖方向

```text
无下游 quantforge-* 包依赖(obsidian-sync 是末端消费方)
```

依赖链:

```text
obsidian-sync → strategy-runtime / backtest-engine / factor-lab / data-client
```

obsidian-sync 作为库被 Worker 编排调用,或通过 CLI 单次触发,不直接暴露 HTTP。

## 运行约束

```text
需要 Obsidian Local REST API 插件运行(默认 http://localhost:27123)
环境变量 OBSIDIAN_API_URL   — 配置 REST API 服务地址
环境变量 OBSIDIAN_API_TOKEN — 配置访问令牌(插件生成)
环境变量 OBSIDIAN_VAULT     — 配置目标 vault 名称(可选)
```
