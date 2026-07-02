---
name: fix-python-encoding
description: Use when Windows 中文环境下 Python 子进程输出到 Node.js pipe 后出现中文乱码、GBK/UTF-8 解码错位、PythonBridge stdout/stderr 乱码、CLI subprocess 文本解码失败。
---

# 修复 Python 子进程编码乱码

## 概述

Windows 中文环境下，Python 子进程的 stdout/stderr pipe 输出使用系统默认编码（GBK/GB2312），而 Node.js 的 `chunk.toString()` 默认用 UTF-8 解码，导致中文字段全部变为乱码。

## 快速判断

当出现以下症状时使用本 skill：

| 症状                                                         | 原因                                          | 修复                          |
| ------------------------------------------------------------ | --------------------------------------------- | ----------------------------- |
| 中文字段变为乱码字符（如 `�ò���`）                           | Python pipe 输出用 GBK，Node.js 用 UTF-8 解码 | 三处修复（见下文）            |
| Python CLI 测试在 Windows 上 `UnicodeDecodeError` 或中文断裂 | 父进程按系统默认编码读 stdout/stderr          | 测试里显式 `encoding="utf-8"` |
| `call()` 正常但 `streamCall()` 乱码                          | 只改了同步路径                                | 同步和流式路径都要设置编码    |

## 编码乱码 — 根因修复

### 1. Python 端：强制 stdout/stderr 使用 UTF-8

在 CLI 入口文件（如 `cli.py`）的最顶部，`emit()` 函数之前：

```python
import sys

if sys.stdout.encoding is not None and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding is not None and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")
```

### 2. Node.js 端：设置 PYTHONIOENCODING 环境变量

在 `spawn()` 时传入 `env`：

```typescript
const proc = spawn(pythonPath, args, {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: cwd,
  env: {
    ...process.env,
    PYTHONIOENCODING: 'utf-8',
  },
});
```

**必须同时设置 `call()` 和 `streamCall()` 两个方法中的 `spawn()`。**

### 3. Node.js 端：显式指定 UTF-8 解码

所有 `chunk.toString()` 改为 `chunk.toString("utf-8")`：

```typescript
proc.stdout.on('data', (chunk: Buffer) => {
  buffer += chunk.toString('utf-8');
});

proc.stderr.on('data', (chunk: Buffer) => {
  stderr += chunk.toString('utf-8');
});
```

**注意：`call()` 和 `streamCall()` 中的 `stdout`、`stderr` handler 都需要改。**

### 4. Python 测试端：显式指定 UTF-8

如果测试用 `subprocess.run(..., text=True)` 读取 CLI 输出，也要指定编码：

```python
subprocess.run(args, text=True, encoding="utf-8", check=True)
```

## 常见错误

| 错误做法                                                   | 后果                                       |
| ---------------------------------------------------------- | ------------------------------------------ |
| 只改 Python 端不改 Node.js 端                              | 子进程仍用 PYTHONIOENCODING 默认值         |
| 只改 `call()` 不改 `streamCall()`                          | 流式调用依然乱码                           |
| 只改 Python 端 `reconfigure` 不改 Node 端 `spawn` 的 `env` | 非直接子进程覆盖不到                       |
| `chunk.toString()` 不传 `'utf-8'`                          | 依赖系统默认编码，Windows 下仍为 GBK       |
| 测试里只写 `text=True`                                     | Windows 中文环境可能按 GBK 解码 UTF-8 输出 |
