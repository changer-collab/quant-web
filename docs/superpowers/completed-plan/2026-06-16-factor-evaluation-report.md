# 因子评估报告优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将因子工坊从简单的 3-tab 评估面板升级为专业级 13 模块因子评估报告，覆盖从基本信息到监控指标的全链路分析。

**Architecture:** 采用与回测报告（`report.tsx`）相同的 Tab 导航 + 可折叠 Section 模式。因子评估报告作为独立页面，从因子列表点击"查看报告"进入。新增 `FactorReportFull` 类型承载 13 个模块数据，新增 `factor-report/` 组件目录和配套样式。所有数据当前阶段为 mock，结构与 Python 侧 `FactorEvaluationResult` 对齐。

**Tech Stack:** React 18 + CSS Modules + TypeScript，无额外依赖。图表使用纯 CSS/SVG 实现（与现有 IC 柱状图风格一致）。

---

## 设计系统

| 维度 | 选择 | 说明 |
|------|------|------|
| 风格 | Data-Dense Dashboard | 多图表/控件、KPI 卡片、最小间距、网格布局 |
| 字体 | Fira Code / Fira Sans | 数据密集场景，等宽字体对齐数值 |
| 配色 | 沿用现有深色主题 `var(--green)` / `var(--line)` / `var(--muted)` | 与项目整体一致，不引入新色板 |
| 交互 | Hover tooltip、行高亮、平滑过滤动画、数据加载 spinner | |
| 避免 | 花哨装饰、无过滤的密集数据、emoji 图标 | |

---

## 文件结构

```
apps/web/src/
├── components/
│   ├── factor-lab.tsx                    # 修改：添加"查看报告"入口
│   └── factor-report/                    # 新增目录
│       ├── index.ts
│       ├── FactorReport.tsx              # 报告主容器（13 Tab 导航）
│       ├── FactorReportHeader.tsx        # 报告头部（因子名+评级+日期）
│       ├── FactorReportSection.tsx       # 可折叠 Section
│       ├── FactorBasicInfo.tsx           # 模块1：因子基本信息
│       ├── FactorDescriptiveStats.tsx    # 模块2：描述性统计
│       ├── FactorEffectiveness.tsx       # 模块3：有效性检验（3子tab）
│       ├── FactorRiskAnalysis.tsx        # 模块4：风险分析
│       ├── FactorTurnoverCost.tsx        # 模块5：换手率&交易成本
│       ├── FactorNeutralization.tsx      # 模块6：中性化&剥离
│       ├── FactorDomainAnalysis.tsx      # 模块7：分域表现
│       ├── FactorCorrelation.tsx         # 模块8：相关性分析
│       ├── FactorMultiFactor.tsx         # 模块9：多因子组合贡献
│       ├── FactorEconomicLogic.tsx       # 模块10：经济逻辑&可解释性
│       ├── FactorRobustness.tsx          # 模块11：稳健性检验
│       ├── FactorMonitoring.tsx          # 模块12：监控指标
│       └── FactorConclusion.tsx          # 模块13：结论与建议
├── data/
│   ├── types.ts                          # 修改：新增 FactorReportFull 等类型
│   ├── zh.ts                             # 修改：新增因子报告 mock 数据和 UI 文案
│   └── en.ts                             # 修改：新增因子报告 mock 数据和 UI 文案
├── styles/
│   ├── factor-report.module.css          # 新增：报告主容器样式
│   ├── factor-report-section.module.css  # 新增：报告 Section 样式
│   └── factor-lab.module.css             # 修改：添加"查看报告"按钮样式
└── appData.ts                            # 修改：re-export 新类型
```

---

### Task 1: 新增因子报告类型定义

**Files:**
- Modify: `apps/web/src/data/types.ts`

- [ ] **Step 1: 在 types.ts 末尾添加因子报告类型**

在 `ReportUiCopy` 接口之后添加以下类型定义：

