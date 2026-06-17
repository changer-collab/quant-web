# services/data-center/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 数据中心是独立基础设施，不是网站后端。
- 不把策略、回测、AI 训练逻辑放进数据中心。
- 不直接依赖回测引擎或策略库。
- 不负责数据采集，数据由 `services/data-collector` 写入。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
存储层和 Provider 实现已完成（SQLite + Drizzle ORM），43 个测试通过；新增 shareholder_metrics 表及 Repository 实现；生命周期管理（CloseError + 并发安全 close + PIT 过滤）已完成
```

## 已有能力

```text
- 6 个数据子域的类型定义和 Provider 接口
- Repository 抽象接口（存储层与业务层解耦）
- Drizzle ORM Schema（SQLite / PostgreSQL 共用）
- SQLite 存储实现（17 个 Repository：含 shareholder_metrics）
- Provider 实现（6 个 Provider）
- 工厂函数 createDataCenter()
- 统一导出：src/index.ts
- CloseError 错误类型 + saveDbToFile/连接创建错误包装
- 并发安全 close（双关保护 + 超时 + 钩子）
- PIT 过滤（全部基本面查询支持 asOfDate 参数）
```

## 架构

```
Provider（查询接口，面向消费者）
    ↓ 依赖
Repository（存储抽象接口，面向实现）
    ↓ 实现
SQLiteRepository（现在）  →  PostgreSQLRepository（未来）
```

- **Provider** — 消费者只看 Provider 接口，不感知底层存储
- **Repository** — 每个子域一个 Repository 接口，SQLite 和 PG 实现同一套接口
- **Drizzle ORM** — Schema 定义一次，切换数据库只需改 driver

## 边界

只负责：

```text
数据存储（SQLite 本地持久化，未来可切换 PostgreSQL）
数据标准化（子域类型定义）
数据覆盖率
数据质量检查
数据查询（Provider 接口）
```

不负责

```text
数据采集（data-collector 负责）
策略逻辑
回测逻辑
AI 训练逻辑
HTTP API
真实下单
```

## PostgreSQL 迁移路径

切换 PostgreSQL 时只需：
1. 安装 `pg` + `drizzle-orm/pg-driver`
2. 在 `src/storage/postgres/` 下创建 PG 版 Repository 实现
3. 修改 `factory.ts`：将 `createSqliteRepositorySet` 替换为 `createPostgresRepositorySet`
4. 运行 `drizzle-kit push` 创建 PG 表结构
5. 数据迁移：编写一次性脚本将 SQLite 数据导入 PG

**Provider 层和上层消费者零改动。**

详细步骤参见 `src/storage/postgres/README.md`。

## 依赖

```text
drizzle-orm — ORM（SQLite / PostgreSQL 双驱动）
sql.js      — SQLite WASM 驱动（零编译，本地开发用）
```

data-center 是独立项目，不依赖任何 @quant 包。所有数据类型（Instrument, Bar, Tick, TimeFrame, MarketEvent, ResearchMode 等）由 data-center 自行定义并导出，供上层消费。

## 拥有的类型

```text
TimeFrame, Instrument, Bar, Tick, MarketEvent, ResearchMode
```

## 被依赖方向

```text
services/data-collector -> services/data-center
apps/api -> services/data-center
apps/worker -> services/data-center
```
