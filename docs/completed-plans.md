# 已完成计划索引

> 以下计划已全部实施完成，详细信息已沉淀到代码中。

| 日期 | 计划 | 涉及模块 |
|------|------|----------|
| 2026-06-16 | 因子评估报告优化 | factor-lab, web |
| 2026-06-16 | Python 引擎重塑 | backtest-engine, strategy-runtime, ai-engine, data-client |
| 2026-06-16 | 策略运行时流式输出 | strategy-runtime CLI, worker/python-bridge, API SSE, web EventSource |
| 2026-06-17 | 因子报告视觉优化（中性化表格对齐 + 相关性图谱） | web/factor-report |
| 2026-06-17 | 因子报告视觉优化 V2（族群回退表格 + 中性化卡片） | web/factor-report |
| 2026-06-17 | 策略分层解耦（选股/择时/仓位管理） | strategy-runtime, backtest-engine, strategies |
| 2026-06-18 | 回测报告完善 | web/report |
| 2026-06-18 | 前后端对接 | web/api, worker, API SSE |
| 2026-06-22 | 后端完善（回测报告与因子评估持久化） | api/report-repo, api/eval-repo, api/report-mapper |
| 2026-06-22 | 策略开发就绪（策略同步/数据导入/Worker 扩展/类型匹配） | api/strategy-sync, data-center/import-data, worker/main, api/task-service |
| 2026-06-23 | 回测单次闭环打通（equity_stats/CLI 衍生统计/obsidian-sync/前端字段修复） | backtest-engine/equity_stats, strategy-runtime/cli, web/factories |