```typescript
// ─── 因子评估报告类型（13 大模块） ──────────────────────────

/** 因子评级 */
export type FactorGrade = 'A' | 'B' | 'C' | 'D';

/** 模块1：因子基本信息 */
export interface FactorReportBasicInfo {
  name: string;
  category: string;
  dataSource: string;
  updateFrequency: string;
  formula: string;
  params: { label: string; value: string }[];
  processing: { standardization: string; winsorization: string; neutralization: string };
  version: string;
  reportDate: string;
  backtestRange: { start: string; end: string };
}

/** 模块2：描述性统计 */
export interface FactorReportDescriptiveStats {
  mean: number;
  std: number;
  median: number;
  percentiles: { p5: number; p25: number; p75: number; p95: number };
  skewness: number;
  kurtosis: number;
  missingRatio: number;
  coverage: number;
  coverageByCap: { cap: string; coverage: number }[];
  timeSeriesStability: number;
  distributionBins: { bin: string; count: number }[];
}

/** 模块3.1：分层回测 */
export interface FactorReportGroupBacktest {
  nGroups: number;
  groupAnnualReturns: { group: string; annualReturn: number }[];
  groupMetrics: { group: string; sharpe: number; maxDrawdown: number; winRate: number }[];
  longShortReturn: number;
  longShortSharpe: number;
  topExcessReturn: number;
  groupNavCurves: { group: string; points: { t: number; nav: number }[] }[];
  longShortNavCurve: { t: number; nav: number }[];
}

/** 模块3.2：IC 分析 */
export interface FactorReportICAnalysis {
  icMean: number;
  icStd: number;
  icWinRate: number;
  rankIcMean: number;
  rankIcStd: number;
  icSeries: { date: string; ic: number; rankIc: number }[];
  icCumulative: { date: string; cumIc: number }[];
  icDecay: { lag: string; ic: number }[];
  icMonthlyDistribution: { bin: string; count: number }[];
}

/** 模块3.3：回归分析 */
export interface FactorReportRegression {
  factorReturn: number;
  tStat: number;
  neweyWestT: number;
  grsStat: number | null;
  grsPValue: number | null;
  rSquared: number;
  factorReturnSeries: { date: string; ret: number }[];
}

/** 模块4：风险分析 */
export interface FactorReportRisk {
  factorVolatility: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  negativeMonthRatio: number;
  regimePerformance: { regime: string; return: number; sharpe: number; drawdown: number }[];
  var95: number;
  cvar95: number;
  exposures: { factor: string; exposure: number }[];
}

/** 模块5：换手率&交易成本 */
export interface FactorReportTurnover {
  monthlyTurnover: number;
  quarterlyTurnover: number;
  singleSideTurnover: number;
  doubleSideTurnover: number;
  costSensitivity: { feeBps: number; navImpact: number }[];
  topHoldingOverlap: number;
}

/** 模块6：中性化&剥离 */
export interface FactorReportNeutralization {
  rawVsNeutralized: { metric: string; raw: number; neutralized: number }[];
  pureAlphaIc: { orthogonalTo: string; ic: number }[];
  redundancyMatrix: { factorA: string; factorB: string; correlation: number }[];
  vif: { factor: string; vif: number }[];
}

/** 模块7：分域表现 */
export interface FactorReportDomain {
  byCap: { cap: string; ic: number; groupReturn: number }[];
  byIndustry: { industry: string; ic: number; groupReturn: number }[];
  byRegime: { regime: string; ic: number; groupReturn: number }[];
  byValuation: { level: string; ic: number; groupReturn: number }[];
  byLiquidity: { level: string; ic: number; groupReturn: number }[];
  byBoard: { board: string; ic: number; groupReturn: number }[];
}

/** 模块8：相关性分析 */
export interface FactorReportCorrelation {
  correlationMatrix: { factorA: string; factorB: string; corr: number }[];
  returnCorrelation: { factorA: string; factorB: string; corr: number }[];
  clusters: { cluster: string; factors: string[] }[];
  pcaVariance: { component: string; variance: number; cumulative: number }[];
}

/** 模块9：多因子组合贡献 */
export interface FactorReportMultiFactor {
  weightInModel: number;
  marginalIcImprovement: number;
  marginalSharpeImprovement: number;
  interactionEffects: { withFactor: string; effect: number }[];
}

/** 模块10：经济逻辑 */
export interface FactorReportEconomicLogic {
  economicExplanation: string;
  literatureRefs: string[];
  aShareSpecific: string;
  dataSnoopingRisk: 'low' | 'medium' | 'high';
}

/** 模块11：稳健性检验 */
export interface FactorReportRobustness {
  paramSensitivity: { paramName: string; variations: { value: string; ic: number; groupReturn: number }[] }[];
  inSampleVsOutOfSample: { metric: string; inSample: number; outOfSample: number }[];
  benchmarkComparison: { benchmark: string; ic: number; groupReturn: number }[];
  weightingComparison: { method: string; ic: number; groupReturn: number }[];
  survivorshipBiasHandled: boolean;
}

/** 模块12：监控指标 */
export interface FactorReportMonitoring {
  realtimeIc: number;
  realtimeIcThreshold: number;
  coverage: number;
  coverageThreshold: number;
  directionReversalCount: number;
  directionReversalThreshold: number;
  extremeValueRatio: number;
  extremeValueThreshold: number;
  dataDelay: string;
  dataDelayThreshold: string;
  alerts: { metric: string; value: string; threshold: string; status: 'normal' | 'warning' | 'critical' }[];
}

/** 模块13：结论与建议 */
export interface FactorReportConclusion {
  grade: FactorGrade;
  gradeReason: string;
  recommendedScenarios: string[];
  riskWarnings: string[];
  nextActions: string[];
}

/** 因子报告 Tab ID */
export type FactorReportTabId =
  | 'basicInfo'
  | 'descriptiveStats'
  | 'effectiveness'
  | 'riskAnalysis'
  | 'turnoverCost'
  | 'neutralization'
  | 'domainAnalysis'
  | 'correlation'
  | 'multiFactor'
  | 'economicLogic'
  | 'robustness'
  | 'monitoring'
  | 'conclusion';

/** 完整因子评估报告 */
export interface FactorReportFull {
  id: string;
  factorId: string;
  factorName: string;
  generatedAt: string;
  basicInfo: FactorReportBasicInfo;
  descriptiveStats: FactorReportDescriptiveStats;
  groupBacktest: FactorReportGroupBacktest;
  icAnalysis: FactorReportICAnalysis;
  regression: FactorReportRegression;
  risk: FactorReportRisk;
  turnover: FactorReportTurnover;
  neutralization: FactorReportNeutralization;
  domain: FactorReportDomain;
  correlation: FactorReportCorrelation;
  multiFactor: FactorReportMultiFactor;
  economicLogic: FactorReportEconomicLogic;
  robustness: FactorReportRobustness;
  monitoring: FactorReportMonitoring;
  conclusion: FactorReportConclusion;
}

/** 因子报告 UI 文案 */
export interface FactorReportUiCopy {
  tabs: Record<FactorReportTabId, string>;
  basicInfo: Record<string, string>;
  descriptiveStats: Record<string, string>;
  effectiveness: Record<string, string>;
  riskAnalysis: Record<string, string>;
  turnoverCost: Record<string, string>;
  neutralization: Record<string, string>;
  domainAnalysis: Record<string, string>;
  correlation: Record<string, string>;
  multiFactor: Record<string, string>;
  economicLogic: Record<string, string>;
  robustness: Record<string, string>;
  monitoring: Record<string, string>;
  conclusion: Record<string, string>;
}
```

