# Workspace 卡片化与视觉分隔设计

- 日期：2026-07-10
- 范围：`apps/web` 的 Workspace 页面（config / diagnose / backtest 三个 tab 的所有可视化块）
- 风格方向：实体卡片 + 阴影层次（复用项目现有 `--shadow-md` / `--gradient-panel` / `--radius-lg` token）
- 方案：B（统一升级全 workspace 卡片，不抽 React 组件，纯 CSS module + className 调整）

## 背景与问题

当前 workspace 页面存在两个视觉问题：

1. **config tab 两栏无卡片包装**：左 ConfigPanel 顶层是裸 `<div style={{display:'flex',flexDirection:'column',height:'100%}}>`，右 KlineChart 顶层 `.klineContainer` 只有 `rgba(6,14,13,0.8)` 背景色，无边框/圆角/阴影。两块"散"在页面背景上，缺乏区域分隔与层次感。
2. **diagnose tab 的 `.chartCard` 样式较平**：已有 `gradient-panel + border + radius-sm(2px)`，但无阴影层次，标题栏（`.chartCardTitle`）与内容区无明确分隔（仅 margin-bottom），圆角偏小（2px）与整体不协调。

项目设计 token 系统（`tokens.css`）完备，已定义 `--shadow-sm/md/lg`、`--gradient-panel`、`--radius-sm(2)/md(4)/lg(8)`、`--glass-*` 等，可直接复用，无需新增 token。

## 设计目标

- 每一个图（K 线、诊断图、回测图）都有清晰的卡片边界
- 全 workspace 视觉语言统一（圆角、阴影、头部、间距）
- 不引入过早抽象（YAGNI）：不抽 `<Card>` React 组件，仅用 CSS module + className
- 复用现有 token，不新增设计变量
- 数据可读性优先（canvas 不受 blur 影响）

## 统一卡片视觉规范

在 `workspace-page.module.css` 新增可复用卡片类，供 config tab 和诊断 tab 共用：

```css
.card {
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);   /* 8px */
  box-shadow: var(--shadow-md);       /* 0 4px 12px rgba(0,0,0,0.4) */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cardHeader {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.cardTitle {
  font-size: var(--text-sm);          /* 12px */
  font-weight: 700;
  color: var(--green);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cardBody {
  padding: 16px;
  flex: 1;
  min-height: 0;
}
```

## 各区域改动

### 1. Config tab — 两栏卡片包装

`workspace-page.tsx` 第 1028-1051 行 `.configTabLayout` 两栏：

- **左栏 ConfigPanel**：外层包 `<div className={s.card}>`，加 `.cardHeader`（标题 "Configuration" / 对应 ui 文案），`.cardBody` 内放 ConfigPanel
- **右栏 KlineChart**：外层包 `<div className={s.card}>`，KlineChart 内部 `.klineContainer` 去掉自带背景（由卡片提供）。toolbar 作为卡片头部（已有 border-bottom），chartWrapper 作为卡片体，signalBar 作为卡片底栏（已有 border-top）

### 2. K 线内部结构 — 内分隔优化

`kline-chart.module.css`：

- `.klineContainer`：移除 `background: rgba(6,14,13,0.8)`（卡片提供背景），保留 flex 布局与 min-height
- `.toolbar`：保持现有 `border-bottom`，作为卡片头部组成
- `.chartWrapper`：作为卡片主体，flex:1
- `.signalBar`：保持现有 `border-top`，作为卡片底栏；padding 从 `4px 12px` 微调到 `6px 16px` 与卡片头部对齐

顶部 search/badge 与底部信号栏形成天然三层结构（头部/主体/底栏），无需额外分割线。

### 3. Diagnose tab — chartCard 升级

`workspace-page.module.css` 的 `.chartCard` / `.chartCardFull`：

- `border-radius: var(--radius-sm)` → `var(--radius-lg)`（2px → 8px，与统一卡片一致）
- 加 `box-shadow: var(--shadow-md)`
- 加 `overflow: hidden`
- 移除 `.chartCard` 现有 `min-height: 200px`（由内容决定）或保留作为最小高度保障

`.chartCardTitle` 升级为 `.cardHeader` 风格：

- 加 `padding: 12px 16px`
- 加 `border-bottom: 1px solid var(--line)`
- `margin-bottom: 12px` → `margin-bottom: 0`
- 内容区包一层 `.cardBody`（padding 16px）

调用点 `workspace-page.tsx` 第 712-779 行：所有 `<div className={s.chartCardTitle}>` 改为 `.cardHeader`，其后内容包 `<div className={s.cardBody}>`。

### 4. ConfigPanel 内部分区

`config-panel.module.css` 的 `.section`：

- 加 `padding: 12px`
- 加 `background: rgba(8,16,15,0.4)`
- 加 `border-radius: var(--radius-md)`（4px，嵌套子卡片比父卡片圆角小一级，形成层次）
- 加 `border: 1px solid rgba(38,54,50,0.5)`（比 --line 更弱，表示嵌套层级）

`.sectionTitle` 保持现有样式，作为子区块标题。

## 间距与响应式

- 卡片间 gap 保持 `16px`（现有 `.configTabLayout` / `.diagnosticGrid` 已有）
- 卡片内 section 间 `gap: 14px`
- 响应式：`@media (max-width: 1024px)` 已有 `.configTabLayout` 单列回退，卡片宽度自适应，无需新增

## 改动文件清单

1. `apps/web/src/styles/workspace-page.module.css` — 新增 `.card`/`.cardHeader`/`.cardBody`/`.cardTitle`；升级 `.chartCard`/`.chartCardFull`（radius-lg + shadow-md + overflow）；`.chartCardTitle` 改为头部风格
2. `apps/web/src/styles/kline-chart.module.css` — `.klineContainer` 去背景；`.signalBar` padding 微调到 `6px 16px`
3. `apps/web/src/styles/config-panel.module.css` — `.section` 加嵌套子卡片样式
4. `apps/web/src/components/workspace-page.tsx` — config tab 两栏包 `.card` + `.cardHeader` + `.cardBody`；诊断 tab 调用点 `.chartCardTitle` → `.cardHeader`，内容包 `.cardBody`
5. `apps/web/src/components/kline-chart.tsx` — 顶层 `.klineContainer` 适配卡片（去自带背景即可，无 JSX 结构改动）
6. `apps/web/src/components/config-panel.tsx` — section className 无需改（CSS 升级即可），仅确认顶层裸 div 适配卡片体

## 不做的事（YAGNI）

- 不抽 `<Card>` React 组件（当前仅 workspace 一个页面有这些图）
- 不新增设计 token（复用现有）
- 不引入 glassmorphism / backdrop-blur（影响 canvas 可读性与性能）
- 不改动 dashboard / strategy-center 等其他页面（聚焦 workspace）
- 不改动 K 线绘制逻辑、信号映射、数据流

## 验证

- `pnpm --filter @quant/web build` 构建通过
- `pnpm --filter @quant/web test` 测试通过
- Playwright 端到端：进入 workspace config tab，K 线与 ConfigPanel 均有卡片包装；进入 diagnose tab，诊断图有阴影层次与头部分隔；console 0 errors
- 视觉检查：卡片圆角 8px 一致，阴影层次清晰，头部与内容区有 border-bottom 分隔
