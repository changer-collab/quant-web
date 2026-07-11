# CHANGELOG

> 本文件记录项目重要变更。临时修改记录在 `.trae/changelog-pending.md`，commit 时整理写入本文件。

## [changer] 2026-07-11 — 策略研究沉淀阶段一：候选采集

### 新增
- API：研究过程、研究事件和 Git 游标 SQLite 持久化；手动灵感、候选编辑、结束研究、待归类查询及 Worker 内部事件接口。
- Worker：Git 增量采集器（首次 HEAD 基线、提交去重、文件清单、保守策略归属）与回测提交/完成事件上报。
- Web：研究沉淀页面，消费真实 API 并支持候选编辑、事件排除、手动灵感和结束本轮研究。
- 测试：API 研究路由、Worker GitCollector、Worker 回测研究事件和前端导航覆盖。

## [changer] 2026-07-10 — Workspace 卡片化改造 + K 线修复 + 模型选择功能

**开发者**: GLM-5.2 (Trae)

### 新增
- Workspace 页面卡片化与视觉分隔：统一卡片样式系统（.card/.cardHeader/.cardBody/.cardTitle），config tab 两栏卡片包装，诊断 tab chartCard 升级（阴影+圆角+头部分隔），ConfigPanel section 嵌套子卡片
- 模型选择功能：apps/api 新增 models 路由，apps/web 新增 models API client，strategy-runtime 新增 list_models CLI 命令
- apps/web/tests/workspace-card.test.tsx：卡片 className 断言测试
- scripts/check-env.ps1：环境检查脚本
- docs/startup-troubleshooting.md：启动故障排除指南
- docs/superpowers/：SDD 流程文档（spec + plan）

### 修复
- K 线图 404 修复：preview 数据加载与 overlay 类型不匹配修复
- kline-chart 容器去背景（由父卡片提供背景）

### 改进
- useResearchWorkflow hook 重构（428 行精简）
- config-panel 模型选择 UI
- apps/worker collect-handler 与 python-bridge 调整
- packages/strategies ai_predictor 算法配置化
- services/data-collector bootstrap 调整
- AGENT.md 文档更新

### 重构
- 删除旧组件 strategy-table.tsx、workspace.tsx（被 workspace-page.tsx 替代）
- 删除对应测试 strategy-table.test.tsx

---

## [changer] 2026-07-08 — 文档维护：命名标准改革 + 过时计划归档 + 跨引用修复

**开发者**: Kimi-K2.7-Code (Trae)

### 文档
- `docs/README.md`：新增文件命名标准（`YYYY-MM-DD-<2-3 词短 slug>.md`）；修正 contract-sync 归档路径；更新所有文件名引用
- `docs/dev-workflow.md`：重新定位为"本地开发环境与故障排除指南"，与 `.trae/rules/quant-web-workflow.md`（AI Agent 工作流）划清边界；精简与 README.md 重叠内容；新增 algorithms 包到 Python 包列表和 CI 说明
- `docs/roadmap.md`：新增"策略分类后端契约整合"已完成条目；待实施计划重新编号
- `README.md`：项目结构表新增 packages/algorithms 和 packages/loop-engine；ai-engine 描述更新为"委托算法层"；mermaid 图新增 ALG 节点和 AI→ALG 边
- `AGENT.md`：当前阶段 plan 引用更新为归档路径 `docs/plans/archive/2026-06-30-contract-realign.md`

### 重构
- 8 个 plan 文件重命名为短 slug：7 个已完成计划移入 `docs/plans/archive/`，1 个当前计划就地重命名
- 7 个 spec 文件重命名为短 slug
- 删除重复文件 `docs/specs/2026-07-02-root-md-realign-design.md`
- 全量更新 docs/ 下 14 个文件的跨引用，消除所有旧文件名残留

### 基础设施
- `.github/workflows/ci.yml`：补充 `packages/algorithms` 到 Python Job 和 smoke test

---

## [changer] 2026-07-07 — 数据源增强 & Parquet 导入（Phase 1 + P1 全部完成）

**开发者**: Kimi-K2.7-Code (Trae)

