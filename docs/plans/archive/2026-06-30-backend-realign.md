# 后端结构对齐前端 — 设计方案 (backend-realign)

> **状态：历史结构整理设计，已并入当前整合计划。** 后续执行请以 [../2026-06-30-contract-realign.md](../2026-06-30-contract-realign.md) 为准。本文保留为 06-30 后端结构整理方案的原始记录。

> **日期**: 2026-06-30
> **状态**: 设计已定稿；P0-P1 已拆为 `scripts/ralph/prd.json` 的 6 个 story；P2-P3 待排期。
> **目标**: 让后端的*内部结构与对外契约*对齐前端当前已演化出的领域模型，消除"按 story 逐个追加端点"积累的结构债。
> **范围边界**: 本方案聚焦*结构对齐*（契约漂移、上帝函数、路由碎片化），**不是**产品分类体系迁移。

## 关联文档（务必先读，避免范围重叠）

| 文档                                                                                  | 关系                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/specs/2026-06-28-strategy-class-design.md`      | 前端构建的**目标产品基准**（分类/配置/Preview/诊断）                                                                                                                                 |
| `docs/plans/2026-06-29-backend-sync-to-strategy-classification-target.md` | **另一条更激进的轨道**：把后端迁到 06-28 _目标 taxonomy_（canonical 枚举、完整 ConfigSnapshot、诊断算法、13 tasks/8 phases）。本方案与其互补：那条管"产品正确性"，本方案管"结构整洁" |
| `scripts/ralph/prd.json` (feature: backend-realign)                                   | 本方案 **P0-P1** 的可执行落地（6 个 story）                                                                                                                                          |

> ⚠️ 两条轨道有边缘重叠：06-29 计划的 Task 4（Repo 走 DI）、Task 6（SSE resultId/resultType）与本方案的 P0b/P1b 触碰同一批文件。落地时若两者并行，需协调 `apps/api/src/routes/task.ts` 的改动顺序，避免互相覆盖。

---

## 一、诊断结论：问题不是缺接口，是结构错位

三层全扫过后的反直觉结论：**前后端接口清单几乎对齐**——前端假设的 19 个端点后端全有。真正的错配在三类：

1. **契约漂移** — 少数关键类型在前后端定义不一致（任务类型枚举、`DiagnosticResult`、结果信封）
2. **内部组织不反映领域** — 策略路由碎成三块、完成回调里塞了一个上帝函数
3. **冗余/死基础设施** — 两套 Python 桥接、死掉的 worker 队列、三份重复的分类枚举

根因：前端在 Ralph 故事驱动下演化出清晰领域模型（策略分类 → 配置 → 工作区流程「诊断→回测」→ 报告/诊断历史 + 因子实验室 + 数据），后端却按"谁先加放哪"长，组织方式没反映领域边界。

---

## 二、错配清单（前端期望 vs 后端现状）

| #   | 前端期望 / 现状                                                                                                         | 后端现状                                                                                                                  | 问题                                | 严重度 | 落点           |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------ | -------------- |
| 1   | `ApiTaskType = 'backtest'\|'factor_compute'\|'factor_eval'\|'ai_train'`，但 WorkspacePage 实际提交 `type:'diagnostics'` | `TaskType` 枚举 6 个值（含 `Collect`/`Diagnostics`）                                                                      | 前端类型定义是假的，提交时绕过它    | 高     | P0a            |
| 2   | 前端 `DiagnosticResult` **无** `category`，靠 `dataJson.type` 推断                                                      | 后端 `DiagnosticResult.category: StrategyCategory`（types.ts:426）                                                        | 同名类型跨边界形状不同              | 高     | P0a            |
| 3   | 诊断请求里前端传 `category` 作真值源                                                                                    | 分类其实在 Python `StrategyMeta` 已声明（权威）                                                                           | 前端冒充真值源，可能与元数据不一致  | 高     | P0b/06-29 计划 |
| 4   | SSE `result`：诊断 `{resultId,resultType}`、回测 `{backtestResult,analysis}`                                            | `complete` 回调临时拼装，无统一信封                                                                                       | 前端只能 ad-hoc 嗅探，无类型契约    | 中     | P0a+P0b        |
| 5   | 把 `/api/strategies` 当一个资源                                                                                         | 该前缀被 `strategyRoutes`+`configRoutes`+`previewRoutes` **三模块**分别注册（app.ts:34,41,42）                            | 一个资源散在三处                    | 中     | P1a            |
| 6   | —                                                                                                                       | `/:id/complete` 回调 ~155 行：诊断落库+报告映射+AI 合并+surrogate 清洗（task.ts:113-270）                                 | HTTP 路由里堆领域后处理，最大坏味道 | 高     | P1b+P1c        |
| 7   | —                                                                                                                       | `ReportRepository` 在 handler 里 `new`（task.ts:150），其余 service 走 `app.decorate`                                     | DI 不一致                           | 低     | P1b            |
| 8   | —                                                                                                                       | 策略元数据走 `exec`+**内联 Python 脚本串**（strategy-sync.ts，硬编码 `\\packages\\strategies`）；worker 走 `spawn`+NDJSON | 两套不同 Python 通信机制            | 中     | P2             |
| 9   | —                                                                                                                       | `apps/worker/src/queue.ts`（better-sqlite3，~221 行）在 `main.ts` **未被引用**                                            | 死代码 + 误导性"第二存储"           | 中     | P3             |
| 10  | —                                                                                                                       | `StrategyCategory`/`Subcategory` 在 Python/API/前端**各定义一份**                                                         | 三份枚举会漂移                      | 中     | P2/06-29 计划  |

> **已验证**: #9 经 `main.ts` 通读确认 —— worker 是纯 HTTP 轮询器（poll `/api/internal/tasks/pending`），`queue.ts` 的本地 SQLite 队列从未被 import，是死代码。这也符合 AGENTS.md line 143「Worker 不得与 API 共享内存队列」。

---

## 三、目标架构（受 AGENTS.md 约束修正后）

> **重要修正**：我最初构想的 `domains/` + `platform/` + `contracts/` 物理重组，与 AGENTS.md 冲突，已放弃：
>
> - **line 75「不设中转包」**：禁止 `contracts/` 共享包。改为各 `types.ts` 镜像 + 值对齐。
> - **KISS + line 158「不修改无关文件」**：整树物理搬迁会 churn 几十个 import，收益低。改为只做*逻辑*重组。

保留的高价值结构改动（不动目录树）：

1. **统一 `/api/strategies` 所有权** — catalog/config/preview 合进一个 strategy 路由模块，一次 `register`。
2. **抽出 `ResultProcessor`** — `/:id/complete` 退化为「落库 task → 按 `task.type` 查注册表 → 调对应 processor」。路由从 155 行降到 ~20 行，对新任务类型开放封闭。
3. **Repo 走 DI** — `ReportRepository` 经 `app.decorate` 注入，与其余 service 一致；API 层回归"薄"（AGENTS.md line 24）。
4. **带类型的结果信封** — 可辨识联合 `TaskResult`，worker 产出 / API 转发 / 前端 SSE 分支共用同一份（各 `types.ts` 镜像）。

---

## 四、7 个重构动作 A1–A7（完整版，含未排期项）

| 动作   | 内容                                                                                        | 消除错配 | 落点                                        |
| ------ | ------------------------------------------------------------------------------------------- | -------- | ------------------------------------------- |
| **A1** | 统一 `/api/strategies` 所有权，一次 register                                                | #5       | P1a (story-3)                               |
| **A2** | 从完成回调抽出 `ResultProcessor` + 注册表，handler 退化为分派                               | #6/#7    | P1b+P1c (story-4,5)                         |
| **A3** | 定义带类型的结果信封（可辨识联合 `TaskResult`）                                             | #4       | P0a+P0b (story-1,2)                         |
| **A4** | 统一 Python 通道：CLI 加 `listStrategies` 子命令，catalog 改走 `PythonBridge`，删内联脚本串 | #8       | **P2（未排期）**                            |
| **A5** | 分类枚举单一真值源：Python `StrategyMeta` 权威，API 派生，前端共享/codegen                  | #10      | **P2（未排期）**，与 06-29 计划 Task 1 重叠 |
| **A6** | 修 `category` 冗余：诊断任务不再要前端传 `category`，后端从元数据解析                       | #3       | **P2（未排期）**，与 06-29 计划 Task 6 重叠 |
| **A7** | 对齐 `DiagnosticResult` 形状：给前端契约补 `category`，统一一份                             | #2       | P0a (story-1)                               |

---

## 五、分阶段实施（按风险/价值排序）

| 阶段                   | 内容                                                                     | 风险 | 改动面               | 价值                 | 状态                 |
| ---------------------- | ------------------------------------------------------------------------ | ---- | -------------------- | -------------------- | -------------------- |
| **P0 契约对齐**        | A3/A7/#1：定义 `TaskResult`，补 `category`、修 `ApiTaskType`、立结果信封 | 低   | 类型为主，行为不变   | 高，立刻止血漂移     | **已拆 story-1,2**   |
| **P1 后端域重组**      | A1/A2：合并策略路由、抽 `ResultProcessor`、Report 走 DI                  | 中   | 纯内部，不动对外契约 | 高，清掉上帝函数     | **已拆 story-3,4,5** |
| **P2 Python 通道统一** | A4/A5/A6：CLI 加 `listStrategies`，catalog 改走 `PythonBridge`，枚举单源 | 中   | 跨 API+Python 包     | 中，消除脆弱内联脚本 | **未排期**           |
| **P3 收尾清理**        | 删 worker 死队列（`queue.ts` + better-sqlite3 依赖）                     | 低   | 删代码为主           | 中，降噪             | **未排期**           |

P0 → P1 → P2 → P3，每阶段独立可交付。P0 单独即可止血。

### 为何 P2/P3 未排进当前 PRD

- **P2** 与 `2026-06-29-backend-sync` 计划的 Task 1/6/8 高度重叠（都碰 Python 枚举、CLI、诊断参数透传）。若那条轨道先跑，A4/A5/A6 大部分会被顺带解决。**建议**：P2 不单独排，等 06-29 轨道定调后再看残留。
- **P3** 是纯删死代码，零依赖、零风险，**可随时单独提一个 1-story PRD**，或并入任意一次 worker 改动。

---

## 六、P0-P1 的 6 个 story（已写入 prd.json）

```
story-1 (P0a 类型契约)          ─┐
  └─ story-2 (P0b 运行时贯通) ──┼─→ story-6 (端到端验收)
