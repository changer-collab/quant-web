Task 2 focused review package

Scope: only the excerpts relevant to structured KeywordTileItem display types and preservation of liquidity/capacity structured arrays. Older uncommitted report-configuration edits exist elsewhere in these files and are intentionally excluded from this task package.

## apps/web/src/data/types.ts:610-640
```
610	export interface ReportAttribution {
611	  industryExposures: IndustryExposure[];
612	  factorExposures: FactorExposure[];
613	  timingSelection: TimingSelection;
614	  /** Brinson 归因（选股/择时/交互） */
615	  brinsonAttribution?: {
616	    allocationEffect: number;
617	    selectionEffect: number;
618	    interactionEffect: number;
619	    totalActiveReturn: number;
620	  };
621	}
622	
623	export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';
624	
625	export interface KeywordTileItem {
626	  text: string;
627	  category?: KeywordTileCategory;
628	}
629	
630	/** 潜在问题 */
631	export interface ReportIssues {
632	  overfittingRisk: 'low' | 'medium' | 'high';
633	  survivorshipBias: boolean;
634	  lookAheadBias: boolean;
635	  liquidityAssessment: string;
636	  liquidityAssessmentItems?: KeywordTileItem[];
637	  capacityEstimate: string;
638	  capacityEstimateItems?: KeywordTileItem[];
639	}
640	
```

## apps/web/src/data/factories.ts:463-486
```
463	      }
464	      report.overview = {
465	        ...report.overview,
466	        logic: (ov.logic as string) || report.overview.logic,
467	        coreLogic: (ov.coreLogic as string) || report.overview.coreLogic,
468	        suitableMarketRegime: regime,
469	      };
470	    }
471	    const iss = analysis.issues as Record<string, unknown> | undefined;
472	    if (iss) {
473	      const apiIssues = iss as Record<string, unknown>;
474	      report.issues = {
475	        ...report.issues,
476	        overfittingRisk: (apiIssues.overfittingRisk as 'low' | 'medium' | 'high') ?? report.issues.overfittingRisk,
477	        liquidityAssessment: (apiIssues.liquidityAssessment as string) || report.issues.liquidityAssessment,
478	        capacityEstimate: (apiIssues.capacityEstimate as string) || report.issues.capacityEstimate,
479	        liquidityAssessmentItems: Array.isArray(apiIssues.liquidityAssessmentItems)
480	          ? apiIssues.liquidityAssessmentItems as typeof report.issues.liquidityAssessmentItems
481	          : report.issues.liquidityAssessmentItems,
482	        capacityEstimateItems: Array.isArray(apiIssues.capacityEstimateItems)
483	          ? apiIssues.capacityEstimateItems as typeof report.issues.capacityEstimateItems
484	          : report.issues.capacityEstimateItems,
485	      };
486	    }
```

## apps/web/src/components/report/keyword-tiles.ts:1-75
```
1	import type { KeywordTileCategory, KeywordTileItem } from '../../data/types';
2	
3	export interface NormalizedKeywordTile {
4	  text: string;
5	  category: KeywordTileCategory;
6	}
7	
8	const SPLIT_PATTERN = /[；。！？、，;.!?,\n]+/u;
9	const MIN_PHRASE_LENGTH = 2;
10	const DEFAULT_MAX_ITEMS = 12;
11	
12	const KEYWORDS: Record<Exclude<KeywordTileCategory, 'observation'>, string[]> = {
13	  assumption: ['假设', '基于', '前提', '默认', '充足'],
14	  limitation: ['未考虑', '不足', '限制', '缺少', '未纳入'],
15	  risk: ['风险', '亏损', '恶化', '冲击', '滑点', '回撤'],
16	};
17	
18	function isValidCategory(category: unknown): category is KeywordTileCategory {
19	  return category === 'assumption' || category === 'limitation' || category === 'risk' || category === 'observation';
20	}
21	
22	export function splitKeywordText(text: string): string[] {
23	  const seen = new Set<string>();
24	  const phrases: string[] = [];
25	
26	  for (const raw of text.split(SPLIT_PATTERN)) {
27	    const phrase = raw.trim();
28	    if (phrase.length < MIN_PHRASE_LENGTH || seen.has(phrase)) continue;
29	    seen.add(phrase);
30	    phrases.push(phrase);
31	  }
32	
33	  return phrases;
34	}
35	
36	export function classifyKeywordTile(text: string): KeywordTileCategory {
37	  if (KEYWORDS.limitation.some((keyword) => text.includes(keyword))) return 'limitation';
38	  if (KEYWORDS.risk.some((keyword) => text.includes(keyword))) return 'risk';
39	  if (KEYWORDS.assumption.some((keyword) => text.includes(keyword))) return 'assumption';
40	  return 'observation';
41	}
42	
43	export function normalizeKeywordTiles({
44	  items,
45	  fallbackText,
46	  maxItems = DEFAULT_MAX_ITEMS,
47	}: {
48	  items?: KeywordTileItem[];
49	  fallbackText?: string;
50	  maxItems?: number;
51	}): NormalizedKeywordTile[] {
52	  if (maxItems <= 0) return [];
53	
54	  const sourceItems: KeywordTileItem[] = Array.isArray(items)
55	    ? items
56	    : splitKeywordText(fallbackText ?? '').map((text) => ({ text }));
57	
58	  const seen = new Set<string>();
59	  const normalized: NormalizedKeywordTile[] = [];
60	
61	  for (const item of sourceItems) {
62	    const text = item.text.trim();
63	    if (text.length < MIN_PHRASE_LENGTH || seen.has(text)) continue;
64	    seen.add(text);
65	    normalized.push({
66	      text,
67	      category: isValidCategory(item.category) ? item.category : classifyKeywordTile(text),
68	    });
69	    if (normalized.length >= maxItems) break;
70	  }
71	
72	  return normalized;
73	}
```

