# 前后端打通错误记录

> 场景：启动 API + Worker + 前端，跑通"选择策略 → 运行回测 → 查看结果"闭环
> 结论：全部 12 个错误已修复并验证，端到端闭环已打通

## 错误总览

| # | 错误 | 阻断位置 | 修复方案 |
|---|------|----------|----------|
| 1 | Worker 默认连 3000 端口，API 监听 3002 | Worker → API | Worker 默认 `API_BASE_URL` 改为 `http://127.0.0.1:3002` |
| 2 | 前端 payload 字段 `strategy`，Worker 期望 `strategyName` | 前端 → Worker | Worker handler 改为读取 `payload.strategy` |
| 3 | Python CLI 报 `KeyError: 'strategy'` | Worker → Python | 由 #2 引发；Python 改为 `params.get("strategy")` |
| 4 | 前端无 `dataRange.startTs/endTs` | Worker → Python | 前端增加 startTs/endTs，Worker 透传给 Python |
| 5 | `data/quant.db` 无真实行情数据 | Python 回测取数 | 导入真实数据，修复路径解析 |
| 6 | API 无法解析 quant.db 路径 | API 数据库路径 | 使用项目根目录绝对路径定位 quant.db |
| 7 | Worker 调用 Python 子进程工作目录错误 | Worker → Python | PythonBridge 设置 cwd 为项目根目录 |
| 8 | 前端报告显示 MOCK 数据 | 前端报告渲染 | 接入真实回测指标 |
| 9 | Worker 未启动，任务一直 pending | Worker → API | 前端容错 + 运营保障 |
| 10 | `createResearchJob` 默认 state/progress 误导 | 前端 job 卡片 | 修正默认值 |
| 11 | SSE 在 pending 时只发 status 不发 result/error | 前端 report 创建 | SSE 补发终态事件 |
| 12 | SSE 错误处理静默关闭，不触发 fallback | 前端 fallback | SSE error 事件触发 fallback |

## 修复要点

- **端口对齐**：API 监听 3002，Worker 默认连 3002，Vite proxy 指向 3002
- **字段统一**：全链路使用 `strategy`（非 `strategyName`）、`startTs`/`endTs`
- **路径解析**：API 和 Worker 均通过 `findProjectRoot()` 定位 quant.db
- **SSE 行为**：任务终态（completed/failed）时发送 result/error 事件后关闭连接
- **前端 fallback**：API 不可用或任务失败时降级到模拟数据
