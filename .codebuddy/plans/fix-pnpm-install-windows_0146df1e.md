---
name: fix-pnpm-install-windows
overview: 修复 Windows 下 pnpm install 失败：pnpm-workspace.yaml 中文注释因 GBK 编码损坏导致 YAML 解析失败、ignoredOptionalDependencies 未生效；残留的 better-sqlite3 安装产物触发 native 编译；acorn/package.json 文件锁导致 UNKNOWN 错误。通过修复编码、清理残留、重新生成 lock file 解决。
todos:
  - id: fix-workspace-yaml
    content: "重写 pnpm-workspace.yaml 为纯 ASCII 注释，移除 autoInstallPeers: false，保留 ignoredOptionalDependencies 配置"
    status: completed
  - id: regen-lockfile
    content: 重新生成 pnpm-lock.yaml 确保不含 better-sqlite3，并提交到 git
    status: completed
    dependencies:
      - fix-workspace-yaml
  - id: clean-reinstall
    content: 清理 node_modules 残留产物并用 --frozen-lockfile 重新安装验证
    status: completed
    dependencies:
      - regen-lockfile
  - id: update-docs
    content: "更新 docs/dev-workflow.md 移除 autoInstallPeers: false 引用，补充编码注意事项"
    status: completed
    dependencies:
      - fix-workspace-yaml
  - id: verify-ci
    content: 验证 CI workflow 无需修改，确认 --frozen-lockfile + 干净 lock file 兼容
    status: completed
    dependencies:
      - regen-lockfile
      - update-docs
---

## 产品概述

修复 Windows 环境下 `pnpm install` 因文件系统损坏和配置失效导致无法完成的问题，使本地开发环境恢复正常。

## 核心功能

- 修复 `pnpm-workspace.yaml` 编码问题（中文注释在 Windows GBK 环境下变为乱码，导致 YAML 配置不被 pnpm 读取）
- 移除有害的 `autoInstallPeers: false` 配置（阻止 `@testing-library/dom` 等正常 peer dep 自动安装）
- 确保干净的 `pnpm-lock.yaml`（不含 better-sqlite3）被提交并用于本地安装
- 清理 `node_modules` 中 better-sqlite3 残留产物（触发 native 编译失败）
- 更新 `docs/dev-workflow.md` 移除过时的 `autoInstallPeers: false` 说明
- 验证 CI 流程不受影响（CI 使用 `--frozen-lockfile`，干净 lock file 即可保证）

## Tech Stack

- **包管理器**：pnpm 9.15.0（已有，通过 `pnpm-workspace.yaml` 配置）
- **配置文件**：`pnpm-workspace.yaml`（pnpm 9 的主配置文件，支持 `ignoredOptionalDependencies` 等设置）
- **Lock file**：`pnpm-lock.yaml`（CI 使用 `--frozen-lockfile` 严格按 lock file 安装）

## Implementation Approach

### 根因分析（已验证）

1. **pnpm-workspace.yaml 编码损坏**：中文注释在 Windows PowerShell `type` 命令下显示为乱码（`绂佹 pnpm 鑷姩瀹夎`），`pnpm config get autoInstallPeers` 和 `pnpm config get ignoredOptionalDependencies` 均返回 `undefined`，表明配置未被 pnpm 读取
2. **`autoInstallPeers: false` 有害**：pnpm 9 的 `autoInstallPeers` 默认 `true`，仅安装非可选 peer deps（不安装 optional peer deps 如 better-sqlite3）。设为 `false` 会阻止 `@testing-library/dom` 等正常 peer dep 被自动安装，且对排除 better-sqlite3 无效
3. **better-sqlite3 残留**：`node_modules/.pnpm/better-sqlite3@12.11.1/` 和 `node_modules/better-sqlite3` 存在，触发 `prebuild-install` / `node-gyp rebuild` 编译脚本，因缺 Visual Studio C++ Build Tools 失败
4. **文件锁次生错误**：编译失败后 `UNKNOWN: unknown error, open 'acorn/package.json'` 是杀毒软件/文件锁的次生问题

### 修复策略

- 重写 `pnpm-workspace.yaml`：纯 ASCII 英文注释（彻底避免编码问题），移除 `autoInstallPeers: false`，保留 `ignoredOptionalDependencies`
- 重新生成 lock file：使用 `--config.ignoredOptionalDependencies` 命令行参数确保 better-sqlite3 被排除（已验证有效，从 13 matches 降到 0）
- 清理 `node_modules`：删除整个目录后用 `--frozen-lockfile` 重装（使用干净 lock file，不会引入 better-sqlite3）
- 更新文档：移除 `autoInstallPeers: false` 引用，添加编码注意事项

### CI 影响分析

CI 使用 `pnpm install --frozen-lockfile`，严格按 lock file 安装。干净的 lock file（不含 better-sqlite3）即可保证 CI 不会触发 native 编译。CI 在 ubuntu-latest 运行，无 Windows 文件系统问题。`ignoredOptionalDependencies` 配置在 `pnpm-workspace.yaml` 中，CI 也会读取（编码修复后）。

## Implementation Notes

- **性能**：`pnpm install --frozen-lockfile` 跳过依赖解析，直接按 lock file 安装，速度更快
- **影响范围控制**：不修改 `package.json`、`apps/api/src/`、`apps/web/src/` 任何源代码，仅修改配置和文档
- **向后兼容**：lock file 是 CI 的 source of truth，干净 lock file 保证 CI 和本地安装一致

## Directory Structure

```
项目根/
├── pnpm-workspace.yaml                    # [MODIFY] 重写为纯 ASCII 注释，移除 autoInstallPeers: false，保留 ignoredOptionalDependencies
├── pnpm-lock.yaml                         # [MODIFY] 重新生成（不含 better-sqlite3），提交到 git
├── node_modules/                          # [CLEAN] 清理后用 --frozen-lockfile 重装
├── docs/
│   └── dev-workflow.md                    # [MODIFY] 移除 autoInstallPeers: false 引用，更新配置说明
└── .github/workflows/
    └── ci.yml                             # [VERIFY] 确认无需修改（--frozen-lockfile + 干净 lock file）
```