## apps/web/tests/keyword-tiles.test.tsx:1-125
```
1	import { describe, expect, it } from 'vitest';
2	import { mapBacktestResultToReport } from '../src/appData';
3	import { classifyKeywordTile, normalizeKeywordTiles, splitKeywordText } from '../src/components/report/keyword-tiles';
4	
5	describe('keyword tile helpers', () => {
6	  it('splits Chinese AI assessment text into distinct keyword phrases', () => {
7	    expect(splitKeywordText('假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。')).toEqual([
8	      '假设市场流动性充足',
9	      '未考虑冲击成本',
10	      '滑点恶化亏损',
11	      '基于日线回测',
12	    ]);
13	  });
14	
15	  it('classifies fallback phrases by deterministic keyword rules', () => {
16	    expect(classifyKeywordTile('假设市场流动性充足')).toBe('assumption');
17	    expect(classifyKeywordTile('未考虑冲击成本')).toBe('limitation');
18	    expect(classifyKeywordTile('滑点恶化亏损')).toBe('risk');
19	    expect(classifyKeywordTile('交易样本偏少')).toBe('observation');
20	  });
21	
22	  it('normalizes legacy text into classified tiles', () => {
23	    expect(normalizeKeywordTiles({
24	      fallbackText: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
25	    })).toEqual([
26	      { text: '假设市场流动性充足', category: 'assumption' },
27	      { text: '未考虑冲击成本', category: 'limitation' },
28	      { text: '滑点恶化亏损', category: 'risk' },
29	      { text: '基于日线回测', category: 'assumption' },
30	    ]);
31	  });
32	
33	  it('uses structured item categories before fallback classification', () => {
34	    expect(normalizeKeywordTiles({
35	      items: [{ text: '未考虑冲击成本', category: 'risk' }],
36	      fallbackText: '假设市场流动性充足',
37	    })).toEqual([{ text: '未考虑冲击成本', category: 'risk' }]);
38	  });
39	
40	  it('preserves an explicit empty structured items array instead of falling back to legacy text', () => {
41	    expect(normalizeKeywordTiles({
42	      items: [],
43	      fallbackText: '假设市场流动性充足；滑点恶化亏损',
44	    })).toEqual([]);
45	  });
46	
47	  it('falls back to legacy text when structured items is null from JSON', () => {
48	    expect(normalizeKeywordTiles({
49	      items: null as unknown as any,
50	      fallbackText: '假设市场流动性充足；滑点恶化亏损',
51	    })).toEqual([
52	      { text: '假设市场流动性充足', category: 'assumption' },
53	      { text: '滑点恶化亏损', category: 'risk' },
54	    ]);
55	  });
56	
57	  it('returns no tiles when maxItems is zero or less', () => {
58	    expect(normalizeKeywordTiles({
59	      fallbackText: '假设市场流动性充足；滑点恶化亏损',
60	      maxItems: 0,
61	    })).toEqual([]);
62	
63	    expect(normalizeKeywordTiles({
64	      fallbackText: '假设市场流动性充足；滑点恶化亏损',
65	      maxItems: -1,
66	    })).toEqual([]);
67	  });
68	
69	  it('deduplicates phrases and applies the maximum tile count', () => {
70	    expect(normalizeKeywordTiles({
71	      fallbackText: '假设市场流动性充足；假设市场流动性充足；滑点恶化亏损；基于日线回测',
72	      maxItems: 2,
73	    })).toEqual([
74	      { text: '假设市场流动性充足', category: 'assumption' },
75	      { text: '滑点恶化亏损', category: 'risk' },
76	    ]);
77	  });
78	
79	  it('preserves structured AI issue keyword items when mapping backtest results', () => {
80	    const report = mapBacktestResultToReport({
81	      backtestResult: {
82	        config: {
83	          strategyName: 'dual_ma',
84	          timeframe: '1d',
85	          startDate: 1672588800000,
86	          endDate: 1735488000000,
87	          initialCash: 1000000,
88	          slippage: 0.001,
89	          strategyKind: 'timing',
90	        },
91	        metrics: {
92	          totalReturn: 0.1,
93	          annualizedReturn: 0.2,
94	          sharpeRatio: 1.5,
95	          maxDrawdown: -0.08,
96	          winRate: 0.6,
97	          totalTrades: 10,
98	        },
99	        equityCurve: [],
100	        drawdownCurve: [],
101	        monthlyReturns: [],
102	        annualReturns: [],
103	      },
104	      analysis: {
105	        issues: {
106	          liquidityAssessment: 'fallback should not matter',
107	          liquidityAssessmentItems: [
108	            { text: '结构化流动性假设', category: 'assumption' },
109	            { text: '结构化滑点风险', category: 'risk' },
110	          ],
111	          capacityEstimate: '容量估计文字',
112	          capacityEstimateItems: [{ text: '容量受成交额约束', category: 'limitation' }],
113	        },
114	      },
115	    });
116	
117	    expect(report.issues.liquidityAssessmentItems).toEqual([
118	      { text: '结构化流动性假设', category: 'assumption' },
119	      { text: '结构化滑点风险', category: 'risk' },
120	    ]);
121	    expect(report.issues.capacityEstimateItems).toEqual([
122	      { text: '容量受成交额约束', category: 'limitation' },
123	    ]);
124	  });
125	});
```
