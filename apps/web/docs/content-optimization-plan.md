# 内容优化方案

> 基于现有内容体系（`data/` 目录：中英文双语 mock 数据 + 类型系统）的分析和建议。
> 分为"当前问题"和"优化方向"两部分，按优先级排序。

---

## P0：数据丰富度不足

### 问题

当前 mock 数据量偏少，无法支撑真实的量化研究场景：

| 数据域 | 现有量 | 期望基线 |
|--------|--------|----------|
| Strategies | 3 条 | 8–12 条（跨 3 种模式） |
| Market Ticks | 4 条 | 20+ 条（连续盘口变化） |
| Jobs | 3 条 | 6–8 条（含失败/已完成） |
| Factors | 6 个 | 10–12 个 |
| Factor Eval Results | 2 个 | 6 个（每个活跃因子都要有） |
| Reports | 0（动态生成） | 2–3 个预置报告作为示例 |

### 方案

1. **策略表扩充** — 给每种 mode 增加 3–4 条策略，覆盖不同表现（好/中/差），让策略表格看起来真实
2. **Tick 流扩展** — 模拟连续 5 秒的盘口变化（20+ 条），展示订单簿微观结构变化的典型模式
3. **任务历史填充** — 增加已完成任务和失败任务，展示任务状态迁移路径
4. **因子评估全覆盖** — 每个活跃因子的评估结果（IC 序列、分组收益、分层回测）都要有，便于因子工坊页展示完整评估维度

---

## P1：内容一致性与本地化

### 问题

| 问题 | 位置 | 描述 |
|------|------|------|
| 中英混杂 | `zh.ts` 所有页面 | "Alpha"、"Factor"、"IC"、"Rank IC"、"Daily"、"Tick" 等英文术语直接嵌入中文内容 |
| 本地化深度不足 | `zh.ts` vs `en.ts` | 中文内容基本上是英文的直译，缺少中文量化圈的习惯表达 |
| 固定值无上下文 | 所有策略详情页 | "CSI 500"、"XGBoost"、"21.4%" 等值缺乏上下文说明 |
| 状态文案通用 | `page.status` | 所有页面的 status 字段是单句描述，缺少动态变化的感知 |

### 方案

1. **术语本地化规范**
   - `en.ts`：保持英文量化术语原样（Earnings Yield, Momentum, Sharpe, IC）
   - `zh.ts`：统一采用中文量化社区常用表达 — "IC" 改为 "信息系数"、"Rank IC" 改为 "秩相关系数"、"Tick" 改为 "逐笔"、"Alpha" 改为 "Alpha（超额收益）" — 在首次出现时可保留英文缩写括号说明
   - 共识类术语（Sharpe、IC 等）中英文版本取一致的处理方式

2. **数值上下文化**
   - 页面 subtitle 中加入数值的简短解释，如 "回测完成 14:28:09" → "回测完成 14:28:09，夏普 2.18"
   - Hero metrics 的 label 增加上下文：
     - `"Portfolio CAGR"` → `"Portfolio CAGR (2021-2025)"`
     - `"IC"` → `"IC (20d rolling avg)"`

3. **状态文案动态化**
   - 根据页面上下文，status 在生成时组合成更自然的表述：
     - 有运行中任务时：`"研究链路正常，2 个任务运行中"`
     - 有失败任务时：`"注意：1 个任务失败，请查看日志"`
     - 无任务时：`"研究链路正常，无进行中任务"`

---

## P2：叙事断层

### 问题

当前内容是一个个孤立的静态数据块，缺少用户故事线来串联页面之间的过渡。

### 方案

1. **Dashboard 作为叙事锚点**
   - 让 Dashboard 的 "Recent Strategies" 与 "Watchlist" 内容对应到实际可点击进入的页面
   - 例如 "AI Micro Alpha" 策略 → 点击后导航到 Workspace（AI mode）并自动选中该策略
   - "最近回测" 列表 → 点击后导航到 Backtest Report 并加载对应报告

2. **Workspace 到 Backtest Report 的内容闭环**
   - 当前动态生成的 report 内容过于简化（只有 strategyName、modeName、status）
   - 增加更丰富的报告数据：回测净值曲线摘要、交易统计、收益归因
   - Report 中引用所选的策略配置参数，形成"配置→执行→报告"的完整链路

