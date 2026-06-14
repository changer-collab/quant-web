# packages/factor-lab

`packages/factor-lab` 是因子研发工坊，提供因子定义、批量计算、多框架评估和因子注册的完整闭环。

## 当前阶段

```text
未实现
```

## 子模块规划

| 子模块 | 职责 |
|--------|------|
| 因子定义 DSL | 声明因子公式、数据源、计算频率 |
| 因子计算引擎 | 批量计算因子值、处理缺失 / 极值 / 标准化 |
| 因子评估器 | 排序法分组收益 / IC 分析 / Fama-MacBeth 回归 / 自定义评估器 |
| 因子注册中心 | 因子元数据、版本、标签、状态管理 |

## 导出（规划）

| 导出 | 类型 | 说明 |
|------|------|------|
| `FactorEvalTab` | enum | 评估器标签（排序法 / IC / 回归） |
| `FactorStatus` | enum | 因子状态（Active / Deprecated / Draft） |
| `FactorDefinition` | interface | 因子定义 |
| `FactorMetrics` | interface | 因子评估指标 |
| `FactorEvaluationResult` | interface | 因子评估结果 |
| `FactorRow` | interface | 前端因子列表行 |

## 依赖

```text
@quant/common
```

## 不负责

```text
策略开发与策略组合
完整回测
数据中心行情清洗
AI 模型训练
HTTP API
```

## 被依赖方向

```text
packages/strategies -> packages/factor-lab
packages/backtest-engine -> packages/factor-lab
apps/worker -> packages/factor-lab
```