- [ ] **Step 2: 更新 appData.ts re-export**

在 `apps/web/src/appData.ts` 的 re-export type 列表中添加新类型：

```typescript
  FactorReportFull,
  FactorReportBasicInfo,
  FactorReportDescriptiveStats,
  FactorReportGroupBacktest,
  FactorReportICAnalysis,
  FactorReportRegression,
  FactorReportRisk,
  FactorReportTurnover,
  FactorReportNeutralization,
  FactorReportDomain,
  FactorReportCorrelation,
  FactorReportMultiFactor,
  FactorReportEconomicLogic,
  FactorReportRobustness,
  FactorReportMonitoring,
  FactorReportConclusion,
  FactorReportTabId,
  FactorReportUiCopy,
  FactorGrade,
```

同时在 accessor re-export 中添加 `getFactorReports` 和 `getFactorReportUiCopy`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/types.ts apps/web/src/appData.ts
git commit -m "feat(web): add factor report type definitions (13 modules)"
```

---

### Task 2: 新增因子报告 Mock 数据（zh.ts + en.ts）

**Files:**
- Modify: `apps/web/src/data/zh.ts`
- Modify: `apps/web/src/data/en.ts`

- [ ] **Step 1: 在 zh.ts 的 LanguageContent 中添加 factorReports 和 factorReportUiCopy**

在 `factorEvalResults` 数组之后添加 `factorReports` 数组（为 EP 因子提供完整 13 模块 mock 数据）和 `factorReportUiCopy` 对象。

EP 因子报告 mock 数据关键数值：

| 模块 | 关键值 |
|------|--------|
| basicInfo | name='EP（盈利收益率）', category='价值', formula='Net Income / Total Market Cap', version='1.2.0', range='2015-01-01 ~ 2025-12-31' |
| descriptiveStats | mean=0.042, std=0.031, skewness=0.68, kurtosis=3.42, coverage=0.92, stability=0.87 |
| groupBacktest | 5 组年化收益 [4.2, 8.7, 12.1, 15.6, 22.6]%, longShort=18.4%, longShortSharpe=2.12 |
| icAnalysis | icMean=0.071, icWinRate=0.72, rankIcMean=0.094, icDecay=[1M:0.071, 3M:0.052, 6M:0.031, 12M:0.012] |
| regression | factorReturn=0.0042, tStat=3.85, neweyWestT=3.21, grsPValue=0.032 |
| risk | volatility=0.068, maxDD=-12.3%, var95=-0.032, cvar95=-0.048 |
| turnover | monthly=0.18, quarterly=0.35, topOverlap=0.72 |
| neutralization | raw IC=0.071 → neutralized=0.048, EP-BP corr=0.82, VIF=2.14 |
| domain | 小盘 ic=0.085 > 中盘 0.078 > 大盘 0.062; 金融 ic=0.092 最高 |
| correlation | EP-BP corr=0.82, clusters=[价值族,质量族,动量族,风险族], PC1=42% |
| multiFactor | weight=0.22, marginalIc=+0.008, marginalSharpe=+0.15 |
| economicLogic | Fama&French 1992, Lakonishok 1994, dataSnoopingRisk=medium |
| robustness | OOS IC=0.063 (vs IS 0.071), 中证1000 ic=0.082 最优 |
| monitoring | 全部 normal, realtimeIc=0.068, coverage=91% |
| conclusion | grade=A, 推荐低频多头增强/多因子对冲/基本面量化 |

完整 mock 数据结构见方案附录 A（实现时直接写入 zh.ts）。

`factorReportUiCopy` 中文版：

```typescript
factorReportUiCopy: {
  tabs: {
    basicInfo: '基本信息', descriptiveStats: '描述性统计', effectiveness: '有效性检验',
    riskAnalysis: '风险分析', turnoverCost: '换手率与成本', neutralization: '中性化与剥离',
    domainAnalysis: '分域表现', correlation: '相关性分析', multiFactor: '多因子贡献',
    economicLogic: '经济逻辑', robustness: '稳健性检验', monitoring: '监控指标', conclusion: '结论与建议',
  },
  basicInfo: { title: '因子基本信息', name: '因子名称', category: '因子类别', dataSource: '数据来源', updateFrequency: '更新频率', formula: '计算逻辑', params: '参数设置', processing: '处理方式', version: '版本号', reportDate: '报告日期', backtestRange: '回测区间' },
  descriptiveStats: { title: '描述性统计', mean: '均值', std: '标准差', median: '中位数', percentiles: '分位数', skewness: '偏度', kurtosis: '峰度', missingRatio: '缺失值比例', coverage: '覆盖度', coverageByCap: '分市值覆盖度', timeSeriesStability: '时序稳定性', distribution: '因子值分布' },
  effectiveness: { title: '因子有效性检验', groupBacktest: '分层回测', icAnalysis: 'IC 分析', regression: '回归分析' },
  riskAnalysis: { title: '因子风险分析', factorVolatility: '因子波动率', maxDrawdown: '最大回撤', maxDrawdownDuration: '回撤持续天数', negativeMonthRatio: '负月占比', regimePerformance: '分市场环境', tailRisk: '尾部风险', exposures: '因子暴露' },
  turnoverCost: { title: '换手率与交易成本', monthlyTurnover: '月度换手率', quarterlyTurnover: '季度换手率', singleSideTurnover: '单边换手', doubleSideTurnover: '双边换手', costSensitivity: '交易成本敏感性', topHoldingOverlap: 'Top 组持仓重叠率' },
  neutralization: { title: '中性化与剥离分析', rawVsNeutralized: '原始 vs 中性化', pureAlphaIc: '纯 Alpha IC', redundancyMatrix: '因子冗余性', vif: '方差膨胀因子' },
  domainAnalysis: { title: '分域表现分析', byCap: '按市值', byIndustry: '按行业', byRegime: '按市场状态', byValuation: '按估值水平', byLiquidity: '按流动性', byBoard: '按上市板' },
  correlation: { title: '因子相关性分析', correlationMatrix: '相关系数矩阵', returnCorrelation: '收益率相关性', clusters: '聚类分析', pca: '主成分分析' },
  multiFactor: { title: '多因子组合贡献', weightInModel: '模型权重', marginalIcImprovement: '边际 IC 提升', marginalSharpeImprovement: '边际夏普提升', interactionEffects: '交互效应' },
  economicLogic: { title: '经济逻辑与可解释性', economicExplanation: '经济学解释', literatureRefs: '文献支持', aShareSpecific: 'A 股特殊性', dataSnoopingRisk: '数据窥探风险' },
  robustness: { title: '稳健性检验', paramSensitivity: '参数敏感性', inSampleVsOutOfSample: '样本内 vs 样本外', benchmarkComparison: '不同基准对比', weightingComparison: '不同加权方式', survivorshipBias: '幸存者偏差' },
  monitoring: { title: '因子监控指标', realtimeIc: '实时 IC', coverage: '因子覆盖度', directionReversal: '方向反转', extremeValueRatio: '极端值比例', dataDelay: '数据延迟', alerts: '告警状态' },
  conclusion: { title: '结论与建议', grade: '因子评级', gradeReason: '评级理由', recommendedScenarios: '推荐使用场景', riskWarnings: '风险提示', nextActions: '下一步行动' },
},
```

- [ ] **Step 2: 在 en.ts 中添加对应的英文版 factorReports 和 factorReportUiCopy**

结构与 zh.ts 完全一致，所有中文文案替换为英文。数值数据保持不变。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/zh.ts apps/web/src/data/en.ts
git commit -m "feat(web): add factor report mock data and UI copy (zh + en)"
```