3. **Factor → Strategy → Workspace 的引用链**
   - 因子页面中 "Referenced By" 引用策略名 → 可点击跳转到该策略的 Workspace
   - 策略详情中展示其使用的因子列表 → 可跳转到因子工坊查看因子的完整评估

---

## P3：因子工坊内容深化

### 问题

因子工坊当前内容是最完善的，但仍有几个缺口：

| 缺口 | 影响 |
|------|------|
| 只有 2 个因子的评估数据 | 因子列表页看起来完整，但点击后缺乏可视化数据 |
| 无 regression tab 数据 | 评估标签支持 sorting / icAnalysis / regression 三种，但 mock 只准备了前两种 |
| 因子描述过于技术化 | `Net income / total market cap` 对非量化用户不够直观 |
| 无因子相关性数据 | `FactorEvalTab.Regression` 下的因子相关性矩阵没有 mock 数据 |

### 方案

1. **补齐 6 个因子的评估数据**
   - 每个活跃因子提供完整的 icSeries、groupReturns、layerSummary
   - draft 状态的因子可只提供基础信息，评估数据可标记为 "pending"

2. **增加 Regression tab 数据**
   - 为 FactorEvalTab.Regression 准备 mock 输出：因子回归系数、t-stat、R²、因子相关性矩阵

3. **描述分层**
   - 每个因子增加 `shortDesc`（一行）和 `detailDesc`（三段）两种描述
   - 表格和列表用 shortDesc，详情页和 tooltip 用 detailDesc

---

## P4：信息架构微调

### 问题

| 问题 | 描述 |
|------|------|
| `brandTagline` 过于通用 | `"Strategy Research Terminal"` 没有体现出 QuantForge 的差异化 |
| `heroEyebrow` 内容空洞 | `"Personal Quant Research Workspace"` 不传递信息 |
| 页面 subtitle 风格不一致 | 部分偏向功能说明（"Manage strategy lists..."），部分偏向场景描述（"A predictive research mode..."） |
| Navigation item `eyebrow` 作用不明 | `Overview` / `Strategies` / `Factors` 等只是 label 的中英文重复，不提供额外信息 |

### 方案

1. **品牌文案升级**
   - `brandTagline`：体现"因子+策略+AI"三位一体特性
   - `heroEyebrow`：改为具体的能力陈述

2. **Subtitle 统一风格**
   - 统一用"用户行为 + 价值"句式：`"管理策略列表、分类和状态，研究工作进入研究台完成"` 而非 `"Manage strategy lists, categories..."`

3. **Navigation eyebrow 去冗余**
   - 去掉与 label 语义重叠的 eyebrow，或改为页面编号/快捷键提示（如 `⌘1`、`⌘2`）
   - 或者彻底删除 eyebrow，简化导航区域

---

## P5：Mock 数据类型补充

### 问题

当前 mock 数据集中在页面展示层，缺少一些支持交互场景的数据类型：

- 无 Order Book 快照数据（HFT 模式需要）
- 无 L2 逐笔委托数据（`mock/l2.ts` 目录存在但未被消费）
- 无分钟线/日线 Bar 数据
- 无因子历史序列数据（IC 窗口滚动变化）
- 无回测净值曲线数据点

### 方案

1. **按需扩展 mock 数据**
   - 为 TickTable 组件增加 Order Book 快照数据（bid/ask 各 5 档）
   - 为 Chart 组件提供时序数据点（如 252 个交易日净值数据）
   - 为 Factor Lab 的 IC 曲线提供更长的序列（30 个窗口期）

2. **消费已有数据文件**
   - `src/data/mock/` 下已有 `reference.ts`、`l2.ts`、`fundamental.ts`、`event.ts`、`market.ts`
   - 这些文件目前未被任何组件消费，需要建立连接或清理

---

## 执行优先级

| 优先级 | 模块 | 工作量 | 收益 |
|--------|------|--------|------|
| P0 | 数据丰富度 | 中 | 高 — 直接影响页面可信度 |
| P1 | 本地化与一致性 | 低 | 中 — 提升专业感和阅读体验 |
| P2 | 叙事闭环 | 高 | 高 — 决定产品感 |
| P3 | 因子工坊深化 | 中 | 中 — 核心差异化功能 |
| P4 | 信息架构 | 低 | 中 — 品牌感知 |
| P5 | 类型补充 | 低 | 低 — 为后续开发打基础 |

建议按 P0 → P1 → P4 → P3 → P2 → P5 的顺序执行，其中 P0 和 P1 可并行开展。