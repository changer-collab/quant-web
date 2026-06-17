# apps/web

`apps/web` 是 QuantForge 当前唯一可运行的前端研究原型。

## 当前阶段

```text
前端研究原型稳定阶段
```

已完成：

```text
React + TypeScript + Vite + CSS Modules
主导航研究流程
策略中心 / 策略研究台 / 任务中心 / 设置页
三种研究模式：传统量化 / 高频研究 / AI 量化
内存态研究闭环：运行研究 -> 任务中心 -> 报告摘要
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
前端测试 81 个用例（含 21 个 Mock 数据验证测试）
页面底部语境化：5 个独立底部组件（ActivityFeed / StrategyGrid / BacktestHistory / ExperimentTable / DataCoveragePanel）取代统一的策略表格
```

暂未引入：

```text
路由
状态库
后端 API
真实任务调度
真实回测引擎
真实训练流程
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
src/components/         展示组件（DataPanel、ErrorBoundary 等）
src/styles/             tokens.css + 各组件 CSS Modules
tests/                  组件 / Hook / 集成 / Mock 数据验证测试
```
