# QuantForge

面向个人量化研究者的高频与 AI 策略研究前端原型。当前 UI 默认英文，并支持在 Settings 中切换中文。

当前版本重点不是实盘交易，而是打通最小研究闭环：

Strategy Center -> Research Workspace -> Run Research -> Jobs -> Backtest Report

## 技术栈

- React
- TypeScript
- Vite
- CSS
- Node.js 测试脚本

## 本地运行

```bash
npm install
npm run dev
```

默认预览地址：

```text
http://localhost:4173/
```

## 常用命令

```bash
npm test
npm run build
```

## 当前页面结构

- Dashboard / 研究总览：核心收益、风险、任务和最近策略
- Strategy Center / 策略中心：策略列表、分类、状态和收益摘要
- Research Workspace / 策略研究台：统一承载传统量化、高频研究、AI 量化
- Backtest Report / 回测报告：统一回测报告
- Experiments / 实验对比：参数、模型和区间对比
- Data Center / 数据中心：数据资产与覆盖情况
- Jobs / 任务中心：回测、训练、实验任务
- Settings / 系统设置：研究默认配置和界面语言

## 信息架构原则

高频和 AI 不是左侧独立主入口，而是策略研究台里的研究模式。

策略研究台当前包含三种模式：

- 传统量化
- 高频研究
- AI 量化

## 当前交互闭环

- 点击 Strategy Center 的策略行，会进入 Research Workspace
- 研究台会自动切换到策略对应模式
- 点击 Run Research 会创建一个模拟任务
- 创建任务后自动进入 Jobs 页面
- 在 Settings 中切换 English / 中文 会立即更新界面，并用 `localStorage` 记住选择

## 后续升级路线

1. 拆分组件：把当前 `App.tsx` 拆成页面组件和通用组件。
2. 引入路由：为主页面和策略详情增加稳定 URL。
3. 定义 API 契约：用 mock API 替代静态数据。
4. 做真实表单：策略参数、回测区间、数据频率、手续费、滑点。
5. 强化图表：净值、回撤、订单簿、Tick、预测结果。
6. 接入后端：任务提交、任务状态轮询、回测结果读取。

## 边界

第一版不做：

- 实盘交易
- 券商接入
- 真实下单
- 团队权限
- 策略市场
