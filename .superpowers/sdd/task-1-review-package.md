Task 1 review package after fixes
Base: working tree before task (uncommitted session)
Head: current working tree

Changed files:
?? apps/web/src/components/report/keyword-tiles.ts
?? apps/web/tests/keyword-tiles.test.tsx

Stat:
  78 apps/web/src/components/report/keyword-tiles.ts
  67 apps/web/tests/keyword-tiles.test.tsx
 145 total

Full diff:

--- /dev/null -> apps/web/src/components/report/keyword-tiles.ts ---
diff --git a/apps/web/src/components/report/keyword-tiles.ts b/apps/web/src/components/report/keyword-tiles.ts
new file mode 100644
index 0000000..be58a92
--- /dev/null
+++ b/apps/web/src/components/report/keyword-tiles.ts
@@ -0,0 +1,78 @@
+export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';
+
+export interface KeywordTileItem {
+  text: string;
+  category?: KeywordTileCategory;
+}
+
+export interface NormalizedKeywordTile {
+  text: string;
+  category: KeywordTileCategory;
+}
+
+const SPLIT_PATTERN = /[；。！？、，;.!?,\n]+/u;
+const MIN_PHRASE_LENGTH = 2;
+const DEFAULT_MAX_ITEMS = 12;
+
+const KEYWORDS: Record<Exclude<KeywordTileCategory, 'observation'>, string[]> = {
+  assumption: ['假设', '基于', '前提', '默认', '充足'],
+  limitation: ['未考虑', '不足', '限制', '缺少', '未纳入'],
+  risk: ['风险', '亏损', '恶化', '冲击', '滑点', '回撤'],
+};
+
+function isValidCategory(category: unknown): category is KeywordTileCategory {
+  return category === 'assumption' || category === 'limitation' || category === 'risk' || category === 'observation';
+}
+
+export function splitKeywordText(text: string): string[] {
+  const seen = new Set<string>();
+  const phrases: string[] = [];
+
+  for (const raw of text.split(SPLIT_PATTERN)) {
+    const phrase = raw.trim();
+    if (phrase.length < MIN_PHRASE_LENGTH || seen.has(phrase)) continue;
+    seen.add(phrase);
+    phrases.push(phrase);
+  }
+
+  return phrases;
+}
+
+export function classifyKeywordTile(text: string): KeywordTileCategory {
+  if (KEYWORDS.limitation.some((keyword) => text.includes(keyword))) return 'limitation';
+  if (KEYWORDS.risk.some((keyword) => text.includes(keyword))) return 'risk';
+  if (KEYWORDS.assumption.some((keyword) => text.includes(keyword))) return 'assumption';
+  return 'observation';
+}
+
+export function normalizeKeywordTiles({
+  items,
+  fallbackText,
+  maxItems = DEFAULT_MAX_ITEMS,
+}: {
+  items?: KeywordTileItem[];
+  fallbackText?: string;
+  maxItems?: number;
+}): NormalizedKeywordTile[] {
+  if (maxItems <= 0) return [];
+
+  const sourceItems = items !== undefined
+    ? items
+    : splitKeywordText(fallbackText ?? '').map((text) => ({ text }));
+
+  const seen = new Set<string>();
+  const normalized: NormalizedKeywordTile[] = [];
+
+  for (const item of sourceItems) {
+    const text = item.text.trim();
+    if (text.length < MIN_PHRASE_LENGTH || seen.has(text)) continue;
+    seen.add(text);
+    normalized.push({
+      text,
+      category: isValidCategory(item.category) ? item.category : classifyKeywordTile(text),
+    });
+    if (normalized.length >= maxItems) break;
+  }
+
+  return normalized;
+}

--- /dev/null -> apps/web/tests/keyword-tiles.test.tsx ---
diff --git a/apps/web/tests/keyword-tiles.test.tsx b/apps/web/tests/keyword-tiles.test.tsx
new file mode 100644
index 0000000..aba4102
--- /dev/null
+++ b/apps/web/tests/keyword-tiles.test.tsx
@@ -0,0 +1,67 @@
+import { describe, expect, it } from 'vitest';
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
+});