### 新增
- 东财统一 HTTP 客户端（emClient）+ EastMoneyBaseAdapter 抽象基类：串行队列、≥1s 限流、429/5xx 重试、会话复用
- 8 个东财适配器：龙虎榜、限售解禁、融资融券、大宗交易、分红送转、研报、热门股、北向资金
- ParquetAdapter（Python + pyarrow 桥接）：流式读取 parquet，支持 bar/tick/trade_record/order_record/l2_snapshot
- import-parquet CLI 命令：扫描 `E:\quant-data\bars\*` 批量导入 SQLite
- external_records 通用表 + SqliteExternalRecordRepository：承载东财 8 类扩展数据及未来因子结果
- mootdx 适配器增强：支持 trade_record / l2_snapshot / f10

### 改进
- TimeFrame 枚举扩展：新增 W1='1w' / Mo1='1mo' / Q1='1q' / Y1='1y' 周/月/季/年线
- TencentAdapter 字段补全：新增 5 日均量、量比、委差、涨停、跌停解析
- valuations 表新增 5 列（limit_up/limit_down/volume_ratio/order_imbalance/avg_volume_5d）+ connection.ts DDL 增量迁移
- 数据源优先级链扩展 11 类新数据类型
- scheduler writeToDataCenter 分支从 10 类扩展到 13 类（trade_record / l2_snapshot / external）

### 文档
- `services/data-collector/README.md` + `AGENT.md`：适配器 8→17、优先级链、DataCleaner/scheduler 类型、pyarrow 依赖
- `services/data-center/AGENT.md`：Repository 17→21、external_records 表、TimeFrame 扩展、DDL 迁移
- `README.md`：项目结构表 data-collector 行更新适配器数量
- `docs/roadmap.md`：追加数据源增强已完成条目 + 真实数据接入进展

### 基础设施
- `.gitignore` 移除 `.trae/` 忽略行，让 hooks/rules/skills/agents 入库供团队共享

### 验证
- `pnpm -r build` 5 包编译通过
- `pnpm -r test` 377/377 测试通过（data-center 47 + data-collector 69 + web 114 + api 122 + worker 25）

---

## [2026-07-06] 文档全量同步 + hooks 维护增强

**开发者**: GLM-5.2 (Trae)

### 文档
- 补 4 个缺失的 AGENT.md：`packages/backtest-engine`、`packages/ai-engine`、`packages/factor-lab`、`packages/strategies`（参照 strategy-runtime/AGENT.md 模板，基于代码调研编写）
- 创建 `c:\Users\37588\.trae-cn\memory\projects\-d-quant-web\project_memory.md`（项目硬约束、架构边界、已知陷阱、断点状态、hooks 维护约定）
- 修正 `CLAUDE.md`：QuantWeb → QuantForge，技术栈从 Express 更新为 Fastify + SSE，补全包结构说明
- 更新 `README.md` 断点表：断点 1（backtest→obsidian-sync）✅ 已修复，断点 4（backtest→web）✅ 已打通，其他断点标注未修复状态
- 修正 `apps/web/README.md`：删除"API 失败时降级到 mock"过时描述，统一为"不降级到 mock"（与 AGENT.md 规则一致）
- 修正 `apps/api/README.md`：InMemoryTaskService → SqliteTaskService（默认持久化实现），删除已完成的后续职责

### hooks
- 新增 PostToolUse hook（matcher: Edit/Write）：文档同步提醒，检测被修改文件是否属于文档同步链路
- 新增文档一致性检查 hook：检查 AGENT.md 是否存在、@include 引用是否断裂
- 更新 `.trae/hooks.json` 注册新 hooks
- 更新 `.trae/rules/superpowers.md` runtime contract 反映新增文档维护 hooks
- 修复 PowerShell 脚本编码：UTF-8 无 BOM → UTF-8 with BOM（Windows PowerShell 默认 GBK 读取会乱码）

### 已知缺口（本次未修复，记录待后续处理）
- `validate-package.ps1` 报 exit 1（预先存在的失败，非本次引入）：
  - `user-prompt-submit.ps1` 被 quant-web-workflow 自定义替换了内容，不再包含 Superpowers 标准提醒词（executing-plans / test-driven-development / strongest available subagent / "Do not claim .trae/agents is missing"）
  - `pre-run-command-guard.ps1` 未拦截 Markdown 执行、destructive git cleanup、删除 `.trae/hooks.json` 等危险操作
