# packages/loop-engine/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 循环引擎是纯类型骨架包，当前阶段不实现调度引擎、不做状态持久化、不自带进程入口。
- 不直接调用回测/AI/因子引擎，不直接读数据中心，不处理 HTTP。
- 循环的调度编排由 Worker 负责，循环状态持久化由 Worker 通过 API 任务表实现。
- 迭代结果（IterationRecord）只存引用（子任务 ID、结果摘要），不内联其他引擎的完整结果类型。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
纯类型骨架已创建，定义 8 个循环类型和 LoopCondition 纯函数接口。单次闭环（backtest → obsidian-sync、backtest → web 报告展示）打通后才进入实现阶段。
```

## 已有能力

```text
- LoopType/LoopStatus/IterationStatus 枚举
- LoopConfig/IterationRecord/LoopSummary/LoopRecord dataclass
- LoopCondition Protocol（终止条件判断纯函数接口）
- 基础测试（8 个测试用例）
```

## 边界

只负责：

```text
循环生命周期类型定义（状态、配置、迭代记录）
终止条件判断的纯函数接口
循环汇总结构
```

不负责

```text
调度引擎
状态持久化
回测/AI/因子引擎调用
数据中心读取
HTTP 处理
进程入口
```

## 依赖

```text
无外部依赖，纯类型骨架
```

## 拥有的类型

```text
LoopType, LoopStatus, IterationStatus,
LoopConfig, IterationRecord, LoopRecord,
LoopCondition, LoopSummary
```

## 被依赖方向

```text
无 — loop-engine 当前不被任何模块依赖，单次闭环打通后才进入实现阶段
```