---

### Task 3: 新增数据访问器

**Files:**
- Modify: `apps/web/src/data/accessors.ts`
- Modify: `apps/web/src/appData.ts`

- [ ] **Step 1: 在 accessors.ts 中添加**

```typescript
export function getFactorReports(language?: LanguageCode) {
  return getContent(language).factorReports;
}

export function getFactorReportUiCopy(language?: LanguageCode) {
  return getContent(language).factorReportUiCopy;
}
```

- [ ] **Step 2: 在 appData.ts 的 accessor re-export 列表中添加 `getFactorReports` 和 `getFactorReportUiCopy`**

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/data/accessors.ts apps/web/src/appData.ts
git commit -m "feat(web): add factor report data accessors"
```

---

### Task 4: 新增因子报告样式

**Files:**
- Create: `apps/web/src/styles/factor-report.module.css`
- Create: `apps/web/src/styles/factor-report-section.module.css`

- [ ] **Step 1: 创建 factor-report.module.css**

核心样式类包括：
- `.factorReport` — 报告容器（grid 布局）
- `.reportHeader` / `.reportEyebrow` / `.reportTitle` / `.reportMeta` — 报告头部
- `.gradeBadge` / `.gradeA` / `.gradeB` / `.gradeC` / `.gradeD` — 评级徽章（48x48，颜色编码）
- `.tabNav` / `.tabButton` — Tab 导航（水平滚动）
- `.kpiGrid` / `.kpiCard` / `.kpiLabel` / `.kpiValue` — KPI 卡片网格
- `.dataTable` — 数据表格
- `.barChartHorizontal` / `.barRow` / `.barLabel` / `.barTrack` / `.barFill` / `.barValue` — 水平条形图
- `.barChartVertical` / `.vBar` — 垂直柱状图（分布直方图）
- `.heatmapGrid` / `.heatmapCell` — 热力图
- `.subTabNav` / `.subTabButton` — 子 Tab 导航
- `.chip` / `.chipWarn` / `.chipDanger` — 标签
- `.formulaBlock` — 公式块
- `.backButton` — 返回按钮
- `.viewReportBtn` — 查看报告按钮
- `.alertNormal` / `.alertWarning` / `.alertCritical` — 告警状态颜色

配色沿用 `var(--green)` / `var(--line)` / `var(--muted)` / `var(--text)` / `var(--gradient-panel)` / `var(--gradient-row-hover)`。

- [ ] **Step 2: 创建 factor-report-section.module.css**

与 `report-section.module.css` 同构：`.section` / `.summary` / `.title` / `.subtitle` / `.chevron` / `.content`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/styles/factor-report.module.css apps/web/src/styles/factor-report-section.module.css
git commit -m "feat(web): add factor report styles"
```

