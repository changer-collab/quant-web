# QuantForge 前端页面视觉优化方案

> **For agentic workers:** 使用 subagent-driven-development 按任务逐个实现。

**目标:** 在不改变功能逻辑的前提下，全面提升 QuantForge 前端的视觉设计质量、动效细节和信息层次感，打造更具沉浸感的量化研究工具界面。

**设计方向:** "Dark Quant Command Center" — 黑暗量化指挥中心风格。在现有暗色金融风基础上，强化数据密度感、层次感和动效品质，让界面更接近专业交易终端的气质。

**核心原则:**
- 不改变现有组件结构和数据流
- 只增强 CSS 样式、动画、布局细节
- 保持一致的 design token 体系
- 不引入新的运行时依赖

**现有设计基线:** 暗色主题 (`--bg: #08100f`)、绿色主色调 (`--green: #4df0a0`)、青色辅助 (`--cyan: #62d8ff`)、字体栈 IBM Plex Sans + Georgia + Cascadia Code、CSS Modules + tokens.css 设计令牌体系。

---

## 文件结构（涉及的改动）

```
apps/web/src/
├── index.html                          # Modify: 字体预加载链接
├── styles/
│   ├── tokens.css                      # Modify: 新增令牌，补充渐变/阴影/字体
│   ├── layout.module.css               # Modify: 增强侧栏和主体布局细节
│   ├── nav.module.css                  # Modify: 增强导航动效
│   ├── hero.module.css                 # Modify: 重构 Hero 区域的视觉层次
│   ├── buttons.module.css              # Modify: 增强按钮动效
│   ├── chart.module.css                # Modify: 重构图表示意，增加动效
│   ├── table.module.css                # Modify: 优化表格交互细节
│   ├── info-panel.module.css           # Modify: 增强信息面板质感
│   ├── workspace.module.css            # Modify: 优化工作区布局细节
│   ├── mode-tabs.module.css            # Modify: 增强模式切换动效
│   ├── factor-lab.module.css           # Modify: 优化因子工坊视觉
│   ├── activity-feed.module.css        # Modify: 增强活动时间线动效
│   ├── data-coverage.module.css        # Modify: 优化数据面板细节
│   ├── backtest-history.module.css     # Modify: 优化回测历史列表
│   ├── experiment-table.module.css     # Modify: 优化实验表格
│   ├── jobs.module.css                 # Modify: 优化任务卡片动效
│   ├── settings.module.css             # Modify: 优化设置面板
│   ├── strategy-grid.module.css        # Modify: 优化策略卡片
│   ├── report.module.css               # Modify: 优化报告页面
│   ├── report-overview.module.css      # Modify: 优化报告概览
│   ├── report-charts.module.css        # Modify: 增强报告图表
│   ├── report-metrics.module.css       # Modify: 优化报告指标卡
│   ├── report-tables.module.css        # Modify: 优化报告表格
│   └── report-section.module.css       # Modify: 优化报告章节
```

---

### Task 1: 设计令牌体系增强 — tokens.css

**文件:** `apps/web/src/styles/tokens.css`

**概述:** 扩充 design token 体系，新增渐变、阴影、动效时长、z-index 层级等令牌，为后续优化提供统一基础。

- [ ] **Step 1: 新增渐变和阴影令牌**

在 `:root` 中添加新的 CSS 自定义属性：

```css
/* ── 新增 Tokens ── */

/* 渐变 */
--gradient-panel: linear-gradient(135deg, rgba(17, 25, 23, 0.96), rgba(22, 33, 31, 0.82));
--gradient-panel-hover: linear-gradient(135deg, rgba(17, 25, 23, 0.98), rgba(22, 33, 31, 0.9));
--gradient-accent: linear-gradient(135deg, var(--green), var(--cyan));
--gradient-accent-subtle: linear-gradient(90deg, rgba(77, 240, 160, 0.14), rgba(98, 216, 255, 0.04));
--gradient-green-glow: linear-gradient(180deg, rgba(77, 240, 160, 0.9), rgba(77, 240, 160, 0.08));

/* 阴影 */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.5);
--shadow-glow-green: 0 0 20px rgba(77, 240, 160, 0.35);
--shadow-glow-cyan: 0 0 20px rgba(98, 216, 255, 0.25);

/* 动效时长 */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-expo: cubic-bezier(0.87, 0, 0.13, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-fast: 0.15s;
--duration-normal: 0.25s;
--duration-slow: 0.4s;

/* Z-index 层级 */
--z-sidebar: 100;
--z-topbar: 90;
--z-overlay: 200;
--z-modal: 300;

/* 圆角 */
--radius-sm: 2px;
--radius-md: 4px;
--radius-lg: 8px;

/* 新字体选项（保留现有字体作为 fallback） */
--font-display: "Fraunces", Georgia, serif;
```

