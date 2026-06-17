# apps/web/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 当前目录只负责前端研究原型。
- 不引入后端、路由、状态库，除非用户明确要求。
- 不把静态卡片全部做成按钮，交互必须服务真实研究动作。
- 新增 UI 文案必须进入 `src/data/en.ts`、`src/data/zh.ts` 或 `UiCopy`，组件不硬编码固定语言文案。
- `CSI 500`、`XGBoost`、`Level1` 等专有名词可以保留原样。
- 修改信息架构、策略模式、任务数据、文案或组件后必须运行验证命令。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
前端研究原型稳定阶段
已支持模式化默认配置：传统量化 / 高频研究 / AI 量化
已支持内存态研究闭环：运行研究 -> 任务中心查看配置摘要 -> 查看统一报告摘要和运行配置诊断
已提取自定义 hooks：useLanguage、useResearchWorkflow
appData.ts 已拆分为 accessors / factories / localization，原文件保留为 re-export 入口
CSS 已模块化：全局 tokens + 各组件 CSS Modules
CSS 动效系统已集成（全局 keyframes、导航/ Hero/按钮/因子 Tab 动画）
内容优化已完成（Mock 数据扩展、本地化标准化、品牌文案升级、空状态和指标说明文案、状态标签动态化）
页面底部已语境化：Dashboard 活动时间线、策略中心卡片矩阵、回测记录、实验对比表、数据中心覆盖面板，取代统一的策略表格
Error Boundary 已集成
前端 Mock 数据已按数据中心 6 个子域（reference / market / l2 / fundamental / event）组织，策略列表引用标的元数据
前端测试 81 个用例（含 21 个 Mock 数据验证测试）
```

## 验证命令

```bash
npm test
npm run build
npm list --depth=0
```

## 边界

当前不做：

```text
真实后端请求
真实下单
券商连接
权限系统
策略市场
```
