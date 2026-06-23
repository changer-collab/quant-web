# 开发与测试工作流指南

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | 20+ | 推荐 LTS 版本 |
| pnpm | 9+ | 包管理器（`corepack enable` 自动启用） |
| Python | 3.11+ | 回测引擎、策略运行时 |
| Git | 2.30+ | 支持长路径 |

> 本项目已从 `better-sqlite3`（需 C++ 编译）迁移到 `sql.js`（纯 WASM），**无需 Visual Studio Build Tools**。

## 初始安装

```bash
# 1. 克隆仓库
git clone <repo-url> quant-web
cd quant-web

# 2. 安装 JS 依赖（零 native 编译）
pnpm install

# 3. 安装 Python 包（可编辑模式，按依赖顺序自动解析）
pip install -e packages/strategy-runtime \
  -e packages/data-client \
  -e packages/backtest-engine \
  -e packages/strategies \
  -e packages/factor-lab \
  -e packages/ai-engine \
  -e packages/obsidian-sync
```

## 日常开发

### API 开发

```bash
# 启动 API 开发服务器（端口 3002，热重载）
pnpm --filter @quant/api dev

# 运行 API 测试
pnpm --filter @quant/api test

# 类型检查
pnpm --filter @quant/api exec tsc --noEmit
```

### Web 前端开发

```bash
# 启动 Vite 开发服务器（端口 4173，代理 /api 到 3002）
pnpm --filter @quant/web dev

# 运行前端测试（自带 fetch mock，无需后端）
pnpm --filter @quant/web test

# 构建
pnpm --filter @quant/web build
```

> 前端测试通过 `tests/setup.ts` 中的 `globalThis.fetch` mock 脱离后端独立运行。
> 个别测试可用 `mockFetch.mockImplementationOnce(...)` 覆盖特定响应。

### Python 测试

```bash
# 单个包测试
cd packages/strategies && python -m pytest -v

# 全部 Python 包测试
for pkg in strategy-runtime backtest-engine strategies data-client factor-lab ai-engine obsidian-sync; do
  echo "=== $pkg ==="
  (cd packages/$pkg && python -m pytest -v)
done
```

### 全量验证

```bash
# JS: lint + test + build
pnpm lint && pnpm test && pnpm build

# API 冒烟测试（需先 pnpm build）
bash scripts/smoke-test.sh
```

## Windows 故障排除

### pnpm store 损坏

**症状**：`pnpm install` 报 `UNKNOWN: unknown error, open '...\node_modules\...\package.json'`，或 `node_modules/.pnpm/` 下某些包目录为空。

**原因**：Windows 文件系统在异常关机、杀毒软件拦截或路径过长时可能损坏 pnpm 的硬链接。

**修复步骤**：

```powershell
# 1. 清理 pnpm store 中的损坏引用
pnpm store prune

# 2. 删除项目 node_modules
Remove-Item -Recurse -Force node_modules

# 3. 重新安装
pnpm install
```

如果上述步骤仍失败，尝试强制重新安装：

```powershell
# 清理全局 store 缓存
pnpm store prune --force

# 使用 copy 模式安装（避免硬链接问题）
pnpm install --config.package-import-method=copy
```

### 文件路径过长

**症状**：`pnpm install` 或 `tsc` 报 `ENAMETOOLONG` 错误。

**修复**：启用 Windows 长路径支持（需管理员权限）：

```powershell
# 以管理员身份运行 PowerShell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

同时在 Git 中启用长路径：

```bash
git config --global core.longpaths true
```

### 杀毒软件干扰

**症状**：`pnpm install` 随机失败，文件被锁定或删除。

**修复**：将项目目录和 pnpm store 路径添加到杀毒软件排除列表：

- 项目目录：`D:\quant-web`
- pnpm store：运行 `pnpm store path` 查看路径（通常在 `D:\.pnpm-store` 或 `%LOCALAPPDATA%\pnpm\store`）

### WASM 加载失败

**症状**：API 启动时报 `Cannot find module 'sql.js'` 或 WASM 文件加载失败。

**排查**：

```powershell
# 检查 sql.js 是否安装
Test-Path node_modules/sql.js/dist/sql-wasm.wasm

