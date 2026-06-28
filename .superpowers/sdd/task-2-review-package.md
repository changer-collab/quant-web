Task 2 review package
Base: working tree before task (uncommitted session)
Head: current working tree

Changed files:
 M apps/web/src/data/factories.ts
 M apps/web/src/data/types.ts
?? apps/web/tests/keyword-tiles.test.tsx

Stat:
 apps/web/src/data/factories.ts | 43 ++++++++++++++++++++++++++----------------
 apps/web/src/data/types.ts     | 11 +++++++++++
 2 files changed, 38 insertions(+), 16 deletions(-)

Full diff:
diff --git a/apps/web/src/data/factories.ts b/apps/web/src/data/factories.ts
index 642af54..d2efab6 100644
--- a/apps/web/src/data/factories.ts
+++ b/apps/web/src/data/factories.ts
@@ -50,26 +50,28 @@ export function createResearchReport(input: CreateResearchReportInput, language?
         { label: labels.mode, value: modeName, tone: 'info' as const },
       ]
     : getResearchMode(mode, language).heroMetrics.map((metric) =>
         metric.label === labels.mode ? metric : { ...metric },
       );
 
   if (!input.strategy && !metrics.some((metric) => metric.label === labels.mode)) {
     metrics[0] = { label: labels.mode, value: modeName, tone: 'info' };
   }
 
