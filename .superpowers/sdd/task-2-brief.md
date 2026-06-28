### Task 2: Extend frontend report issue types and preserve structured items

**Files:**
- Modify: `apps/web/src/data/types.ts`
- Modify: `apps/web/src/data/factories.ts`
- Test: `apps/web/tests/keyword-tiles.test.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `KeywordTileItem`
- Produces:
  - Frontend `ReportIssues` supports optional `liquidityAssessmentItems?: KeywordTileItem[]` and `capacityEstimateItems?: KeywordTileItem[]`.
  - `mapBacktestResultToReport()` preserves structured issue arrays from AI analysis.

- [ ] **Step 1: Add failing test for structured items preserved through report mapping**

Append to `apps/web/tests/keyword-tiles.test.tsx`:

```ts
import { mapBacktestResultToReport } from '../src/appData';

// Add inside describe('keyword tile helpers', () => { ... })
it('preserves structured AI issue keyword items when mapping backtest results', () => {
  const report = mapBacktestResultToReport({
    backtestResult: {
      config: { strategyName: 'dual_ma', timeframe: '1d', startDate: 1672588800000, endDate: 1735488000000, initialCash: 1000000, slippage: 0.001, strategyKind: 'timing' },
      metrics: { totalReturn: 0.1, annualizedReturn: 0.2, sharpeRatio: 1.5, maxDrawdown: -0.08, winRate: 0.6, totalTrades: 10 },
      equityCurve: [],
      drawdownCurve: [],
      monthlyReturns: [],
      annualReturns: [],
    },
    analysis: {
      issues: {
        liquidityAssessment: 'fallback should not matter',
        liquidityAssessmentItems: [
          { text: '结构化流动性假设', category: 'assumption' },
          { text: '结构化滑点风险', category: 'risk' },
        ],
        capacityEstimate: '容量估计文字',
        capacityEstimateItems: [{ text: '容量受成交额约束', category: 'limitation' }],
      },
    },
  });

  expect(report.issues.liquidityAssessmentItems).toEqual([
    { text: '结构化流动性假设', category: 'assumption' },
    { text: '结构化滑点风险', category: 'risk' },
  ]);
  expect(report.issues.capacityEstimateItems).toEqual([
    { text: '容量受成交额约束', category: 'limitation' },
  ]);
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
```

Expected: FAIL because `ReportIssues` does not expose/preserve structured item fields.

- [ ] **Step 3: Extend frontend display types**

Modify `apps/web/src/data/types.ts`.

Add near existing report types:

```ts
export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';

export interface KeywordTileItem {
  text: string;
  category?: KeywordTileCategory;
}
```

Modify `ReportIssues` to include:

```ts
liquidityAssessmentItems?: KeywordTileItem[];
capacityEstimateItems?: KeywordTileItem[];
```

- [ ] **Step 4: Preserve structured fields in report mapping**

Modify `apps/web/src/data/factories.ts` in the `analysis.issues` merge block so it becomes:

```ts
const iss = analysis.issues as Record<string, unknown> | undefined;
if (iss) {
  const apiIssues = iss as Record<string, unknown>;
  report.issues = {
    ...report.issues,
    overfittingRisk: (apiIssues.overfittingRisk as 'low' | 'medium' | 'high') ?? report.issues.overfittingRisk,
    liquidityAssessment: (apiIssues.liquidityAssessment as string) || report.issues.liquidityAssessment,
    capacityEstimate: (apiIssues.capacityEstimate as string) || report.issues.capacityEstimate,
    liquidityAssessmentItems: Array.isArray(apiIssues.liquidityAssessmentItems)
      ? apiIssues.liquidityAssessmentItems as typeof report.issues.liquidityAssessmentItems
      : report.issues.liquidityAssessmentItems,
    capacityEstimateItems: Array.isArray(apiIssues.capacityEstimateItems)
      ? apiIssues.capacityEstimateItems as typeof report.issues.capacityEstimateItems
      : report.issues.capacityEstimateItems,
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
pnpm --filter @quant/web exec tsc --noEmit
```

Expected: helper tests pass; typecheck exits 0 with no output.

- [ ] **Step 6: Commit Task 2**

Only commit if the user asked for commits in this session. Otherwise skip.

```bash
git add apps/web/src/data/types.ts apps/web/src/data/factories.ts apps/web/tests/keyword-tiles.test.tsx
git commit -m "feat(web): preserve structured issue keyword items"
```

---