---

### Task 5: 新增因子报告组件 — 基础框架

**Files:**
- Create: `apps/web/src/components/factor-report/FactorReportSection.tsx`
- Create: `apps/web/src/components/factor-report/FactorReportHeader.tsx`
- Create: `apps/web/src/components/factor-report/FactorReport.tsx`
- Create: `apps/web/src/components/factor-report/index.ts`

- [ ] **Step 1: 创建 FactorReportSection.tsx**

可折叠 Section 组件，与 `ReportSection` 同构。Props: `title`, `subtitle?`, `children`, `defaultOpen?`, `className?`。

- [ ] **Step 2: 创建 FactorReportHeader.tsx**

报告头部：返回按钮 + eyebrow + 标题 + 元信息 + 评级徽章。Props: `report: FactorReportFull`, `ui: FactorReportUiCopy`, `onBack?: () => void`。

- [ ] **Step 3: 创建 FactorReport.tsx 主容器**

13-tab 导航 + switch 渲染对应模块组件。Props: `report: FactorReportFull`, `ui: FactorReportUiCopy`, `onBack?: () => void`。

- [ ] **Step 4: 创建 index.ts**

统一导出 `FactorReport`, `FactorReportHeader`, `FactorReportSection`。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/factor-report/
git commit -m "feat(web): add factor report container, header, and section components"
```

---

### Task 6: 新增因子报告组件 — 模块 1~4

**Files:**
- Create: `apps/web/src/components/factor-report/FactorBasicInfo.tsx`
- Create: `apps/web/src/components/factor-report/FactorDescriptiveStats.tsx`
- Create: `apps/web/src/components/factor-report/FactorEffectiveness.tsx`
- Create: `apps/web/src/components/factor-report/FactorRiskAnalysis.tsx`

- [ ] **Step 1: 创建 FactorBasicInfo.tsx**

因子基本信息：KPI 卡片（名称、类别、版本、日期）+ 数据来源 + 公式块 + 参数表 + 处理方式表 + 回测区间。使用 `FactorReportSection` 包裹。

- [ ] **Step 2: 创建 FactorDescriptiveStats.tsx**

描述性统计：KPI 卡片（均值、标准差、中位数、偏度、峰度、缺失率、覆盖度、稳定性）+ 分位数表 + 分市值覆盖度水平条形图 + 分布直方图（垂直柱状图）。

- [ ] **Step 3: 创建 FactorEffectiveness.tsx**

有效性检验（3 子 tab）：
- **分层回测**：分组年化收益水平条形图 + 分组指标表 + 多空净值曲线（SVG 折线图）
- **IC 分析**：IC 时序柱状图 + IC 累积曲线 + IC 衰减条形图 + IC 月度分布直方图 + KPI 卡片
- **回归分析**：KPI 卡片（因子收益率、t 值、Newey-West t、GRS）+ 因子收益率时序图

子 tab 使用 `subTabNav` + `subTabButton` 样式。

- [ ] **Step 4: 创建 FactorRiskAnalysis.tsx**

风险分析：KPI 卡片（波动率、最大回撤、回撤持续、负月占比、VaR、CVaR）+ 分市场环境表 + 因子暴露水平条形图。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/factor-report/FactorBasicInfo.tsx apps/web/src/components/factor-report/FactorDescriptiveStats.tsx apps/web/src/components/factor-report/FactorEffectiveness.tsx apps/web/src/components/factor-report/FactorRiskAnalysis.tsx
git commit -m "feat(web): add factor report modules 1-4"
```

