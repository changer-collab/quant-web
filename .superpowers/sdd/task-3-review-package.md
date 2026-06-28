Task 3 review package
Base: working tree before task (uncommitted session)
Head: current working tree

Changed files:
 M apps/web/src/styles/report-tables.module.css
?? apps/web/src/components/report/KeywordTileGrid.tsx
?? apps/web/tests/keyword-tiles.test.tsx

Stat:
 apps/web/src/styles/report-tables.module.css | 77 ++++++++++++++++++++++++++++
 1 file changed, 77 insertions(+)

Full diff:
diff --git a/apps/web/src/styles/report-tables.module.css b/apps/web/src/styles/report-tables.module.css
index d6afe28..6c60a18 100644
--- a/apps/web/src/styles/report-tables.module.css
+++ b/apps/web/src/styles/report-tables.module.css
@@ -526,11 +526,88 @@
   margin: 0 0 var(--space-sm);
   font-size: 13px;
   font-weight: 700;
 }
 
 .assessText {
   margin: 0;
   font-size: var(--text-sm);
   line-height: var(--leading-relaxed);
   color: var(--muted);
+}
+
+.keywordTileSection {
+  display: grid;
+  gap: var(--space-md);
+}
+
+.keywordTileGrid {
+  display: grid;
+  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
+  gap: var(--space-sm);
+}
+
+.keywordTile {
+  display: grid;
+  gap: 6px;
+  min-height: 82px;
+  padding: var(--space-md);
+  border: 1px solid var(--line);
+  background: rgba(8, 16, 15, 0.4);
+  border-radius: var(--radius-sm);
+}
+
+.keywordTileCategory {
+  width: fit-content;
+  padding: 2px 8px;
+  border-radius: 999px;
+  font-size: var(--text-xs);
+  font-weight: 800;
+  letter-spacing: var(--tracking-wide);
+}
+
+.keywordTileText {
+  align-self: end;
+  color: var(--text);
+  font-size: var(--text-sm);
+  line-height: var(--leading-relaxed);
+}
+
+.keywordTileAssumption {
+  border-color: rgba(98, 216, 255, 0.24);
+  background: rgba(98, 216, 255, 0.06);
+}
+
+.keywordTileAssumption .keywordTileCategory {
+  color: var(--cyan);
+  background: rgba(98, 216, 255, 0.12);
+}
+
+.keywordTileLimitation {
+  border-color: rgba(255, 203, 107, 0.28);
+  background: rgba(255, 203, 107, 0.07);
+}
+
+.keywordTileLimitation .keywordTileCategory {
+  color: #ffcb6b;
+  background: rgba(255, 203, 107, 0.14);
+}
+
+.keywordTileRisk {
+  border-color: rgba(255, 107, 107, 0.28);
+  background: rgba(255, 107, 107, 0.07);
+}
+
+.keywordTileRisk .keywordTileCategory {
+  color: var(--red, #ff6b6b);
+  background: rgba(255, 107, 107, 0.14);
+}
+
+.keywordTileObservation {
+  border-color: rgba(77, 240, 160, 0.2);
+  background: rgba(77, 240, 160, 0.05);
+}
+
+.keywordTileObservation .keywordTileCategory {
+  color: var(--green);
+  background: rgba(77, 240, 160, 0.12);
 }
\ No newline at end of file

--- /dev/null -> apps/web/src/components/report/KeywordTileGrid.tsx ---
diff --git a/apps/web/src/components/report/KeywordTileGrid.tsx b/apps/web/src/components/report/KeywordTileGrid.tsx
new file mode 100644
index 0000000..e39c0a8
--- /dev/null
+++ b/apps/web/src/components/report/KeywordTileGrid.tsx
@@ -0,0 +1,45 @@
+import type { JSX } from 'react';
+import type { KeywordTileItem } from '../../data/types';
+import { normalizeKeywordTiles, type NormalizedKeywordTile } from './keyword-tiles';
+import styles from '@/styles/report-tables.module.css';
+
+export interface KeywordTileGridProps {
+  title?: string;
+  items?: KeywordTileItem[];
+  fallbackText?: string;
+  maxItems?: number;
+}
+
+const CATEGORY_LABELS: Record<NormalizedKeywordTile['category'], string> = {
+  assumption: '假设',
+  limitation: '限制',
+  risk: '风险',
+  observation: '观察',
+};
+
+const CATEGORY_CLASSES: Record<NormalizedKeywordTile['category'], string> = {
+  assumption: styles.keywordTileAssumption,
+  limitation: styles.keywordTileLimitation,
+  risk: styles.keywordTileRisk,
+  observation: styles.keywordTileObservation,
+};
+
+export function KeywordTileGrid({ title, items, fallbackText, maxItems }: KeywordTileGridProps): JSX.Element | null {
+  const tiles = normalizeKeywordTiles({ items, fallbackText, maxItems });
+
+  if (!tiles.length) return null;
+
+  return (
+    <section className={styles.keywordTileSection}>
+      {title ? <h4 className={styles.assessTitle}>{title}</h4> : null}
+      <div className={styles.keywordTileGrid}>
+        {tiles.map((tile) => (
+          <article className={`${styles.keywordTile} ${CATEGORY_CLASSES[tile.category]}`} key={`${tile.category}-${tile.text}`}>
+            <span className={styles.keywordTileCategory}>{CATEGORY_LABELS[tile.category]}</span>
+            <strong className={styles.keywordTileText}>{tile.text}</strong>
+          </article>
+        ))}
+      </div>
+    </section>
+  );
+}

--- /dev/null -> apps/web/tests/keyword-tiles.test.tsx ---
diff --git a/apps/web/tests/keyword-tiles.test.tsx b/apps/web/tests/keyword-tiles.test.tsx
new file mode 100644
index 0000000..474b46f
--- /dev/null
+++ b/apps/web/tests/keyword-tiles.test.tsx
@@ -0,0 +1,145 @@
+import { render, screen } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+import { mapBacktestResultToReport } from '../src/appData';
+import { KeywordTileGrid } from '../src/components/report/KeywordTileGrid';
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
+
+  it('renders fallback phrases as keyword tiles with category labels', () => {
+    render(
+      <KeywordTileGrid
+        title="流动性评估"
+        fallbackText="假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。"
+      />,
+    );
+
+    expect(screen.getByText('流动性评估')).toBeInTheDocument();
+    expect(screen.getByText('假设市场流动性充足')).toBeInTheDocument();
+    expect(screen.getByText('未考虑冲击成本')).toBeInTheDocument();
+    expect(screen.getByText('滑点恶化亏损')).toBeInTheDocument();
+    expect(screen.getByText('基于日线回测')).toBeInTheDocument();
+    expect(screen.getAllByText('假设').length).toBeGreaterThanOrEqual(2);
+    expect(screen.getByText('限制')).toBeInTheDocument();
+    expect(screen.getByText('风险')).toBeInTheDocument();
+  });
+});
