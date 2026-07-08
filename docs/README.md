# 项目文档入口

> 本文件是 `docs/` 的阅读入口。新 Agent 或协作者先读这里，再按任务类型进入具体文档。

## 当前权威入口

| 场景                      | 先读文档                                                                                                                 | 说明                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 策略分类产品目标          | [strategy-class-design](./specs/2026-06-28-strategy-class-design.md) | 产品分类、配置、Preview、Task、Diagnostics 的目标基准（核心已落地）。                          |
| 项目优先级                | [roadmap](./roadmap.md)                                                                                                  | 当前待实施事项与历史完成计划。                                                   |
| 链条完整性状态            | [pipeline audit](./audits/pipeline-audit-2026-06-28.md)                                                                         | 研究链条缺陷审计，路线图优先级的依据。                                           |
| 本地环境与故障排除        | [dev workflow](./dev-workflow.md)                                                                                        | 环境要求、Python 包安装、Windows 故障排除、CI 流水线。                           |
| 变更历史                  | [CHANGELOG](../CHANGELOG.md)                                                                                              | 项目重要变更记录（临时记录在 `.trae/changelog-pending.md`，commit 时整理入库）。 |
| 项目记忆                  | `c:\Users\37588\.trae-cn\memory\projects\-d-quant-web\project_memory.md`                                                  | 项目硬约束、架构边界、已知陷阱、断点状态（AI 会话间记忆，不入库）。              |

## 策略分类主线文档关系

策略分类后端契约整合核心已落地（canonical 分类 / ConfigSnapshot / Preview / Task payload / ResultProcessor 注册表），剩余前端残留见 [roadmap](./roadmap.md) 待实施 #3。

| 文档                                                                                                                                             | 当前角色                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [2026-06-28-strategy-class-design.md](./specs/2026-06-28-strategy-class-design.md)           | 产品目标基准，定义分类、配置、Preview、Task、Diagnostics 目标态。 |
| [2026-06-30-contract-realign.md](./plans/archive/2026-06-30-contract-realign.md)                     | 历史整合计划，已归档（核心已落地）。                              |
| [2026-06-29-contract-sync.md](./plans/archive/2026-06-29-contract-sync.md) | 历史计划，已并入 06-30 整合计划。                                 |
| [2026-06-30-backend-realign.md](./plans/archive/2026-06-30-backend-realign.md)                                       | 历史结构整理设计，已并入 06-30 整合计划。                         |
| [2026-06-29-strategy-class-arch.md](./specs/2026-06-29-strategy-class-arch.md)                     | 历史架构记录，作为代码扫描和背景参考。                            |
| [2026-06-29-frontend-workflow.md](./plans/archive/2026-06-29-frontend-workflow.md)                    | 历史前端工作流草案，作为迁移背景参考。                            |

## 开发规范

| 文档                                                                            | 用途                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------- |
| [strategy-development-standard](./development/strategy-development-standard.md) | 新增或修改策略前阅读。                      |
| [factor-development-standard](./development/factor-development-standard.md)     | 新增或修改因子前阅读。                      |
| [data-usage-guide](./development/data-usage-guide.md)                           | 使用 `data/quant.db` 或 DataClient 前阅读。 |
| [crawler-data-spec](./development/crawler-data-spec.md)                         | 外部爬虫数据接入前阅读。                    |
| [回测报告框架](./development/回测报告框架.md)                                   | 回测报告字段、章节和展示口径参考。          |

## 历史设计与计划

| 文档                                                                                         | 当前角色                                                             |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [ralph-harness-design](./specs/2026-06-25-ralph-harness-design.md)               | Ralph harness 工程改进设计记录。                                     |
| [report-tiles](./specs/2026-06-27-report-tiles.md) | 回测报告关键词瓦片设计记录。                                         |
| [agent-and-loop](./plans/archive/2026-06-25-agent-and-loop.md)                                       | Agent 包装层与 LoopHandler 闭环计划，其中 LoopHandler 仍有残留工作。 |

## 文档维护规则

- 新的当前实施计划放在 `docs/plans/`。
- 稳定产品/架构目标放在 `docs/specs/`。
- 开发规范放在 `docs/development/`，不要和实施计划混写。
- 已完成/已取代的计划移到 `docs/plans/archive/`。
- 审计类报告放在 `docs/audits/`。
- 历史方案不删除；如果被新方案取代，在文件顶部注明"已并入/已取代"。
- 修改策略分类主线时，优先同步本入口和 [roadmap](./roadmap.md)。

### 文件命名标准

`docs/plans/` 和 `docs/specs/` 下的文件统一使用：

```
YYYY-MM-DD-<2-3 词短 slug>.md
```

- 日期前缀用于时序排序。
- slug 控制在 2-3 个词、约 20 字符以内，保证在文件列表中能完整看到。
- 完整描述性标题写在文件内 H1，不依赖文件名承载全部语义。
- 已有长名文件在归档或下次触及重命名时收敛到短 slug。
- 不要在 slug 中堆砌 `design` / `plan` / `implementation` 等冗余词，目录已经表达这层语义。

示例：`2026-07-07-algo-arch.md` 而非 `2026-07-07-algorithm-layer-architecture-design-and-implementation-plan.md`。