---

### Task 7: 新增因子报告组件 — 模块 5~8

**Files:**
- Create: `apps/web/src/components/factor-report/FactorTurnoverCost.tsx`
- Create: `apps/web/src/components/factor-report/FactorNeutralization.tsx`
- Create: `apps/web/src/components/factor-report/FactorDomainAnalysis.tsx`
- Create: `apps/web/src/components/factor-report/FactorCorrelation.tsx`

- [ ] **Step 1: 创建 FactorTurnoverCost.tsx**

换手率 & 交易成本：KPI 卡片 + 成本敏感性条形图 + 持仓重叠率。

- [ ] **Step 2: 创建 FactorNeutralization.tsx**

中性化 & 剥离：原始 vs 中性化对比表 + 纯 Alpha IC 条形图 + 冗余性矩阵表 + VIF 表。

- [ ] **Step 3: 创建 FactorDomainAnalysis.tsx**

分域表现：6 个维度（市值/行业/市场状态/估值/流动性/上市板）各一个水平条形图，使用 `subTabNav` 切换维度。

- [ ] **Step 4: 创建 FactorCorrelation.tsx**

相关性分析：相关系数矩阵表（带颜色编码）+ 聚类列表 + PCA 方差条形图。使用 `subTabNav` 切换矩阵/聚类/PCA。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/factor-report/FactorTurnoverCost.tsx apps/web/src/components/factor-report/FactorNeutralization.tsx apps/web/src/components/factor-report/FactorDomainAnalysis.tsx apps/web/src/components/factor-report/FactorCorrelation.tsx
git commit -m "feat(web): add factor report modules 5-8"
```

---

### Task 8: 新增因子报告组件 — 模块 9~13

**Files:**
- Create: `apps/web/src/components/factor-report/FactorMultiFactor.tsx`
- Create: `apps/web/src/components/factor-report/FactorEconomicLogic.tsx`
- Create: `apps/web/src/components/factor-report/FactorRobustness.tsx`
- Create: `apps/web/src/components/factor-report/FactorMonitoring.tsx`
- Create: `apps/web/src/components/factor-report/FactorConclusion.tsx`

- [ ] **Step 1: 创建 FactorMultiFactor.tsx**

多因子组合贡献：KPI 卡片（权重、边际 IC 提升、边际夏普提升）+ 交互效应条形图。

- [ ] **Step 2: 创建 FactorEconomicLogic.tsx**

经济逻辑 & 可解释性：经济学解释文本块 + 文献列表 + A 股特殊性 + 数据窥探风险标签（low/medium/high 对应 chip/chipWarn/chipDanger）。

- [ ] **Step 3: 创建 FactorRobustness.tsx**

稳健性检验：参数敏感性表 + 样本内 vs 样本外对比表 + 基准对比表 + 加权方式对比表 + 幸存者偏差状态。使用 `subTabNav` 切换。

- [ ] **Step 4: 创建 FactorMonitoring.tsx**

监控指标：告警状态表格（metric/value/threshold/status），status 用 `alertNormal/alertWarning/alertCritical` 颜色编码。

- [ ] **Step 5: 创建 FactorConclusion.tsx**

结论与建议：评级徽章（复用 gradeBadge）+ 评级理由 + 推荐场景 chip 列表 + 风险提示 chipWarn 列表 + 下一步行动列表。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/factor-report/FactorMultiFactor.tsx apps/web/src/components/factor-report/FactorEconomicLogic.tsx apps/web/src/components/factor-report/FactorRobustness.tsx apps/web/src/components/factor-report/FactorMonitoring.tsx apps/web/src/components/factor-report/FactorConclusion.tsx
git commit -m "feat(web): add factor report modules 9-13"
```