-  const diagnostics = getResearchMode(mode, language).sections.map((section) => ({
-    title: section.title,
-    items: [...section.items],
-  }));
-
-  if (input.configSummary?.length) {
+  const diagnostics = input.diagnosticSections?.length
+    ? input.diagnosticSections.map((section) => ({ title: section.title, items: [...section.items] }))
+    : getResearchMode(mode, language).sections.map((section) => ({
+        title: section.title,
+        items: [...section.items],
+      }));
+
+  if (input.configSummary?.length && !diagnostics.some((section) => section.title === content.ui.runConfigurationTitle)) {
     diagnostics.unshift({
       title: content.ui.runConfigurationTitle,
       items: [...input.configSummary],
     });
   }
 
   return {
     id: input.id,
     jobId: input.jobId,
     mode,
@@ -120,21 +122,25 @@ interface PythonBacktestResult {
   };
   profitLossRatio?: number;
   avgHoldingDays?: number;
   maxSingleProfit?: number;
   maxSingleLoss?: number;
 }
 
 /** 时间戳转日期字符串 */
 function tsToDate(ts: number): string {
   if (!ts) return '';
-  return new Date(ts).toISOString().split('T')[0];
+  const date = new Date(ts);
+  const year = date.getFullYear();
+  const month = String(date.getMonth() + 1).padStart(2, '0');
+  const day = String(date.getDate()).padStart(2, '0');
+  return `${year}-${month}-${day}`;
 }
 
 /** 创建空白报告模板（不含 mock 数据，所有可选字段为空） */
 function createEmptyReport(source?: Partial<BacktestReportFull>): BacktestReportFull {
   const src = source as Record<string, unknown> | undefined;
   const base: BacktestReportFull = {
     id: '',
     taskId: '',
     strategyName: '',
     strategyVersion: '',
@@ -357,30 +363,30 @@ export function mapBacktestResultToReport(
       instruments: [String(config.instruments?.[0] ?? config.symbol ?? '')],
       timeRange: {
         start: tsToDate(config.startDate ?? 0) || source?.overview?.timeRange.start || '',
         end: tsToDate(config.endDate ?? 0) || source?.overview?.timeRange.end || '',
       },
       frequency: config.timeframe ?? source?.overview?.frequency ?? '',
       benchmark: '',
       strategyCategory: config.strategyKind ?? source?.overview?.strategyCategory ?? 'timing',
     },
     dataParams: {
-      dataSource: '',
-      adjustmentType: '',
-      fee: { commission: 0, stampTax: 0 },
-      slippage: { model: 'fixed', value: config.slippage ?? 0 },
+      dataSource: source?.dataParams?.dataSource ?? '',
+      adjustmentType: source?.dataParams?.adjustmentType ?? '',
+      fee: source?.dataParams?.fee ?? { commission: 0, stampTax: 0 },
+      slippage: { model: source?.dataParams?.slippage.model ?? 'fixed', value: config.slippage ?? source?.dataParams?.slippage.value ?? 0 },
       capital: {
-        initialCash: config.initialCash ?? 0,
-        maxLeverage: 1.0,
-        positionLimit: 0.95,
+        initialCash: config.initialCash ?? source?.dataParams?.capital.initialCash ?? 0,
+        maxLeverage: source?.dataParams?.capital.maxLeverage ?? 1.0,
+        positionLimit: source?.dataParams?.capital.positionLimit ?? 0.95,
       },
-      params: [],
+      params: source?.dataParams?.params ?? [],
     },
     returnMetrics: {
       cumulativeReturn: metrics.totalReturn ?? 0,
       totalReturn: metrics.totalReturn ?? 0,
       annualizedReturn: metrics.annualizedReturn ?? 0,
       alpha: 0,
       benchmarkReturn: 0,
     },
     riskMetrics: {
       maxDrawdown: metrics.maxDrawdown ?? 0,
@@ -457,27 +463,32 @@ export function mapBacktestResultToReport(
       }
       report.overview = {
         ...report.overview,
         logic: (ov.logic as string) || report.overview.logic,
         coreLogic: (ov.coreLogic as string) || report.overview.coreLogic,
         suitableMarketRegime: regime,
       };
     }
     const iss = analysis.issues as Record<string, unknown> | undefined;
     if (iss) {
-      // Handle both API format (object with fields) and old format
       const apiIssues = iss as Record<string, unknown>;
       report.issues = {
         ...report.issues,
         overfittingRisk: (apiIssues.overfittingRisk as 'low' | 'medium' | 'high') ?? report.issues.overfittingRisk,
         liquidityAssessment: (apiIssues.liquidityAssessment as string) || report.issues.liquidityAssessment,
         capacityEstimate: (apiIssues.capacityEstimate as string) || report.issues.capacityEstimate,
+        liquidityAssessmentItems: Array.isArray(apiIssues.liquidityAssessmentItems)
+          ? apiIssues.liquidityAssessmentItems as typeof report.issues.liquidityAssessmentItems
+          : report.issues.liquidityAssessmentItems,
+        capacityEstimateItems: Array.isArray(apiIssues.capacityEstimateItems)
+          ? apiIssues.capacityEstimateItems as typeof report.issues.capacityEstimateItems
+          : report.issues.capacityEstimateItems,
       };
     }
     const con = analysis.conclusion as Record<string, unknown> | undefined;
     if (con) {
       report.conclusion = {
         ...report.conclusion,
         advantages: (con.advantages as string[]) ?? report.conclusion.advantages,
         potentialRisks: (con.potentialRisks as string[]) ?? report.conclusion.potentialRisks,
         improvements: (con.improvements as string[]) ?? report.conclusion.improvements,
         liveTradingAdvice: (con.liveTradingAdvice as ReportConclusion['liveTradingAdvice']) ?? report.conclusion.liveTradingAdvice,
diff --git a/apps/web/src/data/types.ts b/apps/web/src/data/types.ts
index 30dd54b..3668e44 100644
--- a/apps/web/src/data/types.ts
+++ b/apps/web/src/data/types.ts
@@ -210,20 +210,21 @@ export interface JobItem {
 }
 
 export interface ResearchJob extends JobItem {
   id: string;
   strategyName: string;
   template?: JobTemplate;
   mode?: ResearchModeId;
   strategyId?: string;
   sequence?: number;
   configSummary?: ResearchRunConfigSummary;
+  errorMessage?: string;
 }
 
 export interface ResearchReport {
   id: string;
   jobId: string;
   mode: ResearchModeId;
   modeName: string;
   strategyName: string;
   title: string;
   status: string;
@@ -241,20 +242,21 @@ export interface CreateResearchJobInput {
   configSummary?: ResearchRunConfigSummary;
   /** 初始状态（内部英文值，如 "Running"/"Completed"），默认 "Running" */
   initialState?: string;
   /** 初始进度（0-100），默认 0 */
   initialProgress?: number;
 }
 
 export interface CreateResearchReportInput extends CreateResearchJobInput {
   jobId: string;
   generatedAt: string;
+  diagnosticSections?: PageSection[];
 }
 
 /** 前端因子列表行（对应 @quant/factor-lab FactorRow，数值字段转为展示字符串） */
 export interface FactorDisplayRow {
   id: string;
   name: string;
   category: string;
   description: string;
   ic: string;
   rankIc: string;
@@ -611,27 +613,36 @@ export interface ReportAttribution {
   timingSelection: TimingSelection;
   /** Brinson 归因（选股/择时/交互） */
   brinsonAttribution?: {
     allocationEffect: number;
     selectionEffect: number;
     interactionEffect: number;
     totalActiveReturn: number;
   };
 }
 
+export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';
+
+export interface KeywordTileItem {
+  text: string;
+  category?: KeywordTileCategory;
+}
+
 /** 潜在问题 */
 export interface ReportIssues {
   overfittingRisk: 'low' | 'medium' | 'high';
   survivorshipBias: boolean;
   lookAheadBias: boolean;
   liquidityAssessment: string;
+  liquidityAssessmentItems?: KeywordTileItem[];
   capacityEstimate: string;
+  capacityEstimateItems?: KeywordTileItem[];
 }
 
 // ─── 回测报告扩展模块（基于 5 个回测报告框架） ──────────────
 
 /** 执行摘要（框架3/4/5 要求：一页纸核心结论） */
 export interface ReportExecutiveSummary {
   /** 一句话核心结论 */
   oneLineConclusion: string;
   /** 是否推荐实盘 */
   recommendedForLive: boolean;

--- /dev/null -> apps/web/tests/keyword-tiles.test.tsx ---
diff --git a/apps/web/tests/keyword-tiles.test.tsx b/apps/web/tests/keyword-tiles.test.tsx
new file mode 100644
index 0000000..a422d53
--- /dev/null
+++ b/apps/web/tests/keyword-tiles.test.tsx
@@ -0,0 +1,125 @@
+import { describe, expect, it } from 'vitest';
+import { mapBacktestResultToReport } from '../src/appData';
+import { classifyKeywordTile, normalizeKeywordTiles, splitKeywordText } from '../src/components/report/keyword-tiles';
+
+describe('keyword tile helpers', () => {
+  it('splits Chinese AI assessment text into distinct keyword phrases', () => {
+    expect(splitKeywordText('假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。')).toEqual([
+      '假设市场流动性充足',
+      '未考虑冲击成本',
+      '滑点恶化亏损',
+      '基于日线回测',
+    ]);
+  });
+
+  it('classifies fallback phrases by deterministic keyword rules', () => {
+    expect(classifyKeywordTile('假设市场流动性充足')).toBe('assumption');
+    expect(classifyKeywordTile('未考虑冲击成本')).toBe('limitation');
+    expect(classifyKeywordTile('滑点恶化亏损')).toBe('risk');
+    expect(classifyKeywordTile('交易样本偏少')).toBe('observation');
+  });
+
+  it('normalizes legacy text into classified tiles', () => {
+    expect(normalizeKeywordTiles({
+      fallbackText: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
+    })).toEqual([
+      { text: '假设市场流动性充足', category: 'assumption' },
+      { text: '未考虑冲击成本', category: 'limitation' },
+      { text: '滑点恶化亏损', category: 'risk' },
+      { text: '基于日线回测', category: 'assumption' },
+    ]);
+  });
+
+  it('uses structured item categories before fallback classification', () => {
+    expect(normalizeKeywordTiles({
+      items: [{ text: '未考虑冲击成本', category: 'risk' }],
+      fallbackText: '假设市场流动性充足',
+    })).toEqual([{ text: '未考虑冲击成本', category: 'risk' }]);
+  });
+
+  it('preserves an explicit empty structured items array instead of falling back to legacy text', () => {
+    expect(normalizeKeywordTiles({
+      items: [],
+      fallbackText: '假设市场流动性充足；滑点恶化亏损',
+    })).toEqual([]);
+  });
+
+  it('falls back to legacy text when structured items is null from JSON', () => {
+    expect(normalizeKeywordTiles({
+      items: null as unknown as any,
+      fallbackText: '假设市场流动性充足；滑点恶化亏损',
+    })).toEqual([
+      { text: '假设市场流动性充足', category: 'assumption' },
+      { text: '滑点恶化亏损', category: 'risk' },
+    ]);
+  });
+
+  it('returns no tiles when maxItems is zero or less', () => {
+    expect(normalizeKeywordTiles({
+      fallbackText: '假设市场流动性充足；滑点恶化亏损',
+      maxItems: 0,
+    })).toEqual([]);
+
+    expect(normalizeKeywordTiles({
+      fallbackText: '假设市场流动性充足；滑点恶化亏损',
+      maxItems: -1,
+    })).toEqual([]);
+  });
+
+  it('deduplicates phrases and applies the maximum tile count', () => {
+    expect(normalizeKeywordTiles({
+      fallbackText: '假设市场流动性充足；假设市场流动性充足；滑点恶化亏损；基于日线回测',
+      maxItems: 2,
+    })).toEqual([
+      { text: '假设市场流动性充足', category: 'assumption' },
+      { text: '滑点恶化亏损', category: 'risk' },
+    ]);
+  });
+
+  it('preserves structured AI issue keyword items when mapping backtest results', () => {
+    const report = mapBacktestResultToReport({
+      backtestResult: {
+        config: {
+          strategyName: 'dual_ma',
+          timeframe: '1d',
+          startDate: 1672588800000,
+          endDate: 1735488000000,
+          initialCash: 1000000,
+          slippage: 0.001,
+          strategyKind: 'timing',
+        },
+        metrics: {
+          totalReturn: 0.1,
+          annualizedReturn: 0.2,
+          sharpeRatio: 1.5,
+          maxDrawdown: -0.08,
+          winRate: 0.6,
+          totalTrades: 10,
+        },
+        equityCurve: [],
+        drawdownCurve: [],
+        monthlyReturns: [],
+        annualReturns: [],
+      },
+      analysis: {
+        issues: {
+          liquidityAssessment: 'fallback should not matter',
+          liquidityAssessmentItems: [
+            { text: '结构化流动性假设', category: 'assumption' },
+            { text: '结构化滑点风险', category: 'risk' },
+          ],
+          capacityEstimate: '容量估计文字',
+          capacityEstimateItems: [{ text: '容量受成交额约束', category: 'limitation' }],
+        },
+      },
+    });
+
+    expect(report.issues.liquidityAssessmentItems).toEqual([
+      { text: '结构化流动性假设', category: 'assumption' },
+      { text: '结构化滑点风险', category: 'risk' },
+    ]);
+    expect(report.issues.capacityEstimateItems).toEqual([
+      { text: '容量受成交额约束', category: 'limitation' },
+    ]);
+  });
+});
