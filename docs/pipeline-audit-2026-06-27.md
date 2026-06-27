# 策略开发链条完整性审计

> 审计日期：2026-06-27 | 方法：逐文件代码审计 + 行业标准对照

## 总体结论

**当前状态：研究平台 (research platform)，非交易系统 (trading system)。** 链条前半段（数据→因子→策略→回测→报告）**骨架完整但关键环节有致命缺陷**；后半段（模拟→实盘→风控→运维）**几乎空白**。AGENTS.md 明确声明"当前不做真实下单、券商连接、实盘低延迟交易"，所以后半段缺失是有意为之。但即使是前半段，也存在 3 个**让当前回测结果不可信**的关键缺陷。

---

## 一、数据采集与清洗 🟢 完整度 80%

| 环节 | 状态 | 证据 |
|------|------|------|
| 多源适配器 | **已实现** | 8 个适配器：AKShare、Baostock、Tushare、Efinance、Yfinance、MooTDX、Tencent、CSV。AKShare/Baostock 适配器内嵌完整 Python 脚本，调用真实 PyPI 库 `data-collector/src/adapters/akshare-adapter.ts:79-97` |
| 增量采集 | **已实现** | Watermark 表记录采集进度 `data-center/src/storage/schema.ts:289-297` |
| 调度器 | **已实现** | CollectorScheduler 支持定时/按需采集 `data-collector/src/scheduler.ts` |
| 清洗 | **部分** | Cleaner 模块存在，但具体清洗逻辑（缺失值、异常值、去重）需进一步验证 |
| **复权因子** | **已实现（采集侧）** | Baostock 采集 `adjustment_factor` `baostock-adapter.ts:155-172`；SQLite 有 `adjustment_factors` 表 |
| 存活偏差防护 | **缺失** | instruments 表有 `status: active/suspended/delisted` 字段，但没有 point-in-time 成分股历史；回测不会自动排除已退市标的 |
| Tushare/其他适配器 | **部分** | Tushare、Efinance、Tencent 适配器有结构但需验证是否可达（需 API key / 网络） |

**⚠️ 关键 gap：存活偏差 (survivorship bias)。** 回测用当前活跃股票池跑历史，已退市/ST/并购的标的被自动排除，收益虚高。这是量化回测最常见的陷阱之一。

---

## 二、数据存储 🟢 完整度 85%

| 环节 | 状态 | 证据 |
|------|------|------|
| K线 | **已实现** | bars 表，含 OHLCV+turnover `schema.ts:19-35` |
| Tick | **已实现** | ticks 表，含 bid/ask `schema.ts:38-53` |
| 标的信息 | **已实现** | instruments 表，含 exchange/lotSize/priceTick/status `schema.ts:58-73` |
| 交易日历 | **已实现** | trading_calendars 表 |
| 指数成分 | **已实现** | index_constituents 表 |
| 基本面（财报/估值/股东人数） | **已实现** | financial_reports、financial_ratios、valuations、shareholder_metrics 表 |
| 事件/新闻 | **已实现** | announcement_events、news_articles 表 |
| L2 行情 | **已实现** | l2_snapshots、trade_records、order_records 表（但数据填充状态未验证） |
| 宏观数据 | **已实现** | macro_indicator_defs、macro_points 表（但数据填充状态未验证） |
| PostgreSQL 迁移 | **部分** | PostgreSQL driver 存在，但当前默认 SQLite |
| **数据覆盖率** | **未知** | L2/宏观/事件表结构完备但数据是否真正入库未验证 |

---

## 三、特征提取 🟡 完整度 30%

`packages/ai-engine/quantforge_ai/features.py:9-44`

| 特征 | 状态 |
|------|------|
| 收益率特征 (return_1/5/10/20) | **已实现** |
| 波动率特征 (volatility_5/10/20) | **已实现** |
| 成交量特征 (volume_ratio) | **已实现** |
| 技术指标特征 (RSI/MACD/布林带等) | **缺失** — indicators.py 在 strategies 包里，FeatureExtractor 没调用 |
| 基本面特征 (PE/PB/ROE/市值等) | **缺失** — valuations/financial_reports 表有数据但特征提取器不用 |
| 另类数据特征 (新闻情绪/股东人数/宏观) | **缺失** |
| 特征存储 (feature store) | **缺失** — 特征每次重新算，无版本化 |
| 前视偏差保护 | **缺失** — 无时间序列交叉验证的 purge/embargo |
| 缺失值/异常值处理 | **缺失** — extract_all 不处理 NaN |