- [ ] **Step 2: 优化 body 背景**

将 body 背景中的网格线颜色略微调亮，增加一个径向光晕层：

```css
body {
  background:
    linear-gradient(90deg, rgba(77, 240, 160, 0.06) 1px, transparent 1px),
    linear-gradient(rgba(98, 216, 255, 0.04) 1px, transparent 1px),
    radial-gradient(ellipse at 20% 50%, rgba(77, 240, 160, 0.06), transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(98, 216, 255, 0.05), transparent 40%),
    var(--bg);
  background-size: 28px 28px, 28px 28px, auto, auto, auto;
}
```

- [ ] **Step 3: 新增关键帧动画**

在 `/* ── Animations ── */` 部分新增动效定义：

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes breathe {
  0%, 100% { opacity: 0.8; }
  50%      { opacity: 1; }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes pulseGlowIntense {
  0%, 100% { box-shadow: 0 0 18px var(--green); }
  50%      { box-shadow: 0 0 35px var(--green), 0 0 60px rgba(77, 240, 160, 0.2); }
}

/* 数据变化动效 */
@keyframes dataFlash {
  0%   { background-color: rgba(77, 240, 160, 0.2); }
  100% { background-color: transparent; }
}

@keyframes borderGlow {
  0%, 100% { border-color: var(--line); }
  50%      { border-color: rgba(77, 240, 160, 0.3); }
}
```

- [ ] **Step 4: 新增动画工具类**

```css
.scaleIn   { animation: scaleIn 0.35s var(--ease-out-expo) both; }
.slideDown { animation: slideDown 0.3s ease-out both; }
.slideUpFade { animation: slideUpFade 0.4s var(--ease-out-expo) both; }
```

---

### Task 2: index.html — 字体预加载

**文件:** `apps/web/index.html`

**概述:** 预加载优化后的字体，减少 FOIT（Flash of Invisible Text）。

- [ ] **Step 1: 添加字体预加载和 font-display 优化**

在 `<head>` 中添加：

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuantForge | HFT & AI Strategy Research</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <!-- IBM Plex Sans + Fraunces (display) + JetBrains Mono (code) -->
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700;9..144,800&family=IBM+Plex+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
```

> 注意：Fraunces 作为 display 字体替代 Georgia，JetBrains Mono 替代 Cascadia Code（作为可选增强）。保留 IBM Plex Sans 作为正文字体保持不变。

---

### Task 3: 布局增强 — layout.module.css

**文件:** `apps/web/src/styles/layout.module.css`

**概述:** 增强侧栏和主体布局的质感，添加更精细的视觉分割和滚动条美化。

- [ ] **Step 1: 增强侧栏背景**

```css
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  padding: var(--space-xl) var(--space-lg);
  border-right: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(8, 16, 15, 0.95), rgba(10, 20, 18, 0.92));
  backdrop-filter: blur(24px);
  z-index: var(--z-sidebar);
}

/* 添加侧栏底部装饰线 */
.sidebar::after {
  content: '';
  position: absolute;
  right: -1px;
  top: 10%;
  height: 80%;
  width: 1px;
  background: linear-gradient(180deg, transparent, var(--green), transparent);
  opacity: 0.15;
  pointer-events: none;
}
```

- [ ] **Step 2: 增强品牌标识动画**

```css
.brandIcon {
  /* ... 保留现有样式 ... */
  transition: transform 0.3s var(--ease-spring), box-shadow 0.3s;
}

.brand:hover .brandIcon {
  transform: rotate(-8deg) scale(1.05);
}
```

- [ ] **Step 3: 美化滚动条**

```css
.mainShell {
  /* ... 保留现有样式 ... */
  scrollbar-width: thin;
  scrollbar-color: var(--line) transparent;
}

.mainShell::-webkit-scrollbar {
  width: 6px;
}

.mainShell::-webkit-scrollbar-track {
  background: transparent;
}

.mainShell::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}

.mainShell::-webkit-scrollbar-thumb:hover {
  background: var(--muted);
}
```

- [ ] **Step 4: 增强 Topbar**

```css
.topbar {
  /* ... 保留现有样式 ... */
  border-bottom: 1px solid transparent;
  background: linear-gradient(180deg, rgba(8, 16, 15, 0.6), transparent);
  padding-bottom: var(--space-md);
}

.statusLight {
  /* ... 保留现有样式 ... */
  animation: pulseGlowIntense 2.5s ease-in-out infinite;
}
```

- [ ] **Step 5: 优化内容网格间距**

```css
.contentGrid {
  /* 微调比例，让主内容区稍宽 */
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.45fr);
  gap: var(--space-2xl);
  margin-top: var(--space-2xl);
}
```

---

### Task 4: 导航增强 — nav.module.css

**文件:** `apps/web/src/styles/nav.module.css`

**概述:** 优化导航项目的交互反馈和视觉层次。

- [ ] **Step 1: 增强导航项 hover 效果**

```css
.navItem {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.navItem:hover {
  transform: translateX(4px);
  border-color: rgba(77, 240, 160, 0.25);
  background: linear-gradient(90deg, rgba(77, 240, 160, 0.12), rgba(98, 216, 255, 0.03));
}

.navItemActive {
  /* 激活态更强 */
  color: var(--text);
  border-color: rgba(77, 240, 160, 0.3);
  background: linear-gradient(90deg, rgba(77, 240, 160, 0.18), rgba(98, 216, 255, 0.05));
}

/* 激活标签颜色变化 */
.navItemActive .navEyebrow {
  color: var(--green);
}
```

- [ ] **Step 2: 增强左侧指示条动画**

```css
.navItem::before {
  /* ... 保留现有样式 ... */
  border-radius: 0 2px 2px 0;
}

.navItemActive::before {
  transform: scaleY(1);
  box-shadow: 0 0 10px rgba(77, 240, 160, 0.3);
}
```

---

### Task 5: Hero 区域增强 — hero.module.css

**文件:** `apps/web/src/styles/hero.module.css`

**概述:** 让 Hero 区域更具视觉冲击力，使用渐变边框、更丰富的背景纹理和精炼的排版。

- [ ] **Step 1: 增强 Hero 面板**

```css
.hero {
  /* ... 保留现有样式 ... */
  border: 1px solid transparent;
  background:
    linear-gradient(135deg, rgba(17, 25, 23, 0.96), rgba(22, 33, 31, 0.82)) padding-box,
    linear-gradient(135deg, rgba(77, 240, 160, 0.15), rgba(98, 216, 255, 0.05), transparent) border-box;
  position: relative;
  overflow: hidden;
}

/* 顶部光晕装饰 */
.hero::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(77, 240, 160, 0.04), transparent 60%);
  pointer-events: none;
}
```

- [ ] **Step 2: 优化标题排版**

```css
.heroTitle {
  /* ... 保留现有样式 ... */
  font-family: var(--font-display);
  font-weight: 700;
  font-variation-settings: 'opsz' 144;
}
```

- [ ] **Step 3: 增强 Metric 卡片**

```css
.metric {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

.metric::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
  opacity: 0;
  transition: opacity 0.3s;
}

.metric:hover::after {
  opacity: 0.6;
}

.metric:hover {
  border-color: rgba(77, 240, 160, 0.35);
  background: rgba(8, 16, 15, 0.85);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.metricValue {
  /* ... 保留现有样式 ... */
  font-family: var(--font-mono);
  font-weight: 600;
  letter-spacing: -0.02em;
}
```

---

### Task 6: 按钮动效增强 — buttons.module.css

**文件:** `apps/web/src/styles/buttons.module.css`

**概述:** 为所有按钮添加涟漪动效和更丰富的交互反馈。

- [ ] **Step 1: 主按钮涟漪效果**

```css
.primaryAction::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.15), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.primaryAction:hover::after {
  opacity: 1;
}

.primaryAction:active {
  transform: scale(0.96);
  transition-duration: 0.05s;
}
```

- [ ] **Step 2: 次级按钮增强**

```css
.secondaryAction {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.secondaryAction:hover {
  /* ... 保留现有样式 ... */
  transform: translateY(-1px);
}

.secondaryAction:active {
  transform: translateY(0) scale(0.97);
}
```

- [ ] **Step 3: 工作区按钮统一**

```css
.workspaceRunButton {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

/* 添加到 workspace 的按钮特殊样式 */
.workspaceRunButton:hover {
  /* ... 保留现有样式 ... */
  transform: translateY(-1px);
}
```

---

### Task 7: 图表示意重设计 — chart.module.css

**文件:** `apps/web/src/styles/chart.module.css`

**概述:** 将当前的简单柱状图 Mockup 视觉升级，增加更多数据视觉细节和动效。

- [ ] **Step 1: 增强 Chart 背景**

```css
.chartPanel {
  /* ... 保留现有样式 ... */
  background:
    linear-gradient(90deg, rgba(230, 238, 233, 0.04) 1px, transparent 1px),
    linear-gradient(rgba(230, 238, 233, 0.04) 1px, transparent 1px),
    radial-gradient(ellipse at 30% 40%, rgba(77, 240, 160, 0.03), transparent 50%),
    radial-gradient(ellipse at 70% 60%, rgba(98, 216, 255, 0.02), transparent 40%),
    rgba(17, 25, 23, 0.9);
  background-size: 60px 60px, 60px 60px, auto, auto, auto;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 2: 优化柱状图样式**

```css
.bar {
  /* ... 保留现有样式 ... */
  min-width: 16px;
  background: var(--gradient-green-glow);
  border-radius: 2px 2px 0 0;
  animation: barGrow 0.7s var(--ease-out-expo) both;
}

.bar:nth-child(odd) {
  background: linear-gradient(180deg, rgba(98, 216, 255, 0.8), rgba(98, 216, 255, 0.06));
}

.bar:hover {
  opacity: 0.8;
  transform: scaleY(1.05);
  transform-origin: bottom;
}
```

- [ ] **Step 3: 增强趋势线动效**

```css
.chartLine {
  /* ... 保留现有样式 ... */
  border-top: 2px solid;
  border-image: linear-gradient(90deg, var(--cyan), var(--green)) 1;
  transform: skewY(-6deg);
  filter: drop-shadow(0 0 20px rgba(98, 216, 255, 0.35));
  animation: chartLineReveal 1.2s var(--ease-out-expo) 0.3s both;
  transform-origin: left;
}

@keyframes chartLineReveal {
  from { transform: skewY(-6deg) scaleX(0); }
  to   { transform: skewY(-6deg) scaleX(1); }
}
```

- [ ] **Step 4: 优化交易点标记**

```css
.tradeDot {
  /* ... 保留现有样式 ... */
  border-radius: 50%;
  animation: tradeDotPulse 2s ease-in-out infinite;
}

.buyDot {
  /* ... 保留现有样式 ... */
  box-shadow: 0 0 12px rgba(77, 240, 160, 0.5);
}

.sellDot {
  /* ... 保留现有样式 ... */
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.5);
}

