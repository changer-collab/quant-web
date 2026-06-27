---
name: "quantforge-code-review"
description: "QuantWeb 量化平台专属审查——策略逻辑安全性、回测配置正确性、架构边界合规性、因子计算正确性。当需要审查策略/因子/回测代码、检查跨模块依赖、或 PR 前量化领域质量检查时调用。通用代码审查请走 /code-review。"
---

# QuantWeb Code Review

QuantWeb 量化交易平台的量化领域专属审查。**通用代码审查（类型错误、性能、安全隐患等）由系统 `/code-review` 覆盖，本 skill 只审查量化特有内容。**

## 触发条件

- 用户修改了 `packages/strategies/`、`packages/factor-lab/`、`packages/backtest-engine/` 下的 Python 代码
- 用户要求"检查这个策略"、"审查回测"、"检查因子"
- 新增策略、因子定义或回测引擎改动
- PR 前对量化逻辑的专项审查
- **通用审查（bug/lint/类型/安全）请使用 `/code-review`，不要用本 skill 替代**

## 审查清单

按优先级分为三级：🔴 阻断（必须修复）、🟡 警告（建议修复）、🟢 建议（改进方向）。

**通用项（类型安全、边界条件、lint、安全隐患）由系统 `/code-review` 覆盖，本清单仅包含量化特有项。**

---

### 一、架构边界合规（🔴 阻断）

检查所有跨模块引用是否在 **依赖白名单** 内：

```text
允许依赖（白名单）：
apps/api -> services/data-center
apps/worker -> services/data-center

packages/strategy-runtime -> packages/data-client
packages/backtest-engine -> packages/strategy-runtime
packages/backtest-engine -> packages/factor-lab
packages/factor-lab -> packages/strategy-runtime
packages/factor-lab -> packages/data-client
packages/ai-engine -> packages/data-client
packages/strategies -> packages/strategy-runtime
packages/obsidian-sync -> packages/data-client
services/data-collector -> services/data-center
```

**审查规则**：
1. 任何不在白名单中的 import / dependency 都是 🔴 阻断项。
2. 类型定义不能重复——每个类型只在其"所有者"模块定义一次，其他模块通过合法依赖链获取。
3. `apps/api` 不能直接 import Python 包，必须通过 `PythonBridge` 子进程通信。

---

### 二、策略安全与正确性（🔴 阻断）

针对 `packages/strategies/` 中的策略实现：

#### 2.1 未来函数 / 前视偏差
- [ ] 策略是否在 `t` 时刻使用了 `t` 时刻之后才可获得的数据？
- [ ] 因子计算中，`shift()` 或 `lookback` 参数是否避免了未来数据泄漏？
- [ ] 回测引擎的事件回放是否按时间顺序，不会在 `t` 时刻看到 `t+1` 的行情？

#### 2.2 仓位管理
- [ ] `Position` 对象的 `quantity` 不能为负（除非有做空逻辑且明确声明）。
- [ ] 单笔订单金额是否超过 `Account.available_cash`？
- [ ] 是否有仓位集中度上限保护？
- [ ] 滑点设置是否合理（`DEFAULT_SLIPPAGE` 是否有实际值，不能为 0）？

#### 2.3 订单生命周期
- [ ] `OrderStatus` 转换是否合法（FILLED 不可再转回 PENDING）？
- [ ] 部分成交（PARTIALLY_FILLED）是否正确处理？
- [ ] 取消订单后是否从活跃订单列表中移除？
- [ ] 是否有未成交挂单的过期清理机制？

#### 2.4 回测参数合理性
- [ ] `DEFAULT_INITIAL_CASH` 是否合理（不能为 0）？
- [ ] 回测区间（start/end）是否有足够的数据覆盖？
- [ ] 交易成本（佣金 + 滑点）是否计入？

---

### 三、因子定义正确性（🔴 阻断）

针对 `packages/factor-lab/` 中的因子定义：

#### 3.1 因子计算
- [ ] `FactorDefinition` 的计算逻辑是否数学上正确？
- [ ] 传入参数 `FactorRow` 是否包含计算所需的所有字段？
- [ ] 空值 / NaN 是否有处理策略（drop / fill / skip）？
- [ ] 因子标准化（z-score、rank、winsorize）是否正确应用？

#### 3.2 因子评估委托
- [ ] 因子工坊自身不计算 IC、分组收益、分层回测——这些必须委托给 `backtest-engine`。
- [ ] `FactorMetrics` 结构是否与回测引擎输出对齐？

---

### 四、Harness & 自动化质量（🟡 警告）

针对 `scripts/ralph/` 和 ralph harness 相关文件：

- [ ] prd.json 中的 story 是否遵循"一个 story 只改一个关注点"原则？
- [ ] 验收标准是否覆盖类型结构一致性、嵌套对象对齐、前端渲染？（参考 ralph-harness skill 验收边界检查清单）
- [ ] 新加的依赖是否在项目依赖白名单内？
- [ ] progress.txt 是追加而非覆盖？
- [ ] 改动是否有结构化日志（changelog.jsonl）记录，而非只有 git diff？

### 五、因子回测专有性能注意事项（🟢 建议）

- [ ] 回测循环中是否避免了重复计算（如因子在每根 bar 上重新计算整个历史）？
- [ ] 数据查询是否使用了合适的索引条件（symbol + timeframe + date_range）？
- [ ] Worker 编排的并发任务是否设定了合理的并发上限？

---

## 审查流程

### 1. 收集上下文
```
读取：被修改文件的完整内容
读取：被修改文件所在子项目的 AGENT.md
读取：涉及的依赖模块的类型定义
```

### 2. 逐项审查
```
按"审查清单"从 🔴 阻断 → 🟡 警告 → 🟢 建议 逐项检查
每项给出：文件路径 + 行号 + 问题描述 + 建议修复方案
```

### 3. 输出报告
```
## Code Review Report

### 🔴 阻断项（必须修复）
- [file:line] 问题描述 → 建议修复

### 🟡 警告项（建议修复）
- [file:line] 问题描述 → 建议修复

### 🟢 建议项（改进方向）
- [file:line] 问题描述 → 建议修复

### 总结
- 阻断项: N 个
- 警告项: N 个
- 建议项: N 个
- 整体评价: [通过 / 条件通过 / 不通过]
```

---

## DON'T（禁止行为）

- ❌ 不跳过阻断项——所有 🔴 项必须给出明确的修复方案
- ❌ 不猜测被修改文件的内容——必须先 `read_file` 再审查
- ❌ 不审查与本次变更无关的文件
- ❌ **不审查通用代码质量问题（类型错误、lint、边界条件、安全隐患）**——这些由系统 `/code-review` 覆盖
- ❌ 不在审查报告中包含主观编码风格偏好（如命名风格），除非项目有强制规范
- ❌ 不要将 `.codebuddy/`、`runtime/`、`node_modules/`、`__pycache__/` 中的文件纳入审查范围

## 审查后的强制操作

审查完成后，必须告知用户：
1. 阻断项数量及是否可以合并
2. 如果阻断项为 0，建议运行 `pnpm test` 或回归基线检测（`--check-regression`）确认
3. 如果有策略逻辑变更，建议运行对应的回测验证