- 处理建议：本次仅记录，不修改 Superpowers 标准脚本，避免引入新风险；待后续与 quant-web-workflow 维护者协调后再统一调整

### 文档补充更新（验收反馈 + 缺失 AGENT.md 补建）

**验收反馈修复（用户指出的过时描述）：**
- `services/data-collector/README.md` 数据源优先级表过时：6 → 8 适配器，新增 mootdx（TCP 直连通达信）和 tencent（HTTP 腾讯财经 valuation）说明，pip install 加 mootdx
- `services/data-collector/AGENT.md` 同步适配器清单
- `AGENT.md`（根级）"6 数据源适配器" → "8 数据源适配器"
- `README.md`（根级）"6 数据源适配器" → "8 数据源适配器"
- `apps/api/README.md` 删除过时的"后续职责：TaskService 持久化实现（替换 InMemoryTaskService）"（已实现 SqliteTaskService）
- `docs/development/strategy-development-standard.md` 旧策略分类值更新为 canonical 值：FACTOR_BASED/NON_FACTOR/TRANSITIONAL + 10 子分类
- `apps/web/README.md` "API 失败/无数据时降级到 mock" → "展示空状态，不降级到 mock"（与 AGENT.md 规则一致）
- `apps/worker/AGENT.md` 2 处过时措辞修正：worker.ts 死代码描述、内存队列后续扩展描述
- `packages/strategy-runtime/AGENT.md` 拥有的类型清单补 StrategyCategory/StrategySubcategory（canonical 三类十值，TS 层镜像）

**缺失 AGENT.md 补建：**
- 新建 `packages/obsidian-sync/AGENT.md`：基于代码调研编写（SyncService/ObsidianClient/builders/依赖/运行约束）
- 新建 `packages/data-client/AGENT.md`：基于代码调研编写（DataClient/query_bars/query_bars_df/list_symbols/list_instruments/get_active_symbols）
- `AGENTS.md` 添加 2 行 @include 引用（obsidian-sync、data-client）
- `AGENTS.md` 4 个章节补全角色定义：角色定义、能力边界、工作范围、角色专属规则（obsidian-sync Agent + 数据客户端 Agent）
- `.trae/hooks/check-doc-consistency.ps1` requiredAgentMd 列表补 obsidian-sync 和 data-client 两项

**验证：**
- `.trae/hooks/check-doc-consistency.ps1` 运行结果：exit 2（所有必需文档齐全，7 个推荐 README.md 缺失为预先存在 warning，非本次引入）

**工具异常记录（已知问题，未深查根因）：**
- Edit/Write 工具对部分文件（CHANGELOG.md、apps/api/README.md、apps/web/README.md）显示成功但磁盘未变更，改用 Python 脚本直接写文件解决
- Read 工具显示会话缓存而非磁盘真实内容，需用 `cmd /c type` 或 Grep 验证磁盘真实内容
- PowerShell 5.x 用 GBK 解读 UTF-8 脚本中的中文会乱码，脚本文件需保存为 UTF-8 with BOM

---

## [ralph/backend-sync-realign-phase6-9] 2026-07-06 — 补充 .skills 跨工具说明与 Trae 薄包装指针机制
**开发者**: Codex

### 文档
- `.skills/README.md` "跨工具使用"一节重构：明确 `.skills/` 为 skill 唯一真源（入库、团队共享、跨工具），新增"Trae 薄包装指针"小节说明 `.trae/skills/<name>/` 下薄包装的设计边界与新增 skill 时的同步规则
- 新建 4 个薄包装 SKILL.md（`.trae/skills/` 下，IDE-local 不入库）：quantforge-code-review、ralph-harness、quantforge-error-patterns、fix-python-encoding；frontmatter 照抄真源 `name`/`description` 保持触发词一致，正文要求 AI 立即 Read `.skills/<name>/SKILL.md` 真源并遵循其指令

---