story-3 (P1a 路由统一) ─────────┤
  story-4 (P1b 回测处理器+DI)   │
    └─ story-5 (P1c 诊断处理器+注册表) ─┘
```

| ID      | 阶段 | 做什么                                                                                  | Agent           |
| ------- | ---- | --------------------------------------------------------------------------------------- | --------------- |
| story-1 | P0a  | 判别式 `TaskResult` 信封 + 前端补 `category` + `ApiTaskType` 补 `diagnostics`（纯类型） | fullstack-agent |
| story-2 | P0b  | API 下发判别式 result + 前端 SSE 按 `resultType` 分派                                   | fullstack-agent |
| story-3 | P1a  | `/api/strategies` 三模块合并单次注册                                                    | api-agent       |
| story-4 | P1b  | 抽 `BacktestResultProcessor`（报告映射/AI合并/清洗移出 HTTP）+ Repo 走 DI               | api-agent       |
| story-5 | P1c  | 抽 `DiagnosticsResultProcessor` + 注册表，complete handler 退化为分派（≤25 行）         | api-agent       |
| story-6 | 验收 | 诊断/回测全链路 + 契约一致性，无代码改动                                                | fullstack-agent |

详细描述与验收标准见 `scripts/ralph/prd.json`。

---

## 七、关键决策记录

1. **不建 `contracts/` 中转包** — 遵循 AGENTS.md line 75，各 `types.ts` 镜像 + 值对齐。
2. **不做 `domains/`/`platform/` 物理搬迁** — KISS，只做逻辑重组（路由收拢 + 上帝函数拆解 + DI），不动目录树。
3. **P2/P3 不进当前 PRD** — P2 与 06-29 轨道重叠，待其定调；P3 零风险可随时单提。
4. **质量门只保留 `js`** — 本轮（P0-P1）不碰 Python 包，故 prd.json 的 qualityChecks 去掉 python pytest，缩短迭代。
5. **本方案 vs 06-29 计划并行风险** — 两者都改 `task.ts`，落地需协调改动顺序（见顶部 ⚠️）。
