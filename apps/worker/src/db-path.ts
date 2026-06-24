/**
 * 数据中心数据库路径解析工具
 *
 * 优先使用 QUANT_DB_PATH 环境变量，否则回退到项目根目录下的 data/quant.db。
 * Worker 将此路径显式传递给 Python CLI 的 dataRange.dbPath，消除隐式相对路径依赖。
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** 向上查找项目根目录（以 pnpm-workspace.yaml 为标志） */
function resolveProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** 解析数据中心数据库绝对路径 */
export function resolveDbPath(): string {
  const envPath = process.env.QUANT_DB_PATH;
  if (envPath) return resolve(envPath);
  return resolve(resolveProjectRoot(), 'data', 'quant.db');
}
