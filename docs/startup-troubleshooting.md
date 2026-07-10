# 启动排障手册

本仓库在多次会话中反复出现的两类启动阻断问题，沉淀在此。启动服务前先跑一遍环境自检：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1
# 自动修复（重建 better-sqlite3、补装缺失 Python 包）：
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/check-env.ps1 -Fix
```

脚本检测通过后再启动 `apps/api`、`apps/worker`、`apps/web`，可避免 90% 的启动卡顿。

---

## 1. better-sqlite3 原生模块 ABI 不匹配

### 症状

API 启动时抛出：

```
DataCenterError: 创建 SQLite 连接失败
Error: The module '...\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different version of Node.js using
NODE_MODULE_VERSION 127. This version of Node.js requires NODE_MODULE_VERSION 137.
```

`127` 对应 Node 22，`137` 对应 Node 24。换了 Node 版本（或换了机器）后，`better-sqlite3` 的 `.node` 二进制没有随之重新编译。

### 根因

`apps/api` 依赖 `better-sqlite3`，它通过 `node-gyp` 编译出的 C++ 原生二进制和当前 Node 的 ABI 绑定。一旦 Node 主版本号变化（例如 22 → 24），`.node` 文件就失效。

### 修复

优先用 `pnpm rebuild`：

```powershell
pnpm rebuild better-sqlite3
# 验证
Push-Location apps/api
node -e "require('better-sqlite3'); console.log('OK')"
Pop-Location
```

如果 `pnpm rebuild` 静默失败（PowerShell 沙箱或 npm 缓存污染时常见），直接走 `node-gyp` 强制重建：

```powershell
Push-Location apps/api
# 删掉失效产物，避免被复用
Remove-Item -Recurse -Force node_modules\better-sqlite3\build -ErrorAction SilentlyContinue
# 用当前 Node 的 ABI 重新编译
node "D:\node_js_condition\node_modules\npm\node_modules\node-gyp\bin\node-gyp.js" `
  rebuild --release `
  --target="24.15.0" `
  --modules="137" `
  --directory="node_modules\better-sqlite3"
Pop-Location
```

`--target` 与 `--modules` 的对应关系：

| Node 版本 | `--target` | `--modules` |
| --- | --- | --- |
| 22.x | 22.x.x | 127 |
| 24.x | 24.x.x | 137 |

`--modules` 可用 `node -e "console.log(process.versions.modules)"` 查询。

### 验证

```powershell
Push-Location apps/api
node -e "const D=require('better-sqlite3'); const db=new D(':memory:'); console.log(db.prepare('select sqlite_version()').get()); db.close()"
Pop-Location
```

打印出 SQLite 版本号即视为通过。

---

## 2. quantforge-* Python 包未安装

### 症状

API `/api/strategies` 返回 `200 []`（空数组），但 Python CLI 直接调用报错：

```json
{"event":"error","error":{"code":"INTERNAL_ERROR","message":"No module named 'quantforge_strategies'"}}
```

### 根因

`packages/strategies`（包名 `quantforge-strategies`，模块名 `quantforge_strategies`）没有 `pip install -e` 装进当前 Python 环境。Worker 通过 `PythonBridge` 启动 `python -m quantforge_strategy` 子进程，子进程延迟 import `quantforge_strategies` 时找不到模块。

`strategy-sync.service.syncFromPython()` 在子进程失败时**返回空数组而非抛错**，前端因此看到"策略中心没有策略"——后端不报错、不日志、不告警，是个静默陷阱。

### 需要安装的 6 个包

```text
quantforge-ai          -> packages/ai-engine
quantforge-algorithms  -> packages/algorithms
quantforge-loop        -> packages/loop-engine
quantforge-obsidian    -> packages/obsidian-sync
quantforge-strategy    -> packages/strategy-runtime
quantforge-strategies  -> packages/strategies
```

### 修复

```powershell
python -m pip install -e "d:\quant-web\packages\strategies"
# 或一次性补齐所有缺失：
$pkgs = @('ai-engine','algorithms','loop-engine','obsidian-sync','strategy-runtime','strategies')
foreach ($p in $pkgs) {
  python -m pip install -e "d:\quant-web\packages\$p"
}
```

### 验证

```powershell
python -m pip list | Select-String quantforge
# 应看到 6 个 quantforge-* 包

# Python CLI 直接验证
python -m quantforge_strategy --command listStrategies
# 应返回 NDJSON 流，每行一个策略
```

CLI 走通后，访问 `http://localhost:3002/api/strategies` 应返回非空数组。

---

## 3. 端口占用

### 症状

API 或 Vite 启动报 `EADDRINUSE: address already in use 0.0.0.0:3002`。

### 根因

上一次会话的进程没退干净，或多个 IDE 实例同时启动了同一个服务。

### 修复

```powershell
# 定位占用进程
Get-NetTCPConnection -LocalPort 3002 -State Listen
# 释放
Stop-Process -Id <PID> -Force
```

`check-env.ps1` 会自动列出 PID 和释放命令。

---

## 4. 启动顺序建议

```text
1. scripts/check-env.ps1              # 自检
2. apps/api      (pnpm --filter @quant/api dev)        # 端口 3002
3. apps/worker   (pnpm --filter @quant/worker dev)     # 轮询 3002
4. apps/web      (pnpm --filter @quant/web dev)        # 端口 4173，proxy /api → 3002
```

API 必须先于 Worker，否则 Worker 第一次轮询会失败并指数退避（无害但日志吵）。Worker 可以与 Web 并行。

---

## 5. 静默失败清单（启动通过但数据是假的）

下面这些症状**不会让服务崩**，但会让前端显示空或假数据。每次启动后建议逐一核对：

| 症状 | 检查方式 | 期望结果 |
| --- | --- | --- |
| 策略中心空 | `GET /api/strategies` | 非空数组（10+ 条） |
| Python CLI 报 `No module named quantforge_strategies` | `python -m quantforge_strategy --command listStrategies` | NDJSON 流，每行一个策略 JSON |
| 前端报告指标是 mock | 对比 API 返回的 `metrics` 与前端显示值 | 一致 |
| `useResearchWorkflow` fallback 到 mock | 浏览器 Network 看 SSE 是否建立 | 看到 `/api/tasks/:id/stream` 持续接收事件 |
| 策略卡片没有渲染（只有 hero metrics） | 检查 `activePage` 与 App.tsx 渲染条件 | `strategies` 与 `strategy` 两个 id 都应渲染 `StrategyPage` |
