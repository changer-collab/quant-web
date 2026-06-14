# apps/web

`apps/web` 是 QuantForge 当前唯一可运行的前端研究原型。

## 当前阶段

```text
前端研究原型稳定阶段
```

已完成：

```text
React + TypeScript + Vite + CSS Modules
主导航研究流程
策略中心 / 策略研究台 / 任务中心 / 设置页
三种研究模式：传统量化 / 高频研究 / AI 量化
内存态研究闭环：运行研究 -> 任务中心 -> 报告摘要
appData.ts 拆分为 accessors / factories / localization，原文件为 re-export 入口
CSS 模块化：全局 tokens + 各组件 CSS Modules
自定义 hooks：useLanguage、useResearchWorkflow
Error Boundary
前端 Mock 数据已按数据中心 6 个子域（reference / market / l2 / fundamental / event）组织
策略列表和任务名称引用 MOCK_INSTRUMENTS 标的元数据
前端测试 81 个用例（含 21 个 Mock 数据验证测试）
```

暂未引入：

```text
路由
状态库
后端 API
真实任务调度
真实回测引擎
真实训练流程
```

## 运行

```bash
npm install
npm run dev
```

## 验证

修改前端信息架构、策略模式、任务数据、文案或组件后运行：

```bash
npm test
npm run build
npm list --depth=0
```

## 关键目录

```text
src/App.tsx             页面组合和渲染
src/hooks/              自定义 hooks（useLanguage、useResearchWorkflow）
src/appData.ts          前端数据访问 re-export 入口
src/data/               类型、accessors、factories、localization、中英文文案
src/data/mock/          按数据中心子域组织的 Mock 数据（reference / market / l2 / fundamental / event）
src/components/         展示组件（DataPanel、ErrorBoundary 等）
src/styles/             tokens.css + 各组件 CSS Modules
tests/                  组件 / Hook / 集成 / Mock 数据验证测试
```
