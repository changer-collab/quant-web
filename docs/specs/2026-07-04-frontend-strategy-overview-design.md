# 前端策略总览与研究台重构设计

- 日期：2026-07-04
- 范围：`apps/web` 前端研究原型
- 状态：设计定稿，待实施

## 背景与问题

当前前端存在四个问题：

1. **K线图崩溃**：[kline-chart.tsx](file:///d:/quant-web/apps/web/src/components/kline-chart.tsx) 自定义 Canvas 实现存在性能循环，鼠标 hover 信号时触发连续重绘，bars 数量大时导致浏览器崩溃重启。
2. **策略总览**：[strategy-page.tsx](file:///d:/quant-web/apps/web/src/components/strategy-page.tsx) 已按 category/subcategory 分组展示，结构正确，但卡片交互割裂（卡片本体进 config 视图、按钮才进研究台）。
3. **侧边导航跳转**：点击策略卡片应直接跳到策略研究台，当前需先经过 config 中间页。
4. **功能重复**：策略总览点击后的 config 中间页（ConfigPanel + KlineChart）与策略研究台（WorkspacePage 诊断+回测）在参数配置上存在重复。

## 设计目标

- 修复 K线图崩溃，性能对标东方财富网页版（三年半日线 ~850 bars 流畅）。
- 删除 config 中间页，策略总览点击卡片直接进入研究台，侧边栏跳转。
- 研究台吸收 ConfigPanel + K线，重构为三 Tab 架构，消除参数配置重复。
- 符合根级 AGENTS.md 与 apps/web/AGENT.md 边界规则。

## 方案概述

**方案 A（已选定）：删中间页，研究台吸收 ConfigPanel + K线。**

点策略卡片 → 直接进研究台。研究台改为三阶段 Tab：① 参数配置（吸收 ConfigPanel）+ K线预览 ② 诊断 ③ 回测。

## 整体架构

### 导航与页面流转

```
侧边栏：
  Dashboard | 策略总览(strategy) | 策略研究台(workspace) | 回测(backtest) | 实验对比 | 数据中心 | 任务中心 | 设置

流转：
  策略总览 (按 category/subcategory 浏览所有策略)
    └─ 点策略卡片 ──→ 策略研究台 (workspace)，携带选中策略
         ├─ Tab 1: 参数配置 + K线预览
         ├─ Tab 2: 诊断
         └─ Tab 3: 回测
```

变更点：
- 删除 `StrategyPage` 内部的 `view: 'grid' | 'config'` 双态，只保留 grid。
- `StrategyGridNew` 卡片点击统一调用 `onEnterWorkspace`，移除 `onSelectStrategy` 与"进入工作台"按钮（整卡可点）。
- `WorkspacePage` 由 Stepper（Step1→Step2）改为 Tab（配置/诊断/回测），三 Tab 平行可切换，无强制顺序。
- 默认进入 `config` Tab（用户刚从策略总览选策略进来，先配置参数）。

### 研究台 Tab 结构

| Tab | 标题 | 内容 | 数据来源 |
|-----|------|------|----------|
| 1 | 参数配置 | ConfigPanel（参数/子分类/因子池/预处理）+ K线信号预览 | 策略定义 + Preview API + ConfigSnapshot |
| 2 | 诊断 | IC 序列/分层收益/相关性热力图/参数敏感性/信号质量（原 Step1 内容） | 诊断任务结果 |
| 3 | 回测 | 回测参数表单（symbol/timeframe/cash/date）+ 执行 + 结果（资金曲线/交易明细） | 回测任务结果 |

关键决策：
- Tab 1 的 ConfigPanel 保存配置后，configSnapshot 成为 Tab 2 诊断 / Tab 3 回测的共享输入。
- 回测表单不再重复策略参数，只保留运行参数（symbol/timeframe/cash/date/slippage）。
- Tab 之间无强制顺序，但 Tab 2/3 在无 configSnapshot 时显示提示"请先在 Tab 1 保存配置"。

### 策略总览

当前 `StrategyGridNew` 已按 `category`（factor_based/non_factor/transitional）→ `subcategory` 分组并支持折叠。结构正确，保留不变。仅微调：移除卡片底部的"进入工作台"按钮，改为整卡可点击（hover 加阴影/边框高亮，cursor: pointer）。

## K线图修复方案

### 崩溃根因

```
鼠标移动
  → handleMouseMove 调用 setHoveredSignal
  → draw 是 useCallback，依赖 [previewData, subcategory, hoveredSignal, ui]
  → draw 引用变化 → useEffect([draw]) 重新执行
  → 重新订阅 ResizeObserver
  → ResizeObserver 立即触发首次回调 → 再次 draw
  → draw 内 canvas.width = w * dpr 重置画布 → 触发布局
  → setContainerDims → 组件重渲染
  → 鼠标还在动 → 下一帧 setHoveredSignal → 循环
```

bars 数量大时（100+），每次 draw 遍历 bars 4 次，主线程阻塞，循环无法退出 → 浏览器崩溃。

### 修复策略：双 canvas 分层 + ref 解耦

**核心思路：把 `hoveredSignal` 从渲染状态里剥离，避免鼠标移动触发重渲染和 draw 重建。**

#### 改动 1：双 canvas 分层

```
<div class="chartWrapper">
  <canvas ref={baseCanvasRef} />   {/* 基础层：网格/蜡烛/均线/成交量/副图 */}
  <canvas ref={overlayCanvasRef} /> {/* 叠加层：信号箭头 + 高亮，绝对定位覆盖 */}
  <div class="tooltip">...</div>     {/* DOM tooltip，不参与 canvas 重绘 */}
</div>
```

- 基础层只在 `previewData / subcategory / 容器尺寸` 变化时重绘。
- 叠加层只在 `hoveredSignal` 变化时重绘（轻量，只画几个箭头）。
- 两层共享同一套布局计算（`computeLayout` 结果缓存到 ref）。

CSS：
```css
.chartWrapper { position: relative; }
.chartWrapper canvas { position: absolute; top: 0; left: 0; }
.baseCanvas { z-index: 1; }
.overlayCanvas { z-index: 2; pointer-events: none; }
```

#### 改动 2：hoveredSignal 改为 ref + 节流

```typescript
const hoveredSignalRef = useRef<number | null>(null);
const handleMouseMove = useCallback((e) => {
  const idx = getBarIndexFromX(e.clientX);
  if (idx == null) { drawOverlay(null); return; }
  const sigIdx = previewData?.signals.findIndex(s => s.bar_index === idx) ?? -1;
  const next = sigIdx >= 0 ? sigIdx : null;
  if (hoveredSignalRef.current !== next) {
    hoveredSignalRef.current = next;
    drawOverlay(next);  // 直接调用，不 setState
  }
  setTooltip(...);
}, [previewData]);
```

鼠标移动用 `requestAnimationFrame` 节流。

#### 改动 3：ResizeObserver 防抖

```typescript
const rafRef = useRef<number>();
const ro = new ResizeObserver(() => {
  if (rafRef.current) cancelAnimationFrame(rafRef.current);
  rafRef.current = requestAnimationFrame(() => drawBase());
});
```

ResizeObserver 不再调用 `setContainerDims`（tooltip clamp 改为读 `containerRef.getBoundingClientRect()` 实时值）。

#### 改动 4：draw 依赖收敛

- `drawBase`（基础层）依赖：`[previewData, subcategory, ui]`
- `drawOverlay`（叠加层）依赖：`[previewData]`（信号数据）
- 两者都不再依赖 `hoveredSignal`，彻底切断循环。

#### 改动 5：归一化缓存 + 安全兜底

```typescript
const normalizedBarsRef = useRef<NormalizedBar[]>([]);
useEffect(() => {
  normalizedBarsRef.current = previewData ? normalizeBars(previewData.bars) : [];
}, [previewData]);

// Math.max(...arr) 改为 reduce，避免大数组栈溢出
const maxVol = bars.reduce((m, b) => b.v > m ? b.v : m, 0) || 1;
```

#### 改动 6：bars 数量上限保护

```typescript
const MAX_BARS = 1500;  // 覆盖六年日线，与东财同级
```

- 后端 Preview API `limit` 默认 150，前端可请求到 1500。
- 超过 1500（如分钟线多年）才降采样，并在 UI 提示"数据量较大，已降采样显示 N 条"。
- 当前阶段策略研究以日线/周线为主，1500 上限足够。

### 性能基线

- 三年半日线 ~850 条：流畅（<16ms/帧）
- 六年日线 ~1500 条：流畅
- 一年分钟线 ~6 万条：超出范围，需独立任务处理（不在本次范围）

### 不引入虚拟化/WebGL 的理由

按 KISS 原则：策略研究预览不需要分钟级多年数据；虚拟化大幅增加复杂度；WebGL 需引入新依赖与现有 canvas 体系冲突。

## 组件改动清单

### 文件改动总览

| 文件 | 操作 | 改动概要 |
|------|------|----------|
| [strategy-page.tsx](file:///d:/quant-web/apps/web/src/components/strategy-page.tsx) | 瘦身 | 删除 `view` state 和 config 分支，只保留 grid 渲染 |
| [strategy-grid-new.tsx](file:///d:/quant-web/apps/web/src/components/strategy-grid-new.tsx) | 简化 | 整卡可点击，移除"进入工作台"按钮和 `onSelectStrategy` |
| [App.tsx](file:///d:/quant-web/apps/web/src/App.tsx) | 小改 | 移除传给 StrategyPage 的 `onSelectStrategy` 相关 props |
| [workspace-page.tsx](file:///d:/quant-web/apps/web/src/components/workspace-page.tsx) | 重构 | Stepper → 三 Tab（配置/诊断/回测） |
| [config-panel.tsx](file:///d:/quant-web/apps/web/src/components/config-panel.tsx) | 移入 | 作为 Tab 1 子组件，新增 `onConfigSaved` 回调 |
| [kline-chart.tsx](file:///d:/quant-web/apps/web/src/components/kline-chart.tsx) | 重写 | 双 canvas 分层 + ref 解耦 |
| [kline-chart.module.css](file:///d:/quant-web/apps/web/src/styles/kline-chart.module.css) | 小改 | 增加双 canvas 叠加定位样式 |

### 详细改动

#### strategy-page.tsx — 瘦身

删除：
- `type View = 'grid' | 'config'` 及对应 state
- `selectedStrategy` state
- `handleSelectStrategy` / `handleBackToGrid` 函数
- config 视图分支（ConfigPanel + KlineChart + 返回按钮 + "进入工作台"按钮）
- ConfigPanel、KlineChart、usePreviewData 等相关 import

保留：
- `StrategyGridNew` 渲染（按 category/subcategory 分组）
- 顶部标题/说明文案

Props 收敛为：
```typescript
type StrategyPageProps = {
  strategies: StrategyRow[];
  workflowReady: boolean;
  onEnterWorkspace: (strategy: StrategyRow) => void;
};
```

#### strategy-grid-new.tsx — 简化

删除：
- `onSelectStrategy` prop
- 卡片底部"进入工作台"按钮
- `handleCardClick` 中切换到 config 视图的逻辑

修改：
- 整卡 `onClick` → `onEnterWorkspace(strategy)`
- hover 加阴影/边框高亮，cursor: pointer

保留：
- category → subcategory → strategy 三级分组结构
- 折叠/展开交互
- 策略元信息展示
- disabled 态（`workflowReady=false` 时卡片禁用）

#### App.tsx — 小改

- `handleEnterWorkspace` 保留不变（已正确设置 `workspaceEntryStrategy` + `handleNavClick('workspace')`）
- 移除传给 `<StrategyPage>` 的 `onSelectStrategy`（如存在）
- `workspaceEntryStrategy` 继续作为 WorkspacePage 的入口策略

#### workspace-page.tsx — 重构为 Tab

新结构：
```typescript
type WorkspaceTab = 'config' | 'diagnose' | 'backtest';
const [activeTab, setActiveTab] = useState<WorkspaceTab>('config');

<TabNav active={activeTab} onChange={setActiveTab} tabs={[
  { key: 'config', label: '参数配置' },
  { key: 'diagnose', label: '诊断' },
  { key: 'backtest', label: '回测' },
]} />

{activeTab === 'config' && (
  <ConfigPanel strategy={entryStrategy} onConfigSaved={handleConfigSaved} />
)}
{activeTab === 'config' && entryStrategy && (
  <KlineChart strategy={entryStrategy} />
)}
{activeTab === 'diagnose' && <DiagnosePanel ... />}
{activeTab === 'backtest' && <BacktestPanel ... />}
```

关键改动：
- 移除 Stepper 线性流程，三 Tab 平行可切换。
- 默认进入 `config` Tab。
- DiagnosePanel / BacktestPanel 从原 Step1/Step2 逻辑抽取为独立子组件，放在 workspace-page.tsx 同文件内（KISS，不过度拆分）。
- 回测表单简化：只保留 `symbol / timeframe / initial_cash / start_date / end_date / slippage`，策略参数不再重复。

#### config-panel.tsx — 移入 Tab 1

新增：
- `onConfigSaved?: () => void` 回调 prop，保存成功后通知父组件。

删除（如有）：
- 内部的"进入工作台"按钮。

保留：
- 策略参数配置（slider/number/select）
- 子分类切换
- 因子池（factor-based 时）
- 预处理选项
- "预览"按钮触发 Preview API（驱动同 Tab 的 KlineChart）
- "保存配置"按钮 → `saveStrategyConfig` → `onConfigSaved()`

#### kline-chart.tsx — 重写

- 双 canvas（baseCanvasRef + overlayCanvasRef）
- `hoveredSignal` 改 ref，不触发重渲染
- `drawBase` 依赖 `[previewData, subcategory, ui]`
- `drawOverlay` 依赖 `[previewData]`
- ResizeObserver 防抖（requestAnimationFrame）
- 归一化数据缓存到 `normalizedBarsRef`
- `Math.max(...arr)` 改 `reduce`
- `MAX_BARS = 1500`，超过降采样

#### kline-chart.module.css — 小改

增加双 canvas 叠加定位样式（position: absolute + z-index）。

### 不改动的文件

- `hooks/useResearchWorkflow.ts` — 工作流状态机保留
- `hooks/useStrategies.ts` — 策略列表获取保留
- `hooks/useTaskStream.ts` — SSE 任务流保留
- `api/strategies.ts` / `api/preview.ts` / `api/diagnostics.ts` — API 层不变
- `data/types.ts` — 类型定义不变
- 因子工坊、回测报告等其他页面完全不动

## 数据流与状态

### 研究台状态拓扑

```
WorkspacePage (顶层 state 持有者)
├── entryStrategy: StrategyRow          // 从策略总览带入，不可变
├── activeTab: 'config'|'diagnose'|'backtest'  // 默认 'config'
├── configSnapshot: ConfigSnapshot | null      // 从 API 读取的最新配置
├── configVersion: number                      // 配置版本号，ConfigPanel 保存后递增
│
├── Tab 1: ConfigPanel + KlineChart
│   ├── ConfigPanel
│   │   ├── 读 configSnapshot 初始化参数
│   │   ├── 用户编辑 → 本地 state
│   │   ├── "预览" → 调 Preview API → 驱动 KlineChart
│   │   └── "保存配置" → saveStrategyConfig API → onConfigSaved()
│   └── KlineChart
│       └── 读 Preview API 结果渲染（双 canvas）
│
├── Tab 2: DiagnosePanel
│   ├── useEffect 依赖 configVersion
│   ├── configVersion 变化 → 重新读 configSnapshot
│   ├── "运行诊断" → 提交诊断任务 → SSE 接收 → 渲染 IC/相关性/参数敏感性
│   └── 无 configSnapshot 时显示空态提示
│
└── Tab 3: BacktestPanel
    ├── useEffect 依赖 configVersion
    ├── 回测表单：symbol/timeframe/cash/date/slippage（运行参数）
    ├── 策略参数不在此配置，从 configSnapshot 读取（只读展示）
    ├── "运行回测" → 提交回测任务 → SSE 接收 → 渲染资金曲线/交易明细
    └── 无 configSnapshot 时显示空态提示
```

### 关键数据流

#### 流 1：策略总览 → 研究台

```
StrategyGridNew 卡片点击
  → App.handleEnterWorkspace(strategy)
  → setWorkspaceEntryStrategy(strategy)
  → handleNavClick('workspace')
  → WorkspacePage 接收 entryStrategy
  → 默认进入 config Tab
  → ConfigPanel 用 entryStrategy 初始化
  → useEffect 读取 configSnapshot（GET /api/strategies/:name/config）
```

#### 流 2：配置保存 → 诊断/回测共享

```
ConfigPanel "保存配置"
  → POST /api/strategies/:name/config
  → onConfigSaved() 回调
  → WorkspacePage.setConfigVersion(v => v + 1)
  → Tab 2/3 的 useEffect([configVersion]) 触发
  → 重新 GET /api/strategies/:name/config 刷新 configSnapshot
  → 诊断/回测使用最新配置
```

用 `configVersion` 而非直接传 configSnapshot 的理由：ConfigPanel 保存后配置实际存储在后端，前端重新 GET 保证一致性；configVersion 是轻量触发器，避免在父组件持有 ConfigPanel 的编辑态中间值。

#### 流 3：K线预览

```
ConfigPanel "预览"按钮
  → POST /api/preview
  → 返回 bars + signals
  → setPreviewData(previewData)
  → KlineChart 接收 previewData
  → drawBase() 重绘基础层
  → 用户 hover 信号 → drawOverlay() 局部重绘叠加层（不触发 React 重渲染）
```

#### 流 4：诊断任务

```
DiagnosePanel "运行诊断"
  → POST /api/strategies/:name/diagnostics
  → 返回 task_id
  → useTaskStream(task_id) 订阅 SSE
  → 收到 result → 渲染 IC/相关性/参数敏感性/信号质量
  → 收到 error → 显示错误
```

#### 流 5：回测任务

```
BacktestPanel "运行回测"
  → POST /api/backtest
  → 返回 task_id
  → useTaskStream(task_id) 订阅 SSE
  → 收到 result → 渲染资金曲线/交易明细/指标
  → 收到 error → 显示错误
```

### 状态归属

| 状态 | 持有者 | 理由 |
|------|--------|------|
| `entryStrategy` | WorkspacePage | 从外部带入，全页共享 |
| `activeTab` | WorkspacePage | Tab 切换是页面级交互 |
| `configSnapshot` | WorkspacePage | Tab 2/3 共享读取 |
| `configVersion` | WorkspacePage | 跨 Tab 通信触发器 |
| ConfigPanel 编辑态 | ConfigPanel 内部 | 配置编辑是局部交互 |
| `previewData` | ConfigPanel 内部 | 预览是 Tab 1 内部流程 |
| `hoveredSignal` | KlineChart ref | 不再是 React state |
| 诊断任务状态 | DiagnosePanel 内部 useTaskStream | 局部 |
| 回测任务状态 | BacktestPanel 内部 useTaskStream | 局部 |

### 错误处理

- **configSnapshot 读取失败**：Tab 2/3 显示"配置读取失败，请到参数配置 Tab 重新保存" + 重试按钮。
- **Preview API 失败**：KlineChart 区域显示错误提示 + 重试按钮，不崩溃。
- **KlineChart bars 超过 MAX_BARS**：降采样 + UI 提示"数据量较大，已降采样显示 N 条"。
- **诊断/回测任务失败**：复用现有 useTaskStream 的 error 处理。
- **entryStrategy 为空**：重定向回策略总览（兜底）。

## 测试与验证

### 验证命令（AGENT.md 强制要求）

```bash
npm test            # vitest 单元测试
npm run build       # TypeScript 类型检查 + Vite 构建
npm list --depth=0  # 依赖树完整性
```

### 测试分层

#### 层 1：纯函数单元测试（vitest）

从 KlineChart 抽取纯函数：

```typescript
normalizeBars(bars: RawBar[]): NormalizedBar[]
computeLayout(width, height, bars.length, hasSubChart): ChartLayout
downsample<T>(arr: T[], maxCount: number): T[]
maxByReduce(arr: number[]): number
```

测试用例覆盖空数组/单条/正常/异常/大数组/边界。

StrategyGridNew 分组逻辑已有测试，确认仍通过。

#### 层 2：组件交互测试（vitest + @testing-library/react）

```typescript
// strategy-page.test.tsx
- 渲染策略总览，按 category/subcategory 正确分组
- 点击卡片 → 调用 onEnterWorkspace（不再有 config 视图切换）
- disabled 卡片不响应点击

// workspace-page.test.tsx
- 默认 activeTab === 'config'
- 三 Tab 切换正常
- ConfigPanel onConfigSaved 调用后 configVersion 递增
- Tab 2/3 在无 configSnapshot 时显示空态提示
- 回测表单只包含运行参数
```

#### 层 3：构建验证

`npm run build` 验证 TypeScript 类型检查 + Vite 构建成功，产物大小无异常增长。

#### 层 4：手动视觉验证

K线图性能验证：

| 场景 | 通过标准 |
|------|----------|
| 150 bars hover | CPU 不持续 100%，无卡顿 |
| 850 bars hover（东财同级） | 流畅，<16ms/帧 |
| 1500 bars hover | 可接受，无明显掉帧 |
| 1501+ bars 降采样 | UI 提示"已降采样"，不崩溃 |
| 切换子分类 | 副图正确刷新 |
| 切换策略 | 图表正确刷新 |

三 Tab 流转验证：
- 策略总览点卡片 → 进入研究台 config Tab + 侧边栏高亮 workspace
- ConfigPanel 保存 → 切到 diagnose Tab → 配置已更新
- diagnose 运行 → 切到 backtest Tab → 回测表单可用
- 无 configSnapshot 时 Tab 2/3 空态提示

回归验证：
- Dashboard / 回测报告 / 因子工坊 / 数据中心 / 任务中心页面不受影响
- 双语切换正常

### 性能验收基线

- 鼠标 hover 信号：单次 `drawOverlay` 执行时间 < 2ms
- 基础层重绘：`drawBase` 在 850 bars 时 < 16ms
- 无循环重绘：Performance 面板不出现连续的 canvas 重绘帧（鼠标静止时 0 绘制）
- 内存稳定：hover 1000 次后堆内存无持续增长

## 边界合规性

| 规则 | 符合性 |
|------|--------|
| 前端 Agent 只改 `apps/web` | 所有改动限于 `apps/web/src` |
| 不引入路由/状态库/后端请求 | 仍是 state 导航 + useState/useRef，复用现有 API |
| 不使用 mock data | 数据全部来自真实 API |
| 不把静态卡片全做成按钮 | 整卡点击进入研究台是真实研究动作 |
| 新增 UI 文案进入 zh.ts/en.ts | Tab 标题/降采样提示将进入国际化文件 |
| 类型归属原则 | `WorkspaceTab` 是纯前端 UI 状态，定义在 workspace-page.tsx 内 |
| 修改后运行验证命令 | 实施阶段执行 npm test / npm run build / npm list |
| 同步更新 README.md 和 AGENT.md | 实施完成后更新 |
| KISS 原则 | DiagnosePanel/BacktestPanel 同文件，不引入 WebGL/虚拟化 |
| 依赖白名单 | 不新增跨包依赖 |

## 实施完成后的文档同步

- 更新 `apps/web/README.md`：研究台 Tab 结构、K线图性能基线。
- 更新 `apps/web/AGENT.md`：当前阶段补"研究台三 Tab 架构 + K线双 canvas 分层"。
- 按需同步根级 `README.md`。
