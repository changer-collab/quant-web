---
name: "quantforge-code-review"
description: "QuantForge 量化策略代码审查。审查策略逻辑安全性、回测配置正确性、架构边界合规性、因子计算正确性。当用户要求审查策略代码、回测配置、因子定义、跨模块依赖、或提交 PR 前的质量检查时调用。"
---

# QuantForge Code Review

针对 QuantForge 量化交易平台的专属代码审查 skill，覆盖 Python 策略与 TypeScript 服务两层。

## 触发条件

以下任一场景调用本 skill：
- 用户要求"review 代码"、"检查这个策略"、"审查代码"
- 用户修改了 `packages/strategies/`、`packages/factor-lab/`、`packages/backtest-engine/` 下的 Python 代码
- 用户修改了 `apps/api/`、`apps/worker/`、`services/data-center/` 下的 TypeScript 代码
- 提交 PR 前的质量检查
- 新增策略或因子定义

## 审查清单

按优先级分为三级：🔴 阻断（必须修复）、🟡 警告（建议修复）、🟢 建议（改进方向）。

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

### 四、TypeScript 服务质量（🟡 警告）

#### 4.1 API 层（`apps/api/`）
- [ ] API 路由是否只做 HTTP 入口和轻量编排，不包含回测/因子/模型的计算逻辑？
- [ ] 内部端点 (`/api/internal/tasks/*`) 是否不走公共路由中间件？
- [ ] 是否对输入做了基本校验（参数类型、范围、必填）？
- [ ] SSE 端点是否正确处理客户端断连后的资源清理？

#### 4.2 Worker 层（`apps/worker/`）
- [ ] Worker 是否通过 HTTP 轮询 API 领取任务，没有共享内存队列？
- [ ] `PythonBridge` 子进程是否有超时和错误重试机制？
- [ ] Worker 崩溃后是否有任务恢复或标记失败的逻辑？

#### 4.3 数据中心（`services/data-center/`）
- [ ] 是否只做存储、标准化和查询，不感知策略/回测业务？
- [ ] 数据模型是否对应 6 个子域（reference / market / l2 / fundamental / event / quality）？
- [ ] 是否提供了合理的分页和过滤能力？

---

### 五、Python 代码质量（🟡 警告）

- [ ] 所有公开函数是否有类型注解（type hints）？
- [ ] 复杂逻辑是否有中文注释说明？
- [ ] 是否遵循包命名规范 `quantforge_<module>`？
- [ ] 是否有对应的单元测试文件在 `tests/` 目录下？

---

### 六、类型一致性（🟡 警告）

检查 `packages/*`（Python）与 `apps/*`（TypeScript）之间的类型对齐：

| Python 类型 (所有者) | TS 侧位置 | 检查规则 |
|---------------------|----------|---------|
| `TaskStatus`, `TaskType` | `apps/api/src/types.ts` | 枚举值必须和 Python 侧一致 |
| `BacktestResult`, `EquityPoint` | `apps/api/src/types.ts` | 字段名、类型必须一致 |
| `FactorMetrics`, `FactorRow` | `apps/api/src/types.ts` | 字段名、类型必须一致 |

**审查方法**：对比 Python 类型定义文件与 TS 的 `types.ts`，确认没有字段缺失或类型不匹配。

---

### 七、安全隐患（🔴 阻断）

- [ ] 是否有任何连接真实券商、真实下单的代码？（当前阶段禁止）
- [ ] API 端点是否有任何硬编码的密钥或 token？
- [ ] Python 子进程是否有可能执行任意命令的路径？
- [ ] 用户输入的 `StrategyParamDef` 值是否做了类型和范围校验？

---

### 八、性能注意事项（🟢 建议）

- [ ] 回测循环中是否避免了重复计算（如因子在每根 bar 上重新计算整个历史）？
- [ ] 数据查询是否使用了合适的索引条件（symbol + timeframe + date_range）？
- [ ] 前端列表是否做了分页/虚拟滚动（数据量大时）？
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
- ❌ 不在审查报告中包含主观编码风格偏好（如命名风格），除非项目有强制规范
- ❌ 不要将 `.codebuddy/`、`runtime/`、`node_modules/`、`__pycache__/` 中的文件纳入审查范围

## 审查后的强制操作

审查完成后，必须告知用户：
1. 阻断项数量及是否可以合并
2. 如果阻断项为 0，建议运行 `pnpm test` 确认
3. 如果有策略逻辑变更，建议运行对应的回测验证
