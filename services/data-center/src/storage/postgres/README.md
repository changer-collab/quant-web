# PostgreSQL 存储实现（占位）

当前数据中心使用 SQLite 作为本地存储。当项目部署到服务器时，可切换到 PostgreSQL。

## 迁移步骤

1. 安装依赖：`pnpm add pg drizzle-orm/pg-driver`
2. 创建 `connection.ts`：使用 `drizzle(pg)` 创建连接
3. 创建各子域的 `PgXxxRepository`，实现同一套 `Repository` 接口
4. 修改 `factory.ts`：将 `createSqliteRepositorySet` 替换为 `createPostgresRepositorySet`
5. 运行 `drizzle-kit push` 创建 PG 表结构
6. 数据迁移：编写一次性脚本将 SQLite 数据导入 PG

## 关键约束

- Schema 定义（`src/storage/schema.ts`）使用 `sqliteTable`，切换 PG 时需改为 `pgTable`
- 建议使用 Drizzle 的 `defineSchema` 抽象，或维护两套 schema 文件
- Provider 层和上层消费者（api、worker）**零改动**
- Repository 接口不变，只替换实现

## 连接配置

```typescript
// 未来实现示例
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT) ?? 5432,
  database: process.env.PG_DATABASE ?? 'quantforge',
  user: process.env.PG_USER ?? 'quant',
  password: process.env.PG_PASSWORD,
});

export const db = drizzle(pool, { schema });
```
