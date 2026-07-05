# 项目文档入口

> 本文件是 `docs/` 的阅读入口。新 Agent 或协作者先读这里，再按任务类型进入具体文档。

## 当前权威入口

| 场景                      | 先读文档                                                                                                                 | 说明                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 当前后端/前端契约整合实施 | [backend-sync-realign-integrated](./plans/2026-06-30-backend-sync-realign-integrated.md)                     | 当前策略分类主线的实施入口，已整合 06-29 backend-sync 与 06-30 backend-realign。 |
| 策略分类产品目标          | [strategy-classification-and-config-design](./specs/2026-06-28-strategy-classification-and-config-design.md) | 产品分类、配置、Preview、Task、Diagnostics 的目标基准。                          |
| 项目优先级                | [roadmap](./roadmap.md)                                                                                                  | 当前待实施事项与历史完成计划。                                                   |
| 链条完整性状态            | [pipeline audit](./audits/pipeline-audit-2026-06-28.md)                                                                         | 研究链条缺陷审计，路线图优先级的依据。                                           |
| 开发环境与测试            | [dev workflow](./dev-workflow.md)                                                                                        | 本地安装、启动、测试命令。                                                       |

## 策略分类主线文档关系

当前实施以 [2026-06-30-backend-sync-realign-integrated.md](./plans/2026-06-30-backend-sync-realign-integrated.md) 为准。

| 文档                                                                                                                                             | 当前角色                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| [2026-06-30-backend-sync-realign-integrated.md](./plans/2026-06-30-backend-sync-realign-integrated.md)                               | 当前执行计划，解决契约迁移和后端结构整理。                        |
| [2026-06-28-strategy-classification-and-config-design.md](./specs/2026-06-28-strategy-classification-and-config-design.md)           | 产品目标基准，定义分类、配置、Preview、Task、Diagnostics 目标态。 |
| [2026-06-29-backend-sync-to-strategy-classification-target.md](./plans/2026-06-29-backend-sync-to-strategy-classification-target.md) | 历史计划，已并入 06-30 整合计划。                                 |
| [2026-06-30-backend-realign-design.md](./plans/archive/2026-06-30-backend-realign-design.md)                                                             | 历史结构整理设计，已并入 06-30 整合计划。                         |
| [2026-06-29-strategy-classification-architecture.md](./specs/2026-06-29-strategy-classification-architecture.md)                     | 历史架构记录，作为代码扫描和背景参考。                            |
| [2026-06-29-frontend-workflow-reconciliation.md](./plans/archive/2026-06-29-frontend-workflow-reconciliation.md)                                         | 历史前端工作流草案，作为迁移背景参考。                            |

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
| [report-keyword-tiles-design](./specs/2026-06-27-report-keyword-tiles-design.md) | 回测报告关键词瓦片设计记录。                                         |
| [agent-and-loop](./plans/archive/2026-06-25-agent-and-loop.md)                                       | Agent 包装层与 LoopHandler 闭环计划，其中 LoopHandler 仍有残留工作。 |

## 文档维护规则

- 新的当前实施计划放在 `docs/plans/`。
- 稳定产品/架构目标放在 `docs/specs/`。
- 开发规范放在 `docs/development/`，不要和实施计划混写。
- 已完成/已取代的计划移到 `docs/plans/archive/`。
- 审计类报告放在 `docs/audits/`。
- 历史方案不删除；如果被新方案取代，在文件顶部注明"已并入/已取代"。
- 修改策略分类主线时，优先同步本入口和 [roadmap](./roadmap.md)。
