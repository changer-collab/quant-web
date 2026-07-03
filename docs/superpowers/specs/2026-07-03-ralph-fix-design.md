# ralph/backend-sync-realign-phase6-9 修复设计

> 对齐基准:`ralph/backend-sync-realign-phase6-9` 分支(HEAD `f386832`)代码审查报告。本分支 14 个 story 已交付,但代码审查发现 5 个 Critical + 7 个 Important 问题,其中 2 个被 ralph 错误标为"预存问题"实为本分支自身回归。本设计描述如何修复这些问题使 PR 可合并。

## 目标

修复代码审查发现的 5 个 Critical + 7 个 Important 问题,使 `ralph/backend-sync-realign-phase6-9` 分支:

1. 全包测试绿(`pnpm test` + Python 7 包 `pytest`)
2. UIConstraint 在前端实际生效(不再运行时失效)
3. story-8 端到端验收结论可信(重跑通过)
4. ralph 自识别的 2 个"预存问题"被纠正为本分支回归并修复
5. PR 可合并

## 范围

**in scope**:
- 5 个 Critical(测试红、UIConstraint 失效、死代码复活、story-8 重验)
- 7 个 Important(元数据回归、stdin error、param.key 残留、submitBacktest 静默失败、_run_composite 不一致、README 同步、plan 勾选)
- ralph harness 文件从 git 索引移除 + .gitignore 补全

**not in scope**(留后续迭代):
- 8 个 Minor(DRY 重构、_parse_dates 死代码、p.min 边界、异常吞、kline-chart as any、setup.ts mock、API/Worker spawn+NDJSON 重复、ralph harness history 重写)
- deprecated `key` 字段彻底清理(需改 useResearchWorkflow.ts 3 处 + API 移除 deprecated,扩大改动范围)
- strategy-grid.tsx 在另一分支的死代码处理(本分支仅删除本分支加回的部分)

## 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 分支 | 仍在 `ralph/backend-sync-realign-phase6-9` | 未合并 main,在原分支修复最自然,git history 一条线清晰 |
| 修复范围 | Critical + Important(12 个修复点) | 只修 Critical 等于修一半(UIConstraint 修了但 label/options 仍丢);Important 含生产可观测性硬伤 |
| deprecated 双字段 | 保留 `key` + `name` 双填 | 彻底清理扩大改动范围,留作下个 PR |
| UIConstraint 修法 | 前端 `mapParam` 显式字段映射 | KISS,改 1 处,API/CLI 不动;让 API 输出 camelCase 会破坏 deprecated 双字段策略 |
| ralph harness 文件 | `.gitignore` 补全 + `git rm --cached` | 已被提交污染,仅加 .gitignore 不够,需从索引移除(保留本地文件) |
| story-8 重验 | 修复后重置 `passes: false` → 重跑 → `passes: true` | ralph 状态机要求,且原验收结论已被证伪 |
| 提交粒度 | 按 story 边界分提交 | 与原 14 story 风格一致,review 友好 |

## 改动清单