**⚠️ 当前 FeatureExtractor 只有 3 类基础特征，远不足以支撑有效的 ML 因子挖掘。**

---

## 四、因子挖掘 🔴 完整度 0%

**这是整个链条里最大的一块空白。**

| 能力 | 状态 |
|------|------|
| 手工定义因子 | **已实现** — Factor ABC + SimpleFactor，但 `factor_eval.py:71-72` 的 `_make_factor` **始终返回 `df["close"]`**，无视传入的 formula |
| 公式解析器/AST 求值 | **缺失** — 无因子表达式引擎 |
| 自动化因子发现（遗传规划） | **缺失** |
| 自动化因子发现（符号回归） | **缺失** |
| 自动化因子发现（LLM 驱动） | **缺失** |
| 因子注册/版本管理 | **部分** — factor_definitions 表有结构但没有注册表实现 |
| 因子组合/复合因子 | **缺失** |

**⚠️ 致命问题：`factor_eval.py:71-72` — `_make_factor` 创建了一个 `SimpleFactor`，其 `compute()` 方法**永远返回 `df["close"]`**，完全忽略 `info["formula"]`。这意味着所有因子评估实际评估的是**收盘价本身**。这个 stub 必须在任何因子工作流可用之前修复。**

---

## 五、因子分析/评价 🟡 完整度 35%

`packages/factor-lab/quantforge_factor/evaluator.py:12-87`

| 指标 | 状态 |
|------|------|
| IC (Pearson) | **已实现** `evaluator.py:18-23` |
| Rank IC (Spearman) | **已实现** `evaluator.py:25-30` |
| 分组收益 (quantile group returns) | **已实现** `evaluator.py:32-47` |
| 多空收益 (long-short) | **已实现** `evaluator.py:63-67` |
| IC 胜率 | **已实现** `evaluator.py:69-73`（但计算方式有问题：用 `factor_values * forward_returns > 0` 而非 IC 方向一致性） |
| **IC 衰减曲线** | **缺失** — 只有单时间点 IC，无 decay profile |
| **IC_IR** | **缺失** — 只有 mean IC，无 IC 信息比率 |
| **因子中性化/正交化** | **缺失** — UI 有 FactorNeutralization 组件但无后端计算 |
| **因子相关性矩阵** | **缺失** — UI 有 FactorCorrelation 组件但无后端计算 |
| **因子换手率** | **缺失** |
| **分层回测（完整资金曲线）** | **缺失** — 只有分组均值收益，无完整的 quantile portfolio backtest |
| **因子稳健性检验** | **缺失** — 无不同市场环境/不同参数下的稳健性分析 |
| **因子经济学逻辑** | **缺失** — UI 有 FactorEconomicLogic 组件但内容为 mock |

---

## 六、策略构建 🟢 完整度 65%

| 环节 | 状态 | 证据 |
|------|------|------|
| **策略框架** | **已实现** | 清晰的三层分离：Timer(择时) → Selector(选股) → Sizer(仓位) → Composite. `strategy.py:15`, `timers.py:14`, `selectors.py:13`, `sizers.py:13` |
| **择时策略** | **已实现** | 双均线、MACD、RSI、KDJ、布林带，全部有实际逻辑 `strategies/combined/*.py` |
| **选股策略** | **部分** | 只有 MomentumSelector (top-K by return)，无多因子选股、无基本面选股、无可投资域过滤 |
| **仓位管理** | **部分** | EqualWeight 和 FixedFraction 两个 sizer，无 Kelly、无风险平价、无波动率目标 |
| **组合优化** | **缺失** | 无 mean-variance、无 risk parity、无约束优化 |
| **多策略组合** | **部分** | MultiStrategyRunner 按静态权重分割资金 `multi_strategy_runner.py:52`，但子策略间无共享现金、无净额清算、无动态再平衡 |
| **策略注册/发现** | **已实现** | registry.py 字典式注册 `strategies/registry.py:26` |
| **AI 策略** | **🔴 断头路** | `model.py:22` 训练了真实 sklearn 模型，但**模型从不持久化**，且**没有任何策略消费预测结果**。`ai_train.py:43-49` 训完就丢 |