---

### Task 9: 集成到因子工坊页面

**Files:**
- Modify: `apps/web/src/components/factor-lab.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 在 factor-lab.tsx 中添加"查看报告"入口**

在 `FactorLabContent` 组件中：
1. 添加 `viewingReportId` 状态
2. 当 `viewingReportId` 有值时，渲染 `FactorReport` 组件替代原内容
3. 在因子表格每行添加"查看报告"按钮（仅 active 状态因子显示）
4. 新增 props: `factorReports: FactorReportFull[]`, `factorReportUi: FactorReportUiCopy`

- [ ] **Step 2: 更新 App.tsx 传递 factorReports 和 factorReportUiCopy**

从 `getFactorReports(language)` 和 `getFactorReportUiCopy(language)` 获取数据，传递给 `FactorLabContent`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/factor-lab.tsx apps/web/src/App.tsx
git commit -m "feat(web): integrate factor report into factor-lab page"
```

---

### Task 10: 验证 & 构建测试

- [ ] **Step 1: 运行前端测试**

```bash
cd apps/web && npm test
```

Expected: 所有测试通过

- [ ] **Step 2: 运行构建**

```bash
cd apps/web && npm run build
```

Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 3: 运行 dev server 验证**

```bash
cd apps/web && npm run dev
```

验证：
1. 因子工坊页面正常显示因子列表
2. 点击"查看报告"按钮进入因子评估报告
3. 13 个 Tab 均可切换，内容正常渲染
4. 返回按钮回到因子列表
5. 评级徽章（A/B/C/D）颜色正确

