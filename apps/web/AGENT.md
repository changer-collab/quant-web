# apps/web/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 当前目录只负责前端研究原型。
- 不引入后端、路由、状态库，除非用户明确要求。
- 不把静态卡片全部做成按钮，交互必须服务真实研究动作。
- 新增 UI 文案必须进入 `src/data/en.ts`、`src/data/zh.ts` 或 `UiCopy`，组件不硬编码固定语言文案。
- `CSI 500`、`XGBoost`、`Level1` 等专有名词可以保留原样。
- 修改信息架构、策略模式、任务数据、文案或组件后必须运行验证命令。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。
- **不使用模拟数据（mock data）。** 所有数据必须来自真实后端 API。API 返回空数组时展示空状态，不降级到 mock。

## 当前阶段

```text
前端研究原型稳定阶段，已对接真实后端
已支持模式化默认配置：传统量化 / 高频研究 / AI 量化
已支持真实回测闭环：运行研究 -> API 提交任务 -> SSE 接收进度/结果 -> 查看统一报告摘要和运行配置诊断
已提取自定义 hooks：useLanguage、useResearchWorkflow
useResearchWorkflow 已使用 mapBacktestResultToReport 将 Python BacktestResult 映射为 BacktestReportFull
appData.ts 已拆分为 accessors / factories / localization，原文件保留为 re-export 入口
CSS 已模块化：全局 tokens + 各组件 CSS Modules
CSS 动效系统已集成（全局 keyframes、导航/ Hero/按钮/因子 Tab 动画）
页面底部已语境化：Dashboard 活动时间线、策略中心卡片矩阵、回测记录、实验对比表、数据中心覆盖面板，取代统一的策略表格
Error Boundary 已集成
因子评估报告已完成：13 模块专业因子报告（基本信息 / 描述性统计 / 有效性检验 / 风险分析 / 换手率与成本 / 中性化与剥离 / 分域表现 / 相关性分析 / 多因子贡献 / 经济逻辑 / 稳健性检验 / 监控指标 / 结论与建议），Tab 导航 + 可折叠 Section，KPI 卡片 / 数据表 / 横向柱状图 / 纵向分布图 / 热力图 / SVG 折线图，中英双语 UI 文案
回测报告完善已完成：18 模块完整覆盖（10 现有增强 + 8 新增），覆盖 5 类策略框架（择股/择时/仓位管理/组合策略/策略组合）
  - 新增 8 模块：执行摘要 / 结论与建议 / 仓位分析 / 子策略归因 / 压力测试 / 成本敏感性 / 基准比较 / 风险提示与附录
  - 增强 5 模块：ReportOverview / ReportRiskMetrics（VaR/CVaR/偏度峰度）/ ReportTradeStats / ReportRobustness（蒙特卡洛/热力图）/ ReportAttribution（Brinson/子策略对比）
  - 默认 Tab 为执行摘要，Tab 导航 18 项
  - 类型集中在 src/data/types.ts，UI 文案进入 zh.ts/en.ts
  - Playwright 视觉验证通过：18 Tab + 3 分辨率响应式验证
  - 修复 ECharts DrawdownChart 的 visualMap 配置导致的 coord undefined 运行时错误
```

## 验证命令

```bash
npm test
npm run build
npm list --depth=0
```

## 边界

当前不做：

```text
真实下单
券商连接
权限系统
策略市场
```