---

## 七、回测引擎 🟡 完整度 55%

### 7a. 核心机制 ✅

| 机制 | 状态 | 证据 |
|------|------|------|
| Look-ahead bias 防范 | **已实现** | 每 bar 先撮合→再更新价格→再 on_bar `runner.py:117-171`，信号产生的 bar 不撮合 |
| 订单撮合 | **已实现** | Market 单按 next-bar close 成交；Limit 单在 [low, high] 区间内成交 `matcher.py:62-69` |
| T+1 逻辑 | **已实现** | 买入当日锁定，次日解锁 `portfolio.py:61`，`runner.py:108-115` |
| 手续费模型 | **已实现** | 佣金 万2.5 最低5元、印花税 卖出0.05%、过户费 沪市0.001% `market_rules.py:74-91` |
| 最小交易单位 | **已实现** | 买入100股整数倍 `matcher.py:49-56` |

### 7b. 🔴 致命缺陷：成本规则从未接入 CLI

**`commands/backtest.py:76-80`** — `BacktestRunner` 和 `MultiSymbolRunner` 从不传入 `market_rules` 参数。`runner.py:35` 默认 `market_rules=None`，`runner.py:185` 中 `enable_market_rules = self.market_rules is not None` 始终为 `False`。

**结果：所有通过 CLI 运行的回测都是零成本、无 T+1、无手数限制。`market_rules.py` 的 112 行代码是死代码。** 这是让所有回测结果不可信的最严重 bug。

### 7c. 其他缺失

| 机制 | 状态 |
|------|------|
| **涨跌停/停牌处理** | **缺失** — 撮合器不检查 limit_up/limit_down/paused，锁死涨停板也会成交 |
| **复权处理（引擎侧）** | **缺失** — 回测引擎不做复权，依赖上游提供已复权数据。无拆分/分红处理 |
| **滑点模型** | **部分** — 只有固定百分比滑点，默认 0.0，无市场冲击模型 |
| **可做空/融券** | **缺失** — 仅支持做多 |
| **日内回测** | **缺失** — T+1 日期检测用 `bar.timestamp` 相等 `runner.py:112`，对分钟线会崩溃 |
| **多标的回测** | **部分** — MultiSymbolRunner 存在但 CLI 不路由到它（传统策略多标的直接报错）`backtest.py:99-105` |

---

## 八、绩效指标与归因 🟡 完整度 40%

### 8a. 已有指标

| 指标 | 状态 | 证据 |
|------|------|------|
| 总收益/年化收益 | **已实现** | `metrics.py:10-103` |
| 年化波动率 | **已实现** | 但年化因子硬编码 252 `metrics.py:31,37,40` |
| Sharpe Ratio | **已实现** | |
| Sortino Ratio | **已实现** | |
| Max Drawdown / 持续期 | **已实现** | |
| Calmar Ratio | **已实现** | |
| 胜率 | **部分** | 计算方式为 bar 收益正负比，非 per-trade 胜率 `metrics.py:85` |
| 盈亏比/平均持仓天数 | **已实现** | FIFO 匹配 `metrics.py:104+` |

### 8b. 缺失指标

| 指标 | 状态 |
|------|------|
| **信息比率 (IR)** | **缺失** |
| **基准比较/超额收益** | **缺失** — 无 benchmark 概念 |
| **年化换手率** | **缺失** |
| **因子暴露分析** | **缺失** |
| **绩效归因** | **缺失** — 无子策略/板块/因子归因 |
| Brinson 归因 | **缺失** |
| 滚动指标（滚动 Sharpe/回撤） | **缺失** |
| Omega Ratio / Tail Ratio | **缺失** |

---

## 九、过拟合防护 🔴 完整度 0%

