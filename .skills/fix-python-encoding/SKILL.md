---
name: fix-python-encoding
description: Use when Python 子进程输出到 Node.js 的中文字段出现乱码（GBK 编码被 UTF-8 解码），或出现 "xxx.map is not a function" 错误（LLM 输出字符串而非数组）。适用于 Windows 中文环境下 Python → Node.js pipe 通信的场景。
---

# 修复 Python 子进程编码乱码

## 概述

Windows 中文环境下，Python 子进程的 stdout/stderr pipe 输出使用系统默认编码（GBK/GB2312），而 Node.js 的 `chunk.toString()` 默认用 UTF-8 解码，导致中文字段全部变为乱码。

## 修复清单

当出现以下症状时，按顺序检查：

| 症状 | 原因 | 修复 |
|------|------|------|
| 中文字段变为乱码字符（如 `�ò���`） | Python pipe 输出用 GBK，Node.js 用 UTF-8 解码 | 三处修复（见下文） |
| `xxx.map is not a function` | LLM/规则引擎输出的字段是字符串而非数组 | 类型保护（见下文） |
| 策略名显示为 `...草稿 #N` | `mapBacktestResultToReport` 未传入 `strategyName` | 补充参数（见下文） |

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
  stdio: ["pipe", "pipe", "pipe"],
  cwd: cwd,
  env: {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
  },
});
```

**必须同时设置 `call()` 和 `streamCall()` 两个方法中的 `spawn()`。**

### 3. Node.js 端：显式指定 UTF-8 解码

所有 `chunk.toString()` 改为 `chunk.toString("utf-8")`：

```typescript
proc.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString("utf-8");
});

proc.stderr.on("data", (chunk: Buffer) => {
  stderr += chunk.toString("utf-8");
});
```

**注意：`call()` 和 `streamCall()` 中的 `stdout`、`stderr` handler 都需要改。**

## 字符串→数组 类型保护

当 LLM 或规则引擎输出的字段本应是 `string[]` 但实际是 `string` 时，需要做类型保护。典型场景：`suitableMarketRegime`。

### API 侧（合并 AI 分析结果时）

```typescript
if (ai.overview) {
  const ov = ai.overview as Record<string, unknown>;
  let regime = report.overview.suitableMarketRegime;
  if (ov.suitableMarketRegime !== undefined) {
    if (Array.isArray(ov.suitableMarketRegime)) {
      regime = ov.suitableMarketRegime as string[];
    } else if (typeof ov.suitableMarketRegime === 'string') {
      regime = [ov.suitableMarketRegime as string];
    }
  }
  report.overview = {
    ...report.overview,
    logic: ov.logic as string ?? report.overview.logic,
    suitableMarketRegime: regime,
  };
}
```

### 前端组件侧（渲染时防御）

```tsx
{(o.suitableMarketRegime && Array.isArray(o.suitableMarketRegime) && o.suitableMarketRegime.length > 0) && (
  <div>
    {o.suitableMarketRegime.map((r, i) => (
      <span key={i}>{r}</span>
    ))}
  </div>
)}
```

## 策略名显示异常

当 `mapBacktestResultToReport` 未传递 `strategyName` 时，会 fallback 到 `"...草稿 #N"`。

```typescript
// 调用时补充 strategyName
const nextBacktestReport = mapBacktestResultToReport(
  event.data as { taskId?: string; backtestResult?: unknown } | undefined,
  {
    id: `backtest-full-report-${Date.now()}`,
    taskId,
    status: 'completed',
    generatedAt: formatReportTime(language),
    strategyName: selectedStrategyForLanguage?.name ?? selectedStrategy?.name ?? '',
  },
);
```

## 常见错误

| 错误做法 | 后果 |
|---------|------|
| 只改 Python 端不改 Node.js 端 | 子进程仍用 PYTHONIOENCODING 默认值 |
| 只改 `call()` 不改 `streamCall()` | 流式调用依然乱码 |
| 只改 Python 端 `reconfigure` 不改 Node 端 `spawn` 的 `env` | 非直接子进程覆盖不到 |
| `chunk.toString()` 不传 `'utf-8'` | 依赖系统默认编码，Windows 下仍为 GBK |