- [ ] **Step 4: Commit（如有修复）**

```bash
git add -A
git commit -m "fix(web): fix factor report integration issues"
```

---

## 自检清单

### 1. Spec 覆盖

| 用户需求模块 | 对应 Task |
|-------------|-----------|
| 一、因子基本信息 | Task 6: FactorBasicInfo |
| 二、描述性统计 | Task 6: FactorDescriptiveStats |
| 三、有效性检验（分层回测/IC/回归） | Task 6: FactorEffectiveness |
| 四、风险分析 | Task 6: FactorRiskAnalysis |
| 五、换手率&交易成本 | Task 7: FactorTurnoverCost |
| 六、中性化&剥离 | Task 7: FactorNeutralization |
| 七、分域表现 | Task 7: FactorDomainAnalysis |
| 八、相关性分析 | Task 7: FactorCorrelation |
| 九、多因子组合贡献 | Task 8: FactorMultiFactor |
| 十、经济逻辑&可解释性 | Task 8: FactorEconomicLogic |
| 十一、稳健性检验 | Task 8: FactorRobustness |
| 十二、监控指标 | Task 8: FactorMonitoring |
| 十三、结论与建议 | Task 8: FactorConclusion |
| 可视化清单（分布直方图/净值曲线/IC 时序/热力图等） | Task 6-8 各组件内实现 |

### 2. Placeholder 扫描

无 TBD/TODO/placeholder。所有 Task 均包含具体实现描述。

### 3. 类型一致性

- `FactorReportFull` 的 13 个子模块类型与各组件 Props 中的 `report.basicInfo` / `report.descriptiveStats` 等路径一致
- `FactorReportTabId` 的 13 个值与 `FactorReport.tsx` 中 TABS 数组和 switch case 一一对应
- `FactorGrade` 在 `FactorReportHeader.tsx` 和 `FactorConclusion.tsx` 中使用方式一致