**文档期望**（`docs/development/回测报告框架.md` 第 8 节「稳健性检验」）vs **现实**：完全空白。

| 方法 | 状态 |
|------|------|
| Walk-Forward 分析 | **缺失** |
| 样本外验证 | **缺失** |
| 参数敏感性分析 | **缺失** |
| 多重检验校正（Bonferroni/Holm） | **缺失** |
| Deflated Sharpe Ratio | **缺失** |
| PBO (Probability of Backtest Overfitting) | **缺失** |
| Combinatorial Purged Cross-Validation | **缺失** |

**AI 模型的 train_test_split 用的是随机切分而非时间序列切分** `model.py:35`，这在金融时间序列上完全不适用。

---

## 十、模拟交易 (Paper Trading) 🔴 完整度 0%

**完全缺失。** 没有前向模拟运行时的任何代码：
- 没有"加载今日数据→跑策略→出信号"的模式
- strategy-runtime CLI 只有 `backtest`（历史）和 `analyze`（分析），没有 `forward`/`paper` 命令
- 没有持仓跟踪/信号记录/模拟成交的 paper trading 引擎

---

## 十一、实盘交易 🔴 完整度 0%（按设计）

AGENTS.md `:159` 明确声明：**"当前不做真实下单、券商连接、实盘低延迟交易、权限系统、策略市场。"**

这是有意为之的边界，不是遗漏。但需要知道缺失范围：

| 组件 | 状态 |
|------|------|
| 券商 API (CTP/XTP/IB/富途等) | 未开始 |
| 订单管理系统 (OMS) | 未开始 |
| 执行算法 (TWAP/VWAP/Iceberg) | 未开始 |
| 实时行情流 | 未开始 |
| 持仓/资金实时同步 | 未开始 |
| 监管合规（适当性/反洗钱/报单留痕） | 未开始 |

---

## 十二、实时风控 🔴 完整度 5%

| 风控项 | 状态 |
|------|------|
| 回撤熔断（自治循环内） | **已实现** — `DrawdownStop` `loop-engine/conditions.py:37-48` |
| 仓位限制 | **缺失** |
| 单票集中度限制 | **缺失** |
| 行业/板块暴露限制 | **缺失** |
| 杠杆限制 | **缺失** |
| 实时 pre-trade 检查 | **缺失** |
| 流动性检查 | **缺失** |

---

## 十三、自治闭环 🟡 完整度 25%

| 组件 | 状态 |
|------|------|
| 循环引擎类型定义 | **已实现** `loop-engine/types.py` |
| 终止条件 | **已实现** — MaxIterations、ConvergenceCheck、DrawdownStop、NoImprovementStop `conditions.py` |
| LoopHandler（Worker 侧） | **🔴 骨架** `loop-handler.ts:63-70` — 迭代循环被注释掉，始终返回 0 次迭代 |
| Ralph 自治 Harness | **部分** — 存在 `scripts/ralph/` 脚本，但 README 显示这是**开发任务跟踪**工具（类似项目管理的 PRD→Story 驱动），不是交易策略自治 Agent |
| 闭环（数据→因子→回测→报告→决策→迭代） | **未打通** — 每个环节可以独立运行，但没有自动化串联 |

**CLAUDE.md 开篇声称**"AI 驱动的量化交易平台 — 通过 Claude Code Agent 自治分析市场、执行策略、生成交易报告"**是愿景，不是现实。** 当前 Claude Code Agent 的角色是开发助手（写代码、修 bug），不是交易 Agent。

---

## 十四、报告与输出 🟢 完整度 70%

| 组件 | 状态 |
|------|------|
| 前端回测报告 | **已实现** — 17 个 Report* 组件 (`web/src/components/report/*`)，覆盖概览/收益/风险/归因/持仓/交易/压力测试/稳健性等 |
| 前端因子报告 | **已实现** — 13 个 Factor* 组件，但很多渲染 mock 数据 |
| report_analysis 引擎 | **已实现** — 规则引擎 + 模板生成执行摘要、风险警告、实盘建议 `ai-engine/report_analysis/analyzer.py` |
| Obsidian Vault 同步 | **已实现** — SyncService 同步策略/因子/回测/仪表盘到 Obsidian `obsidian-sync/sync.py` |
| LLM 分析 | **预留接口** — prompts.py 定义了 LLM prompt，但 analyzer.py 当前用模板而非 LLM |

