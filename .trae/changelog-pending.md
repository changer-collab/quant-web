# Changelog Pending

> 本文件记录待提交的修改，commit 时由 commit-push-workflow.md 规则整理写入 CHANGELOG.md。

## 2026-07-07 数据源增强 & Parquet 导入（Phase 1 + P1 全部完成）

### 代码变更（P1-C/D/E/F）

- `services/data-center/src/storage/sqlite/connection.ts` — DDL valuations 表补 5 列 + runMigrations 追加 5 条 ALTER TABLE + external_records DDL
- `services/data-center/src/storage/schema.ts` — 新增 externalRecords 表定义
- `services/data-center/src/storage/sqlite/external-repo.ts` — 新建 SqliteExternalRecordRepository
- `services/data-center/src/storage/factory.ts` — 注册 SqliteExternalRecordRepository
- `services/data-center/src/repository/types.ts` — 新增 ExternalRecord/ExternalRecordQuery/ExternalRecordRepository 接口
- `services/data-center/src/repository/index.ts` + `src/index.ts` + `src/storage/sqlite/index.ts` — 导出链更新
- `services/data-collector/src/adapters/mootdx-adapter.ts` — 扩展 supportedDataTypes（trade_record/l2_snapshot/f10）+ buildFetchDataBlock
- `services/data-collector/src/cleaner.ts` — 新增 cleanTradeRecord/cleanLevel2Snapshot 等方法
- `services/data-collector/src/scheduler.ts` — writeToDataCenter 新增 trade_record/l2_snapshot/external 三个 case
- `services/data-collector/src/source-selector.ts` — 新增 11 类数据类型优先级链
- `services/data-collector/src/adapters/eastmoney/` — 新建目录：em-client.ts + base-adapter.ts + 8 个适配器 + index.ts
- `services/data-collector/src/adapters/parquet-adapter.ts` — 新建 ParquetAdapter（Python+pyarrow 桥接）
- `services/data-collector/src/adapters/types.ts` — 新增 ParquetExtra 类型
- `services/data-collector/src/adapters/index.ts` + `src/index.ts` — 导出链更新
- `services/data-center/src/commands/import-parquet.ts` — 新建 CLI 命令
- `services/data-center/src/base/types.ts` — TimeFrame 枚举扩展 W1/Mo1/Q1/Y1
- `services/data-center/src/fundamental/types.ts` — ValuationPoint 扩展 5 字段
- `services/data-center/src/storage/sqlite/fundamental-repo.ts` — save/query 处理新字段
- `services/data-collector/src/adapters/tencent-adapter.ts` — parseResponse 解析 43/47/48/49/52 字段

### 文档变更（P1-G）

- `services/data-collector/README.md` — 适配器 8→17、优先级链新增 11 类、scheduler 13 类分支、pyarrow 依赖
- `services/data-collector/AGENT.md` — 与 README 同步
- `services/data-center/AGENT.md` — Repository 17→21、测试 43→47、external_records 表、TimeFrame 扩展、DDL 迁移
- `README.md` — 项目结构表 data-collector 行更新适配器数量
- `docs/roadmap.md` — 已完成计划表追加数据源增强条目 + 真实数据接入进展更新
- `.gitignore` — 移除 `.trae/` 忽略行（让 hooks/rules/skills/agents 入库供团队共享）

### 新增测试

- `services/data-collector/tests/em-client.test.ts` — emClient 限流/重试/会话复用测试
- `services/data-collector/tests/parquet-adapter.test.ts` — ParquetAdapter 单元测试

### 验证结果

- `pnpm -r build` — 5 包编译通过
- `pnpm -r test` — 377/377 测试通过（data-center 47 + data-collector 69 + web 114 + api 122 + worker 25）
