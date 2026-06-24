# apps/web

`apps/web` 是 QuantForge 当前唯一可运行的前端研究原型。

## 当前阶段

```text
前端研究原型稳定阶段，已对接真实后端（API 失败时降级到 mock）
```

已完成：

```text
React + TypeScript + Vite + CSS Modules
主导航研究流程
策略中心 / 策略研究台 / 任务中心 / 设置页
三种研究模式：传统量化 / 高频研究 / AI 量化
内存态研究闭环：运行研究 -> 任务中心 -> 报告摘要
真实回测闭环：运行研究 -> API 提交任务 -> SSE 接收进度/结果 -> mapBacktestResultToReport 映射报告
appData.ts 拆分为 accessors / factories / localization，原文件为 re-export 入口
CSS 模块化：全局 tokens + 各组件 CSS Modules
CSS 动效系统：全局 keyframes、导航逐项入场、Hero 顺序入场、按钮微交互、因子 Tab 切换过渡
CSS 视觉优化（Dark Quant Command Center）：渐变边框面板、双层径向背景光晕、设计令牌体系增强（渐变/阴影/动效曲线/z-index/圆角）、字体预加载（Fraunces 展示字体 + JetBrains Mono 代码字体）、按钮涟漪动效、图表示意重设计（渐变柱状图 + 双色线 + 脉冲标记）、卡片悬浮上浮阴影、导航激活指示器发光、模式标签底部渐变条、表格行渐变悬停、活动时间线条目位移、页面入场过渡动画
内容优化：策略数据 3→12 条、Tick 流 4→20 条、任务历史 3→8 条、因子评估 2→4 个
本地化标准化（zh.ts 术语统一）、品牌文案升级（brandTagline/heroEyebrow）
状态标签动态提取至 UiCopy，新增 localizeJobState()
指标说明（metricAnnotations）和空状态占位文案（emptyStrategies/emptyJobs/emptyFactors）
自定义 hooks：useLanguage、useResearchWorkflow
Error Boundary
前端 Mock 数据已按数据中心 6 个子域（reference / market / l2 / fundamental / event）组织
策略列表和任务名称引用 MOCK_INSTRUMENTS 标的元数据
前端测试 82 个用例（含 21 个 Mock 数据验证测试）
页面底部语境化：5 个独立底部组件（ActivityFeed / StrategyGrid / BacktestHistory / ExperimentTable / DataCoveragePanel）取代统一的策略表格
因子评估报告：13 模块专业因子报告（基本信息 / 描述性统计 / 有效性检验 / 风险分析 / 换手率与成本 / 中性化与剥离 / 分域表现 / 相关性分析 / 多因子贡献 / 经济逻辑 / 稳健性检验 / 监控指标 / 结论与建议），Tab 导航 + 可折叠 Section，KPI 卡片 / 数据表 / 横向柱状图 / 纵向分布图 / 热力图 / SVG 折线图，中英双语 Mock 数据与 UI 文案
回测报告完善：18 模块完整覆盖（10 现有增强 + 8 新增），覆盖 5 类策略框架（择股/择时/仓位管理/组合策略/策略组合）
  - 新增 8 模块：执行摘要（一页纸核心结论）/ 结论与建议（优势/风险/改进/实盘建议）/ 仓位分析（仓位管理策略核心）/ 子策略归因（组合策略归因）/ 压力测试（历史极端场景 + 蒙特卡洛）/ 成本敏感性（滑点敏感性 + 扣费前后对比）/ 基准比较表 / 风险提示与附录（不足/代码/术语表/红线检查）
  - 增强 5 模块：ReportOverview（一键结论）/ ReportRiskMetrics（VaR/CVaR/偏度峰度）/ ReportTradeStats（信号分布）/ ReportRobustness（蒙特卡洛/热力图）/ ReportAttribution（Brinson/子策略对比）
  - 默认 Tab 为执行摘要，Tab 导航 18 项
  - 类型集中在 src/data/types.ts，Mock 数据集中在 src/data/mock/report.ts，UI 文案进入 zh.ts/en.ts
  - Playwright 视觉验证通过：18 Tab + 3 分辨率（1920×1080/1366×768/768×1024）响应式验证
  - 修复 ECharts DrawdownChart 的 visualMap 配置导致的 coord undefined 运行时错误
```

暂未引入：

```text
路由
状态库
真实训练流程
```

已接入但保留 fallback：

```text
后端 API（API 失败/无数据时降级到 mock）
真实任务调度（通过 /api/tasks + SSE /api/tasks/:id/stream）
真实回测引擎（通过 Python CLI，结果经 mapBacktestResultToReport 映射）
```

## 运行

```bash
npm install
npm run dev
```

## 验证

修改前端信息架构、策略模式、任务数据、文案或组件后运行：

```bash
npm test
npm run build
npm list --depth=0
```

## 关键目录

```text
src/App.tsx             页面组合和渲染
src/hooks/              自定义 hooks（useLanguage、useResearchWorkflow）
src/appData.ts          前端数据访问 re-export 入口
src/data/               类型、accessors、factories、localization、中英文文案
src/data/mock/          按数据中心子域组织的 Mock 数据（reference / market / l2 / fundamental / event）
src/components/         展示组件（DataPanel、ErrorBoundary、factor-report 等）
src/components/factor-report/  因子评估报告 13 模块组件
src/styles/             tokens.css + 各组件 CSS Modules
tests/                  组件 / Hook / 集成 / Mock 数据验证测试
```