> 编号说明:F1-F12 对应代码审查的 5 Critical + 7 Important 共 12 个修复点。F13 是 story-8 重验动作(非新修复点,是验收步骤)。F14 是 ralph harness 文件清理(附加,对应审查报告 Minor #18,因涉及 git 索引污染本次一并处理)。

### 组 1:story-2 回归修复(Python strategy-runtime)

#### F1. 删除 stub 测试(Critical #2)

**文件**:`packages/strategy-runtime/tests/test_diagnostics_stub.py`

**改动**:删除 `test_transitional_contains_expected_fields` 方法(约第 77 行)。

**理由**:该方法断言 transitional 返回 `ic_series/layered_returns/summary`,但 story-2 已把返回结构改为 `sentiment_curve/mapping_metrics/outlier_count/validation_passed`。新结构已被 `tests/test_diagnostics_transitional.py::TestValidation` 等覆盖,无需重复。

**不更新断言而删除的理由**:stub 测试本身已无存在意义,transitional 不再是 stub。

#### F2. _run_composite 应用 snapshotParams 优先级(Important #10)

**文件**:`packages/strategy-runtime/quantforge_strategy/commands/backtest.py:154-156`

**当前**:`_run_composite` 仍读 `components.{selector,timer,sizer}.params`,未应用 snapshotParams 优先级。

**更新为**:与 `_run_single` 同样的 `configSnapshot` 优先 + `strategyParams` fallback 逻辑。提取共用 helper `_resolve_params(config_snapshot, strategy_params, component_key)` 避免重复。

**测试**:新增 `test_backtest_command_market_rules.py` 中 1 个测试,验证组合策略 + configSnapshot 优先级。

### 组 2:story-7c 回归修复(Worker)

#### F3. 删除 queue/worker 测试(Critical #1)

**文件**:
- `apps/worker/tests/queue.test.ts`(整文件删除)
- `apps/worker/tests/worker.test.ts`(整文件删除)

**理由**:测试的目标模块 `src/queue.ts`、`src/worker.ts` 已被 story-7c 删除,测试无存在意义。

#### F4. handler 测试夹具迁移(Critical #1)

**文件**:
- `apps/worker/tests/backtest-handler.test.ts`
- `apps/worker/tests/diagnostics-handler.test.ts`

**当前**:两文件 `import { TaskQueue } from '../src/queue.js'`,把 TaskQueue 当测试夹具。vitest 运行时 `Cannot find module`,0 tests。

**更新为**:移除 TaskQueue import,改为直接构造 mock configSnapshot + mock PythonBridge(或 mock DataCenter),直接调 `handler.handle({type:'backtest', payload:{...}})`,断言 handler 调用下游的入参。

**测试要求**:重写后测试数不少于原文件测试数,覆盖正常路径 + 错误路径。

### 组 3:story-7b 修复(API strategy-sync)

#### F5. 元数据字段补全(Important #6)

**文件**:
- `packages/strategy-runtime/quantforge_strategy/commands/list_strategies.py:51, 73-83`
- `apps/api/src/services/strategy-sync.ts:91-122`(`camelToSnakeMeta`)

**当前**:
- CLI `_camelize_params` 未输出 `label/type/default/options`
- API `camelToSnakeMeta` 把 `label` 降级为 `name`、`type` 硬编码 `'number'`、`default` 硬编码 `0`、`options` 完全丢弃

**更新为**:
- CLI `_camelize_params` 输出 `label: p.label`、`type: p.type.value`(枚举值)、`default: p.default`、`options: p.options`
- API `camelToSnakeMeta` 透传这些字段(不再硬编码)

**测试**:
- 扩展 `test_cli_list_strategies.py` 断言输出含 label/type/default/options
- 扩展 `apps/api/tests/services/strategy-sync.test.ts` 断言映射后字段完整

**不在 F5 内**:`list_strategies.py:51` 的 `p.min or 0` 是 Minor 问题,保持 not in scope,不顺手改,避免范围蔓延。

#### F6. stdin error handler(Important #7)

**文件**:`apps/api/src/services/strategy-sync.ts:200-202`

**当前**:`proc.stdin.write` 后 `end()` 无 `stdin.on('error')`。Python 进程提前退出时触发 EPIPE,unhandled stream error 崩 API。

**更新为**:在 `proc.stdin.write` 前加 `proc.stdin.on('error', () => {})` 静默吞 EPIPE(进程已退出,无需处理)。

**测试**:新增 1 个测试,模拟 Python 进程立即退出(如 `python -c "sys.exit(1)"`),断言 API 返回空数组而非崩溃。

### 组 4:story-6a/6b/6c 前端契约修复

#### F7. UIConstraint 显式映射(Critical #3)

**文件**:`apps/web/src/hooks/useStrategies.ts:19`

**当前**:`uiConstraints: api.ui_constraints as StrategyParam['uiConstraints']` —— `as` 强转骗过编译器,运行时 `c.targetField` 永远 `undefined`,所有 `disable_when/require_when` 约束失效。

**更新为**:显式字段映射:

```typescript
uiConstraints: (api.ui_constraints ?? []).map((c) => ({
  type: c.type,
  targetField: c.target_field,
  targetValue: c.target_value,
  actionValue: c.action_value,
  // 其余 camelCase 字段直接透传
})),
```

**测试**:新增 1 个测试,输入 snake_case ui_constraints,断言输出 camelCase 且 `targetField` 等字段正确。

**数据流**:
```
Python list_strategies → API mapMeta(双字段) → 前端 useStrategies.mapParam
  api.ui_constraints = [{target_field, target_value, action_value, ...}]  // snake
  ↓ 显式映射
  StrategyParam.uiConstraints = [{targetField, targetValue, actionValue, ...}]  // camel
  ↓
  ConfigPanel 中 c.targetField 正确读取,disable_when/require_when 约束恢复生效
```

#### F8. 删除 strategy-grid.tsx(Critical #4)

**文件**:`apps/web/src/components/strategy-grid.tsx`(整文件删除)

**理由**:main 分支已删除该文件,本分支又作为新文件加回标 `@deprecated`,与 `strategy-grid-new.tsx`(已被 `strategy-page.tsx` 引用)并存。story-6c 提交信息声称的 "ResearchModeId repair" 在 diff 中根本不存在。

**验证**:删除后 `pnpm build` 通过(确认无 import 残留)。

#### F9. param.key → param.name(Important #8)

**文件**:`apps/web/src/hooks/useResearchWorkflow.ts:48, 350, 483`

**当前**:3 处仍用 `param.key`。story 声称"所有使用点都改了",实际未改。当前因 `mapParam` 双填 `key+name` 能跑,API 清理 deprecated 时会断。

**更新为**:3 处 `param.key` → `param.name`。

**测试**:现有测试通过即可。

#### F10. submitBacktest 失败上抛(Important #9)

**文件**:
- `apps/web/src/api/tasks.ts:61`
- `apps/web/src/components/workspace-page.tsx:458`

**当前**:`.catch(() => ({ id: '', status: 'failed' }))` 返回空 id。`workspace-page.tsx:458` 不检查直接 `streamBacktestTask(taskId, ...)`,会请求 `/api/tasks//stream`。

**更新为**:
- `tasks.ts`:移除 `.catch`,让错误上抛
- `workspace-page.tsx`:`handleRunBacktest` 加 try-catch,catch 中设置 error state(显示"提交回测失败"),不再调 `streamBacktestTask`

**测试**:新增 1 个测试,模拟 fetch 失败,断言抛异常或设置 error state。

### 组 5:文档与状态修复

#### F11. apps/worker/README.md 同步(Important #11)

**文件**:`apps/worker/README.md`

**当前**:仍写"TaskQueue/queue.ts/Worker 主类/三个任务处理器"(第 8、14、17、28、29、36、38 行),违反根 AGENTS.md "每个子项目必须维护自己的 README.md"。AGENT.md 已改但 README 漏改。

**更新为**:与 AGENT.md 同步:
- 删除 TaskQueue、Worker 主类、queue.ts、worker.ts 相关行
- 补 5 个 handler(BacktestHandler/DiagnosticsHandler/FactorComputeHandler/FactorEvalHandler/CollectHandler/LoopHandler)
- 文件结构表对齐当前 src/ 实际结构

#### F12. plan 文档勾选(Important #12)

**文件**:`docs/superpowers/plans/2026-06-30-backend-sync-realign-integrated.md:1007-1008`

**当前**:已实现但 `[ ]` 未勾选。

**更新为**:`[x]`。

#### F13. story-8 重验

**文件**:`scripts/ralph/.prd.state.json`(已 gitignored,本地修改)

**改动**:
1. 修复全部 F1-F12 后,重置 `passesSnapshot` 中 `story-8` 为 `false`(或重置整个 story-8 状态)
2. 重跑全链路 4 轨道验收:
   - 轨道 A Param Wire:CLI listStrategies → API → 前端 ConfigPanel
   - 轨道 B Diagnostics transitional:Python → Worker → API → 前端
   - 轨道 C Backtest E2E:前端 → API → Worker → Python → report
   - 轨道 D 清理:queue.ts/worker.ts 删除确认、PythonBridge 替换确认
3. 通过后置 `story-8 passes: true`,更新 `.last-error.json` 无 detectedFailures

### 组 6:ralph harness 文件清理

#### F14. .gitignore 补全 + git rm --cached

**文件**:`.gitignore` + git 索引

**当前 .gitignore**(第 40-43 行)已忽略:
- `scripts/ralph/prd.json`
- `scripts/ralph/progress.txt`
- `scripts/ralph/.last-branch`
- `scripts/ralph/archive/`

**未忽略但被提交**:
- `scripts/ralph/.current-prompt.md`
- `scripts/ralph/.last-error.json`
- `scripts/ralph/.last-raw-output.txt`
- `scripts/ralph/.last-output.txt`
- `scripts/ralph/.prd.state.json`
- `.trae/skills/systematic-debugging/SKILL.md`
- `.trae/skills/writing-skills/SKILL.md`
- `CLAUDE.md`

**更新 .gitignore**:追加:
```
# Ralph autonomous agent loop (runtime artifacts) - extended
scripts/ralph/.current-prompt.md
scripts/ralph/.last-error.json
scripts/ralph/.last-raw-output.txt
scripts/ralph/.last-output.txt
scripts/ralph/.prd.state.json
scripts/ralph/.last-branch

# Trae skills (IDE-local)
.trae/

# CLAUDE.md (Claude Code local, not project-shared)
CLAUDE.md
```

**git rm --cached**(保留本地文件,仅从索引移除):
```bash
git rm --cached scripts/ralph/.current-prompt.md \
  scripts/ralph/.last-error.json \
  scripts/ralph/.last-raw-output.txt \
  scripts/ralph/.last-output.txt \
  scripts/ralph/.prd.state.json \
  .trae/skills/systematic-debugging/SKILL.md \
  .trae/skills/writing-skills/SKILL.md \
  CLAUDE.md
```

**CLAUDE.md 处理决策**:已确认 `CLAUDE.md` 当前仍存在(2026-07-02-root-md-realign-design spec 未落地)。本设计仅 `git rm --cached CLAUDE.md` + gitignore(保留本地文件),不删除文件内容。若 2026-07-02 spec 后续落地选择删除整个文件,以那个 spec 为准,本设计的 gitignore 行不冲突。

## 架构与数据流

### UIConstraint 修复后数据流(F7)

```
Python list_strategies → API mapMeta(双字段) → 前端 useStrategies.mapParam
  api.ui_constraints = [{target_field, target_value, action_value, ...}]  // snake
  ↓ 显式映射
  StrategyParam.uiConstraints = [{targetField, targetValue, actionValue, ...}]  // camel
  ↓
  ConfigPanel 中 c.targetField 正确读取,disable_when/require_when 约束恢复生效
```

### 元数据修复后数据流(F5)

```
Python list_strategies._camelize_params → 输出 label/type/default/options
  ↓ NDJSON
API strategy-sync.parseCLIOutput → camelToSnakeMeta 保留 label/type/default/options
  ↓
前端 useStrategies.mapParam → api.label/api.type/api.default/api.options 正确填充
  ↓
ConfigPanel 参数面板显示真实 label、类型、默认值、可选值,不再退化
```

### 测试夹具迁移后(F4)

```
backtest-handler.test.ts: 不再 import TaskQueue
  → 直接构造 mock configSnapshot + mock PythonBridge
  → 调 handler.handle({type:'backtest', payload:{...}})
  → 断言 handler 调用 PythonBridge 的入参
```

## 错误处理

- **F6 stdin error**:`proc.stdin.on('error', () => {})` 静默吞 EPIPE(进程已退出,无需处理),防止 unhandled stream error 崩 API
- **F10 submitBacktest**:移除 `.catch(() => ({id:'', status:'failed'}))`,让错误上抛;`workspace-page.tsx` `handleRunBacktest` 加 try-catch,catch 中设置 error state 显示"提交回测失败"
- **F2 _run_composite**:与 `_run_single` 同样的 `configSnapshot` 优先 + `strategyParams` fallback 逻辑,保持单一来源原则

## 测试要求

| 修复点 | 测试要求 |
|---|---|
| F1 删 stub 测试 | 无新增,确认 `test_diagnostics_transitional.py` 已覆盖 |
| F2 _run_composite | 新增 1 个测试:组合策略 + configSnapshot 优先级 |
| F3 删 queue/worker 测试 | 无新增 |
| F4 handler 测试夹具迁移 | 重写现有测试,断言 handler.handle 行为,测试数不少于原 |
| F5 元数据补全 | 扩展 `test_cli_list_strategies.py` 断言 label/type/default/options;扩展 `strategy-sync.test.ts` 断言映射 |
| F6 stdin error | 新增 1 个测试:模拟 Python 进程提前退出,断言 API 不崩 |
| F7 UIConstraint 映射 | 新增 1 个测试:mapParam 输入 snake_case ui_constraints,断言输出 camelCase |
| F8 删 strategy-grid | 确认 `pnpm build` 通过(无 import 残留) |
| F9 param.key→name | 现有测试通过即可 |
| F10 submitBacktest | 新增 1 个测试:fetch 失败时抛异常或设置 error state |
| F11/F12 文档 | 无测试 |
| F13 story-8 重验 | `pnpm test` 全包绿 + `pnpm build` + `pnpm lint` + Python 7 包 pytest 绿 |

## 验收标准

修复完成后必须同时满足:

1. `pnpm test` 全部通过(Worker 4 个失败测试已迁移或删除)
2. Python 7 个子包 `pytest` 全部通过(strategy-runtime stub 测试已处理)
3. `pnpm build` 5/5 成功
4. `pnpm lint` 0 errors
5. 手动验证:UIConstraint 在 ConfigPanel 中实际生效(可加临时 console.log 验证 disable_when 触发)
6. ralph `prd.state.json` story-8 `passes: true`,`.last-error.json` 无 detectedFailures
7. `git status` 确认 ralph harness 文件已从索引移除,本地文件保留

## 提交策略

按 story 边界分提交,与原 14 story 风格一致:

1. `fix: story-2-fix 删除 transitional stub 测试 + _run_composite snapshotParams 优先级`(F1, F2)
2. `fix: story-7c-fix Worker 测试夹具迁移 + 删除 queue/worker 测试`(F3, F4)
3. `fix: story-7b-fix strategy-sync 元数据补全 + stdin error handler`(F5, F6)
4. `fix: story-6-fix 前端 UIConstraint 映射 + 删 strategy-grid + param.key→name + submitBacktest 失败上抛`(F7-F10)
5. `docs: worker README + plan 勾选同步`(F11, F12)
6. `chore: ralph harness 文件 gitignore + git rm --cached`(F14)
7. `test: story-8 重验 全链路 4 轨道通过`(F13)

## 风险与回滚

- **F2 _run_composite 改动**:可能影响现有组合策略回测行为。回滚方式:git revert 该提交。测试覆盖优先级。
- **F5 元数据补全**:CLI 输出新字段可能破坏旧前端兼容。缓解:API 仍保留 deprecated 双字段,前端 mapParam 已双填。
- **F7 UIConstraint 映射**:若 API 实际返回的 ui_constraints 字段名与预期不符,映射后仍 undefined。缓解:新增测试用真实 API 响应样本。
- **F14 git rm --cached**:若误删未备份的本地文件。缓解:`git rm --cached` 仅移除索引,本地文件保留;提交前 `git status` 确认。

## 不在本设计内的事项

- deprecated `key` 字段彻底清理(下个 PR)
- 8 个 Minor 问题(DRY 重构、_parse_dates 死代码、p.min 边界、异常吞、kline-chart as any、setup.ts mock、API/Worker spawn+NDJSON 重复、ralph harness history 重写)
- strategy-grid.tsx 在另一分支的死代码处理
- 实盘执行层、权限系统、策略市场(AGENTS.md 硬性规则排除)