@keyframes tradeDotPulse {
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50%      { transform: scale(1.4); opacity: 0.5; }
}
```

---

### Task 8: 表格交互优化 — table.module.css

**文件:** `apps/web/src/styles/table.module.css`

**概述:** 美化表格交互细节，添加行 hover 增强效果和选中态。

- [ ] **Step 1: 增强表格面板**

```css
.tablePanel {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.tablePanel th {
  /* ... 保留现有样式 ... */
  font-weight: 700;
  letter-spacing: 0.06em;
}

.tablePanel tbody tr {
  transition: background 0.15s, transform 0.1s;
}

.clickableRow:hover {
  background: rgba(77, 240, 160, 0.08);
  cursor: pointer;
}

.selectedRow {
  background: rgba(77, 240, 160, 0.1);
  position: relative;
}

.selectedRow td:first-child {
  box-shadow: inset 3px 0 0 var(--green);
}
```

---

### Task 9: 信息面板增强 — info-panel.module.css

**文件:** `apps/web/src/styles/info-panel.module.css`

**概述:** 优化信息面板的层级感和 Chip 标签的交互。

- [ ] **Step 1: 增强面板样式**

```css
.infoPanel {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  position: relative;
}

.infoPanel h3 {
  /* ... 保留现有样式 ... */
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
}
```

- [ ] **Step 2: 增强 Chip 标签**

```css
.chip {
  /* ... 保留现有样式 ... */
  border-radius: 3px;
  cursor: default;
  transition: border-color 0.2s, color 0.2s, background 0.2s, transform 0.15s;
}

.chip:hover {
  /* ... 保留现有样式 ... */
  transform: translateY(-1px);
}
```

---

### Task 10: 工作区优化 — workspace.module.css

**文件:** `apps/web/src/styles/workspace.module.css`

**概述:** 优化代码面板和配置面板的视觉细节。

- [ ] **Step 1: 增强工作区网格**

```css
.workspaceGrid {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.codePanel {
  /* ... 保留现有样式 ... */
  background: rgba(8, 16, 15, 0.6);
}

.panelTitle {
  /* ... 保留现有样式 ... */
  font-size: 11px;
  letter-spacing: 0.06em;
}

.codeBlock {
  /* ... 保留现有样式 ... */
  font-family: var(--font-mono);
  font-feature-settings: 'liga' 0;
}

.configItem {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}
```

---

### Task 11: 模式切换标签优化 — mode-tabs.module.css

**文件:** `apps/web/src/styles/mode-tabs.module.css`

**概述:** 增强模式切换标签的交互反馈。

- [ ] **Step 1: 增强 Tab 样式**

```css
.modeTab {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  transition: border-color 0.25s, background 0.3s, color 0.2s, transform 0.2s var(--ease-spring);
}

.modeTab:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}

.modeTab:active {
  transform: translateY(-1px) scale(0.98);
}
```

- [ ] **Step 2: 优化 summary 区域**

```css
.modeSummary {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  background: linear-gradient(135deg, rgba(17, 25, 23, 0.95), rgba(22, 33, 31, 0.85));
}

.modeSummaryTitle {
  /* ... 保留现有样式 ... */
  font-family: var(--font-display);
  font-weight: 700;
}
```

---

### Task 12: 因子工坊优化 — factor-lab.module.css

**文件:** `apps/web/src/styles/factor-lab.module.css`

**概述:** 优化因子表格、IC 图表、分组卡片等子组件的视觉细节。

- [ ] **Step 1: 增强因子表格**

```css
.factorTablePanel {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.factorTable th {
  /* ... 保留现有样式 ... */
  font-weight: 700;
  letter-spacing: 0.06em;
}
```

- [ ] **Step 2: 优化 IC 柱状图**

```css
.icSeries {
  /* ... 保留现有样式 ... */
  gap: 6px;
}

.icBar {
  /* ... 保留现有样式 ... */
  border-radius: 2px 2px 0 0;
  transition: background 0.2s, transform 0.2s var(--ease-spring);
}

.icBar:hover {
  /* ... 保留现有样式 ... */
  transform: scaleY(1.12);
  filter: brightness(1.2);
}
```

- [ ] **Step 3: 优化分组卡片**

```css
.groupCard {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  transition: border-color 0.2s, background 0.2s, transform 0.2s var(--ease-spring);
}

.groupCard:hover {
  /* ... 保留现有样式 ... */
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.groupLabel {
  /* ... 保留现有样式 ... */
  font-weight: 700;
  letter-spacing: 0.03em;
}

.groupValue {
  /* ... 保留现有样式 ... */
  font-family: var(--font-mono);
  font-weight: 600;
}
```

---

### Task 13: 活动时间线增强 — activity-feed.module.css

**文件:** `apps/web/src/styles/activity-feed.module.css`

**概述:** 优化活动时间线的视觉连接和状态指示器。

- [ ] **Step 1: 增强时间线连接线**

```css
.timeline {
  /* ... 保留现有样式 ... */
  position: relative;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: linear-gradient(180deg, var(--line), rgba(38, 54, 50, 0.2));
  pointer-events: none;
}

.item {
  /* ... 保留现有样式 ... */
  position: relative;
}

.item:last-child .dot::after {
  display: none;
}
```

- [ ] **Step 2: 优化状态点**

```css
.dot {
  /* ... 保留现有样式 ... */
  position: relative;
  z-index: 1;
  transition: transform 0.2s var(--ease-spring), box-shadow 0.2s;
}

.item:hover .dot {
  transform: scale(1.3);
}

.dotRunning {
  /* ... 保留现有样式 ... */
  animation: statusPulse 1.5s ease-in-out infinite;
}

.body strong {
  /* ... 保留现有样式 ... */
  transition: color 0.15s;
}

.item:hover .body strong {
  color: var(--green);
}
```

---

### Task 14: 数据面板优化 — data-coverage.module.css

**文件:** `apps/web/src/styles/data-coverage.module.css`

**概述:** 优化数据覆盖度面板的统计卡片和进度条。

- [ ] **Step 1: 增强统计卡片**

```css
.panel {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.statCard {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  transition: border-color 0.2s, background 0.2s, transform 0.2s var(--ease-spring);
}

.statCard:hover {
  border-color: rgba(77, 240, 160, 0.25);
  background: rgba(8, 16, 15, 0.6);
  transform: translateY(-2px);
}
```

- [ ] **Step 2: 优化进度条**

```css
.barTrack {
  /* ... 保留现有样式 ... */
  background: rgba(98, 216, 255, 0.06);
}

.barFill {
  /* ... 保留现有样式 ... */
  transition: width 0.8s var(--ease-out-expo);
  position: relative;
}

.barFill::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: 20px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15));
  border-radius: 0 3px 3px 0;
}
```

---

### Task 15: 回测历史和任务列表优化

**文件:** `apps/web/src/styles/backtest-history.module.css`, `apps/web/src/styles/jobs.module.css`

**概述:** 优化列表项卡片样式和进度条动画。

- [ ] **Step 1: 增强回测历史列表项** (`backtest-history.module.css`)

```css
.item {
  /* ... 保留现有样式 ... */
  transition: border-color 0.2s, background 0.2s, transform 0.15s;
}

.item:hover {
  /* ... 保留现有样式 ... */
  transform: translateX(3px);
}

.itemName {
  /* ... 保留现有样式 ... */
  transition: color 0.15s;
}

.item:hover .itemName {
  color: var(--green);
}
```

- [ ] **Step 2: 增强任务卡片** (`jobs.module.css`)

```css
.jobCard {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}

.jobCard:hover {
  /* ... 保留现有样式 ... */
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.progress {
  /* ... 保留现有样式 ... */
  border-radius: calc(var(--progress-height) / 2);
}

.progressBar {
  /* ... 保留现有样式 ... */
  border-radius: calc(var(--progress-height) / 2);
  background: linear-gradient(90deg, var(--green), var(--cyan));
}
```

---

### Task 16: 报告相关样式优化

**文件:**
- `apps/web/src/styles/report.module.css`
- `apps/web/src/styles/report-overview.module.css`
- `apps/web/src/styles/report-charts.module.css`
- `apps/web/src/styles/report-metrics.module.css`
- `apps/web/src/styles/report-tables.module.css`
- `apps/web/src/styles/report-section.module.css`

**概述:** 统一优化报告页面的视觉质感。

- [ ] **Step 1: 增强报告容器** (`report.module.css`)

```css
.fullReport {
  /* ... 保留现有样式 ... */
  animation: scaleIn 0.35s var(--ease-out-expo) both;
}

.reportHeader {
  /* ... 保留现有样式 ... */
  padding-bottom: var(--space-lg);
  border-bottom: 1px solid var(--line);
}

.reportTitle {
  /* ... 保留现有样式 ... */
  font-family: var(--font-display);
}

.tabNav {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  gap: 2px;
}

.tabBtn {
  /* ... 保留现有样式 ... */
  border-radius: 2px;
  transition: all 0.2s;
}

.tabActive {
  /* ... 保留现有样式 ... */
  box-shadow: 0 0 12px rgba(77, 240, 160, 0.2);
}

.tabContent {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 2: 增强报告概览** (`report-overview.module.css`)

```css
.panel {
  /* ... 保留现有样式 ... */
  animation: scaleIn 0.3s var(--ease-out-expo) both;
}

.logicCard {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  transition: border-color 0.2s;
}

.logicCard:hover {
  border-color: rgba(77, 240, 160, 0.15);
}

.metaItem {
  /* ... 保留现有样式 ... */
  border-radius: var(--radius-sm);
  transition: border-color 0.2s, background 0.2s;
}

.metaItem:hover {
  border-color: rgba(77, 240, 160, 0.15);
  background: rgba(8, 16, 15, 0.5);
}
```

- [ ] **Step 3: 增强报告图表** (`report-charts.module.css`)

先读取现有内容：

```
Read: apps/web/src/styles/report-charts.module.css
```

为 equity curve 区域添加渐变背景和动效。

- [ ] **Step 4: 增强报告指标卡** (`report-metrics.module.css`)

```
Read: apps/web/src/styles/report-metrics.module.css
```

为指标卡片添加与 Hero Metric 一致的 hover 效果。

- [ ] **Step 5: 增强报告表格** (`report-tables.module.css`)

```
Read: apps/web/src/styles/report-tables.module.css
```

统一表格交互与全局表格风格一致。

- [ ] **Step 6: 增强报告章节** (`report-section.module.css`)

```
Read: apps/web/src/styles/report-section.module.css
```

优化章节面板的层级感。

---

### Task 17: 应用页面过渡动画 — App.tsx

**文件:** `apps/web/src/App.tsx`

**概述:** 在页面切换时添加过渡动画，使用 CSS animation 实现内容区域的淡入效果。

- [ ] **Step 1: 为主内容区域添加页面过渡容器**

在 `<main className={layout.mainShell}>` 内部，包裹 page-dependent 内容的区域添加 key 驱动动画：

```tsx
<section key={state.activePage} className={layout.pageTransition}>
  {/* ... page content ... */}
</section>
```

- [ ] **Step 2: 在 layout.module.css 中定义 pageTransition**

```css
.pageTransition {
  animation: pageEnter 0.35s var(--ease-out-expo) both;
}

@keyframes pageEnter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

---

## 执行顺序

1. **Task 1** (tokens.css) — 基础，必须先做
2. **Task 2** (index.html) — 字体加载，可并行于 Task 3-4
3. **Task 3-4** (layout, nav) — 布局和导航
4. **Task 5** (hero) — Hero 区域
5. **Task 6** (buttons) — 按钮
6. **Task 7** (chart) — 图表
7. **Task 8-9** (table, info-panel) — 通用组件
8. **Task 10-11** (workspace, mode-tabs) — 工作区
9. **Task 12** (factor-lab) — 因子工坊
10. **Task 13-15** (activity-feed, data-coverage, backtest-history, jobs) — 其他页面
11. **Task 16** (report styles) — 报告页面
12. **Task 17** (App.tsx 页面过渡) — 最终整合

---

## 自检清单

- [ ] 所有 CSS 变更不破坏现有布局
- [ ] 所有动画使用 `prefers-reduced-motion: reduce` 时优雅降级（通过移除 animation）
- [ ] 不引入新的 npm 依赖
- [ ] 不修改组件逻辑和数据结构
- [ ] 设计令牌变更在 tokens.css 中集中管理
- [ ] 动效时长保持一致性（fast/normal/slow）
- [ ] 颜色变更保持现有调色板体系（不引入突兀的新色）