# 如果不存在，重新安装
pnpm install
```

`sql.js` 的 WASM 文件位于 `node_modules/sql.js/dist/sql-wasm.wasm`。`connection.ts` 中的 `resolveWasmPath` 函数会从包目录、`process.cwd()` 向上逐层查找此文件，兼容 pnpm workspace 的各种链接结构。

> **注意**：`pnpm-workspace.yaml` 中设置了 `ignoredOptionalDependencies: [better-sqlite3, @types/better-sqlite3]`，阻止 pnpm 安装 `drizzle-orm` 的可选依赖 `better-sqlite3`（需 C++ 编译）。`sql.js` 作为显式依赖仍正常安装。`autoInstallPeers` 保持默认值 `true`，确保 `@testing-library/dom` 等正常 peer dependency 被自动安装。

### pnpm-workspace.yaml 编码损坏

**症状**：`pnpm config get ignoredOptionalDependencies` 返回 `undefined`，配置不生效；`pnpm-workspace.yaml` 中的中文注释在 `type` 命令下显示为乱码（如 `绂佹 pnpm 鑷姩`）。

**原因**：Windows PowerShell 默认使用 GBK 编码，中文注释在写入/读取时可能被损坏，导致 YAML 解析失败，pnpm 无法读取配置。

**修复**：`pnpm-workspace.yaml` 必须使用纯 ASCII 英文注释。如果已损坏，用文本编辑器以 UTF-8 无 BOM 编码重新保存，或直接重写为英文注释：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"

# Keep comments in ASCII to avoid encoding issues on Windows.
ignoredOptionalDependencies:
  - "better-sqlite3"
  - "@types/better-sqlite3"
```

验证配置生效：

```powershell
pnpm install --lockfile-only
# 检查 lock file 不含 better-sqlite3
Select-String -Path pnpm-lock.yaml -Pattern "better-sqlite3"  # 应无输出
```

### Junction 缓存导致 UNKNOWN 错误

**症状**：`pnpm install` 报 `UNKNOWN: unknown error, open 'D:\...\node_modules\<package>\package.json'`，但文件实际存在于 pnpm store 中。

**原因**：Windows Junction（pnpm 用于链接 node_modules 的机制）偶发缓存失效，Node.js 无法通过 junction 读取文件。通常由杀毒软件扫描、异常关机或文件系统延迟引起。

**修复**：

```powershell
# 方法 1：重启系统后重装（最可靠）
Restart-Computer
# 重启后
cd D:\quant-web
pnpm install --frozen-lockfile

# 方法 2：删除 node_modules 后重装
Remove-Item -Recurse -Force node_modules
pnpm install --frozen-lockfile

# 方法 3：使用 copy 模式安装（避免 junction）
pnpm install --frozen-lockfile --config.package-import-method=copy
```

> 如果 `UNKNOWN` 错误反复出现在不同包上，建议使用方法 2 彻底清理。copy 模式（方法 3）会复制文件而非创建 junction，占用更多磁盘空间但更稳定。

### Node.js 版本不匹配

**症状**：`sql.js` 初始化失败或 `Response` 构造函数未定义。

**修复**：确保 Node.js 版本 ≥ 20（`Response`、`Request`、`Headers` 是 Node 18+ 的全局 API）：

```powershell
node --version  # 应输出 v20.x 或更高
```

推荐使用 `nvm-windows` 或 `fnm` 管理多个 Node 版本。

## CI 流水线

CI 配置位于 `.github/workflows/ci.yml`，包含两个并行 Job：

### js Job

1. `pnpm install --frozen-lockfile` — 安装依赖（零 native 编译）
2. `pnpm lint` — ESLint 检查
3. `pnpm test` — Vitest 测试（含前端 fetch mock）
4. `pnpm build` — TypeScript 编译 + Vite 构建
5. `pnpm format:check` — Prettier 格式检查
6. `bash scripts/smoke-test.sh` — API 冒烟测试

### python Job

1. `setup-python 3.11` — 安装 Python
2. `pip install -e packages/...` — 安装 7 个 Python 包
3. 逐包运行 `pytest -v`

### 冒烟测试脚本

`scripts/smoke-test.sh` 执行流程：

1. 用 `npx tsx apps/api/src/index.ts` 启动 API server（后台）
2. 轮询 `/api/strategies` 等待就绪（最多 30 秒）
3. 验证 3 个核心端点返回 200：
   - `GET /api/strategies`
   - `GET /api/reports`
   - `GET /api/reports/count`
4. 退出时自动 kill 进程

## 架构说明

### 数据库驱动

全项目统一使用 `sql.js`（纯 WASM SQLite），零 native 编译依赖：

- `services/data-center` — `createSqliteContext()` 加载 WASM，内存数据库 + 文件持久化
- `apps/api` — `initApiDb()` 同样使用 sql.js，`closeApiDb(persist=true)` 关闭时持久化

两个模块共享 `drizzle-orm` 的通用 API（`insert`/`select`/`delete`），repo 层代码对驱动切换透明。

### 前端测试 Mock

`apps/web/tests/setup.ts` 中的 `globalThis.fetch` mock 确保前端测试完全脱离后端：

| 请求类型 | 响应 |
|----------|------|
| `GET /api/.../count` | `{ count: 0 }` |
| `GET /api/...` | `[]`（空列表） |
| `POST /api/...` | `{ id, taskId, status: 'pending' }` |
| `DELETE /api/...` | `{ success: true }` |

个别测试可通过 `mockFetch.mockImplementationOnce(...)` 覆盖特定端点响应。
