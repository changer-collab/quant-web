# services/data-center

`services/data-center` 是通用数据服务，不绑定任何上层业务，可独立部署供多项目消费。只负责存储、标准化和查询，不负责数据采集。

## 当前阶段

```text
存储层和 Provider 实现已完成（SQLite + Drizzle ORM），可正常读写；新增 shareholder_metrics 表及相关 Repository 实现
```

## 已完成

```text
- 6 个数据子域的类型定义和 Provider 接口
- Repository 抽象接口（存储层与业务层解耦）
- Drizzle ORM Schema（SQLite / PostgreSQL 共用）
- SQLite 存储实现（17 个 Repository：含 shareholder_metrics）
- Provider 实现（6 个 Provider）
- 工厂函数 createDataCenter()
- 统一导出：src/index.ts
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

## 数据子域

| 子域 | 目录 | 职责 |
|------|------|------|
| 参考数据 | `reference/` | 交易日历、扩展标的、指数成分、复权因子 |
| L1 行情 | `market/` | 扩展 K 线、扩展 Tick |
| L2 行情 | `l2/` | 盘口快照、逐笔成交、逐笔委托 |
| 基本面 | `fundamental/` | 财报三表、财务比率、估值快照、股东人数（默认 PIT 过滤） |
| 资讯事件 | `event/` | 公告事件、新闻、情绪指标、宏观指标 |
| 数据质量 | `quality/` | 完整性检查、一致性检查 |

## 目录结构

```
src/
  base/           基础类型（TimeFrame, Instrument, Bar, Tick）
  reference/      参考数据类型 + Provider 接口
  market/         L1 行情类型 + Provider 接口
  l2/             L2 行情类型 + Provider 接口
  fundamental/    基本面类型 + Provider 接口
  event/          资讯事件类型 + Provider 接口
  quality/        数据质量类型 + Provider 接口
  repository/     Repository 抽象接口
  storage/        存储实现
    schema.ts     Drizzle ORM Schema
    factory.ts    工厂函数（createDataCenter）
    sqlite/       SQLite 实现
    postgres/     PostgreSQL 占位（待实现）
  provider/       Provider 实现（依赖 Repository）
  index.ts        统一导出
```

## 用法

```typescript
import { createDataCenter, TimeFrame } from '@quant/data-center';

// 创建数据中心（默认 SQLite，路径 data/quant.db）
const dc = createDataCenter();
// 或指定路径
const dc = createDataCenter({ dbPath: '/path/to/quant.db' });

// 写入数据（data-collector 用）
await dc.repos.bars.save([{ symbol: 'CSI500', timeframe: TimeFrame.D1, ... }]);

// 查询数据（上层用）
for await (const bar of dc.providers.market.loadBars('CSI500', TimeFrame.D1)) {
  console.log(bar.close);
}
```

## PostgreSQL 迁移路径

当项目部署到服务器时，切换 PostgreSQL 只需：

1. 安装依赖：`pnpm add pg drizzle-orm/pg-driver`
2. 在 `src/storage/postgres/` 下创建 PG 版 Repository 实现
3. 修改 `factory.ts`：将 `createSqliteRepositorySet` 替换为 `createPostgresRepositorySet`
4. 运行 `drizzle-kit push` 创建 PG 表结构
5. 数据迁移：编写一次性脚本将 SQLite 数据导入 PG

**Provider 层和上层消费者（api、worker）零改动。**

详细步骤参见 `src/storage/postgres/README.md`。

## 依赖

```text
drizzle-orm — ORM（SQLite / PostgreSQL 双驱动）
sql.js      — SQLite WASM 驱动（零编译，本地开发用）
```

data-center 是独立项目，不依赖 @quant/common。所有数据类型由 data-center 自行定义并导出。

## 不负责

```text
数据采集（data-collector 负责）
策略逻辑
回测逻辑
AI 训练逻辑
HTTP API
真实下单
```

## 被依赖方向

```text
services/data-collector -> services/data-center
apps/api -> services/data-center
apps/worker -> services/data-center
```

## 验证

```bash
pnpm --filter @quant/data-center build
pnpm --filter @quant/data-center test
```