---

## 十五、运维与监控 🟡 完整度 20%

| 组件 | 状态 |
|------|------|
| CI/CD | **已实现** `.github/workflows/ci.yml` |
| Worker 进程管理 | **基础** — 轮询 `main.ts:124-148`，无进程守护 |
| 健康检查 | **缺失** |
| 日志/指标/告警 | **缺失** |
| 容器化 (Docker) | **缺失** |
| 密钥管理 | **基础** — `.env` + `.env.example`，AGENTS.md 规定了统一管理策略 |

---

## 🔴 最严重的 5 个缺陷（按紧急度排序）

| # | 缺陷 | 影响 | 修复难度 |
|---|------|------|----------|
| 1 | **回测 CLI 未接入市场规则** — 所有回测零成本、无 T+1、无手数限制 | 所有回测结果不可信 | 低（传参即可） |
| 2 | **`factor_eval._make_factor` 是 stub** — 始终返回 `df["close"]` | 因子评估结果无意义 | 中（需要公式解析器） |
| 3 | **AI 训练是断头路** — 模型不持久化、无策略消费 | AI 策略链路完全不可用 | 中 |
| 4 | **过拟合防护完全空白** — 无 walk-forward/OOS/deflated Sharpe | 无法区分真信号和过拟合 | 高 |
| 5 | **存活偏差未处理** — 无 point-in-time 成分股 | 回测收益系统性虚高 | 中 |

## 🟡 次优先的 5 个缺口

| # | 缺口 |
|---|------|
| 6 | 绩效归因完全空白（无因子/板块/子策略归因） |
| 7 | 涨跌停/停牌未处理（极端行情下撮合失真） |
| 8 | 因子分析缺 IC 衰减/中性化/正交化/换手率 |
| 9 | 组合优化空白（只有 equal/fixed weight） |
| 10 | Paper trading 完全缺失，没有从回测到实盘的过渡桥梁 |

## 🔮 按设计尚不做的（非缺陷，是路线图边界）

| 组件 | AGENTS.md 明确排除 |
|------|-------------------|
| 实盘交易 | `:159` "当前不做真实下单、券商连接、实盘低延迟交易" |
| 权限系统 | `:159` |
| 策略市场 | `:159` |
| 循环引擎实现 | `:150` "单次闭环打通后才进入实现阶段" |
| 港股/美股/期货 | `roadmap.md:86-88` 低优先级 |

---

## 📊 完整度总览

```
数据采集 ████████████████░░░░  80%
数据清洗 ██████████░░░░░░░░░░  50%
数据存储 █████████████████░░░  85%
特征提取 ██████░░░░░░░░░░░░░░  30%
因子挖掘 ░░░░░░░░░░░░░░░░░░░░   0%
因子分析 ███████░░░░░░░░░░░░░  35%
策略构建 █████████████░░░░░░░  65%
回测引擎 ███████████░░░░░░░░░  55%
绩效指标 ████████░░░░░░░░░░░░  40%
绩效归因 ░░░░░░░░░░░░░░░░░░░░   0%
过拟合防护 ░░░░░░░░░░░░░░░░░░░░   0%
模拟交易 ░░░░░░░░░░░░░░░░░░░░   0%
实盘交易 ░░░░░░░░░░░░░░░░░░░░   0% (按设计)
实时风控 █░░░░░░░░░░░░░░░░░░░   5%
自治闭环 █████░░░░░░░░░░░░░░░  25%
报告输出 ██████████████░░░░░░  70%
运维监控 ████░░░░░░░░░░░░░░░░  20%
```

**核心瓶颈不在技术复杂度，而在 3 个已经写好了但没接上的"断线"**——市场规则未传参、因子评估是 stub、AI 训完就丢。修这三个是投入产出比最高的工作。之后再补过拟合防护和因子挖掘，链条才能真正产出可信的研究结论。
