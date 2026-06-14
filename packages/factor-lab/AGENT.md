# packages/factor-lab/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 当前目录尚未实现，新增代码前必须先确认因子运行时接口和数据边界。
- 因子实验室只负责因子定义、计算、评估和注册，不执行策略逻辑。
- 不直接处理 HTTP 请求，不直接拥有数据中心。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
未实现
```

## 边界

只负责：

```text
因子定义（DSL / 表达式）
因子计算（批量计算 / 清洗 / 标准化）
因子评估（排序法 / IC / Fama-MacBeth / 自定义评估器）
因子注册（元数据 / 版本 / 标签 / 状态管理）
```

## 不负责

```text
策略开发与策略组合
完整回测（回测引擎负责）
数据中心行情接入与清洗
AI 模型训练（AI 引擎负责）
HTTP API
真实下单
```

## 适用性

- **传统量化**：强依赖，多因子选股 / 统计套利 / 行业轮换都需要因子。
- **AI 量化**：强相关，因子作为特征工程原料，IC / IR 为核心质量评估指标。
- **高频策略**：不适用，高频关注微观结构（order book / spread / 队列优先级），不走传统因子路径。
- 策略通过 `StrategyMeta.requiredFactors` 声明对因子的依赖，不直接耦合因子实现。

## 依赖

```text
@quant/common
```

## 被依赖方向

```text
packages/backtest-engine -> packages/factor-lab   # 运行时解析因子值，注入 StrategyContext
apps/worker -> packages/factor-lab                # 编排因子计算和评估任务
```

注意：`packages/strategies` 不直接依赖 `factor-lab`。策略通过 `StrategyMeta.requiredFactors`（在 `strategy-runtime` 中声明）引用因子 ID，实际的因子值由回测引擎在运行时从 `factor-lab` 拉取并注入 `StrategyContext`。

依赖链：

```text
strategies → strategy-runtime → common
                                ↑
          StrategyMeta.requiredFactors（声明，不直接引 factor-lab）

backtest-engine → strategy-runtime → common
                → factor-lab → common     ← 运行时解析因子值
                → data-center              ← 行情数据
```
