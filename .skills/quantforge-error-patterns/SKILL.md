---
name: "quantforge-error-patterns"
description: "Use when QuantForge/QuantWeb 出现 lint_error、build_fail、vitest_fail、pytest_fail、PythonBridge/diagnostics/SSE 数据错位、Windows 编码问题、pnpm 版本异常、跨包类型引用、Drizzle SQL.js 返回值误用、AI/因子诊断边界问题时调用。"
---

# QuantForge Error Patterns

QuantForge 历史迭代中反复出现的问题速查。原则：先定位根因，再做最小修复；不要用猜测式改动覆盖业务逻辑。

## 先做三件事

1. 使用项目声明的 pnpm：`C:\Users\37588\AppData\Roaming\npm\pnpm.cmd` 或 Corepack 的 `pnpm@9.15.0`。Codex runtime 的 `pnpm 11.x` 可能触发无 TTY 重建 `node_modules` 失败。
2. 操作子项目先读对应 `AGENT.md`，并遵守根 `AGENTS.md` 的依赖白名单。
3. 失败先看原始错误，再最小复现；不要先改代码。Ralph 的 `lint_error/build_fail/vitest_fail/pytest_fail` 只是分类，不是根因。

## 快速定位表

| 症状 | 常见根因 | 处理方式 |
|---|---|---|
| API lint/build 报引用 web 类型 | API 引入了 `apps/web` 私有类型，如 `ReportRiskWarnings` | 在 API 自己的 `types.ts` 或当前文件内定义薄类型，不跨包 import web |
| `no-undef` 缺 Node/浏览器全局 | 根 `eslint.config.mjs` globals 缺项 | 在根 ESLint flat config 补 `setTimeout`、`AbortController`、Canvas API 等运行时全局 |
| `Record<string, unknown>` 断言为具体 payload 报错 | TS 类型不重叠 | 先收窄字段；确属边界转换时用 `as unknown as Target`，不要扩大业务类型 |
| Python CLI 测试在 Windows 中文环境乱码/解码失败 | 子进程 stdout 是 UTF-8，父进程按 GBK 或默认编码读 | Python 测试 `subprocess.run(..., text=True, encoding="utf-8")`；Node bridge 见 `fix-python-encoding` |
| CLI import 单个命令却加载下游包失败 | `commands/__init__.py` 或命令模块顶层导入 sibling/downstream 包 | 命令入口保持函数内延迟导入；测试用 import guard 防顶层加载 |
| factor 公式结果总像 `close` | 序列函数默认参数误读，或缺失 formula 静默 fallback | 白名单 AST 求值；`rolling_mean(volume, 2)` 这类显式序列必须用传入序列；缺 formula 直接报业务错误 |
| `pytest_fail` 出现在 AI 训练/预测 | forward return 最后一行 NaN、空特征窗口、单类别 `predict_proba`、多标的 rolling 混用 | 标签先按特征 index 对齐后 dropna；空特征直接空预测；单类别概率补齐；历史窗口按 symbol 隔离 |
| Drizzle SQL.js 删除数量不对 | SQL.js 驱动 `.run()` 返回 `void` | repo/service 不依赖 `.run()` 返回影响行数；需要数量时单独查询 |
| diagnostics 前端无数据或结构错位 | Worker/API/前端对 `event.data`、`result.diagnostics`、`dataJson` 的层级理解不一致 | Python result 取 `event.data`；API 存 `result.diagnostics`；前端 SSE 读 `event.data.diagnostics`，F5 读 `data.dataJson` |
| diagnostics 渲染类型错 | 前端按 `strategy.category` 推断，而真实结果已有 `diagnosticData.type` | 优先按 `diagnosticData.type` 渲染，不依赖策略分类兜底 |
| `xxx.map is not a function` | LLM/规则引擎把本应为数组的字段返回成字符串，如 `suitableMarketRegime` | API 合并层把 string 包成数组；前端渲染前用 `Array.isArray` 守卫 |
| 报告策略名显示为 `...草稿 #N` | `mapBacktestResultToReport` 调用时没传 `strategyName` | 映射报告时补充当前策略名，不让报告走草稿 fallback |
| mock fetch 测试路由误命中 | `GET /config` 等匹配顺序早于 POST/PUT | tests/setup.ts 中 mock fetch 先判断 POST/PUT，再判断 GET |
| React hooks lint/error | useEffect/useMemo 依赖或 hook 顺序不稳 | 所有 hook 放组件顶层固定顺序；dependency array 与实际读取值同步；避免 `Math.random` 触发 compiler warning |
| pandas 时间戳测试错 | pandas 3.x `DatetimeIndex.astype(np.int64)` 精度变化 | epoch 自动识别秒/毫秒/微秒；生成毫秒测试数据时用 `// 10**6` |
| 因子/非因子诊断数据不足崩溃 | 空 K 线、少于 30 根、缺 `close`、单月数据 | 返回空结构并 emit warning，不抛异常 |

## 验证顺序

优先用正确 pnpm：

```powershell
& 'C:\Users\37588\AppData\Roaming\npm\pnpm.cmd' lint
& 'C:\Users\37588\AppData\Roaming\npm\pnpm.cmd' build
& 'C:\Users\37588\AppData\Roaming\npm\pnpm.cmd' test
```

Python 包按涉及范围跑局部测试，再跑所在包全量测试：

```powershell
python -m pytest tests/test_xxx.py -v
python -m pytest -v
```

## 禁止做法

- 不为了消除 lint 修改业务语义。
- 不把 API 类型从 web 包借过来。
- 不把 Worker 和 API 改成共享内存或进程状态。
- 不在 strategy-runtime 命令顶层 import 下游包。
- 不把 diagnostics 的完整 wrapper 当作干净结果存进 `dataJson`。
- 不把历史 mock 数据当作真实链路验证依据。
