# Report Keyword Tiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the backtest report Potential Issues tab as category-based keyword tiles, using structured AI items when present and deterministic frontend fallback splitting/classification for legacy strings.

**Architecture:** Add frontend-only display types and pure helper functions under `apps/web`, then build a reusable `KeywordTileGrid` component consumed by `ReportIssues`. Keep the backend and AI pipeline unchanged; the frontend remains compatible with current string fields and future optional structured arrays.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, CSS modules, Testing Library.

## Global Constraints

- Only modify frontend display code under `apps/web` for the keyword-tile feature.
- Do not import from `apps/api`, Worker, Python, or backend internals.
- Do not require API, database, Python, Worker, or AI-output changes for this iteration.
- Existing report JSON with `liquidityAssessment: string` and `capacityEstimate: string` must continue to render.
- Optional structured arrays must take priority over fallback text when present.
- Category styling is category-based, not severity-based.
- Default maximum keyword-tile count is 12.

---

## File Structure

- Create: `apps/web/src/components/report/keyword-tiles.ts`
  - Pure helper functions and exported keyword-tile types used by tests and component code.
  - Owns `splitKeywordText`, `classifyKeywordTile`, and `normalizeKeywordTiles`.

- Create: `apps/web/src/components/report/KeywordTileGrid.tsx`
  - Focused presentational component.
  - Consumes normalized keyword tiles and renders a responsive tile grid.

- Modify: `apps/web/src/data/types.ts`
  - Adds frontend display-only `KeywordTileCategory` and `KeywordTileItem` types.
  - Adds optional `liquidityAssessmentItems` and `capacityEstimateItems` to `ReportIssues`.

- Modify: `apps/web/src/data/factories.ts`
  - Preserves optional structured issue fields when merging API/AI analysis into `BacktestReportFull`.

- Modify: `apps/web/src/components/report/ReportIssues.tsx`
  - Replaces paragraph-only liquidity/capacity rendering with `KeywordTileGrid`.
  - Converts the three existing issue status cards into tile-compatible cards.

- Modify: `apps/web/src/styles/report-tables.module.css`
  - Adds keyword tile grid/card classes and category tone classes.

- Modify/Create tests:
  - Create: `apps/web/tests/keyword-tiles.test.tsx`
  - Modify: `apps/web/tests/report.test.tsx` or create `apps/web/tests/report-issues.test.tsx` if `ReportIssues` is easier to test directly.

---

### Task 1: Add keyword tile parsing and classification helpers

**Files:**
- Create: `apps/web/src/components/report/keyword-tiles.ts`
- Test: `apps/web/tests/keyword-tiles.test.tsx`

**Interfaces:**
- Produces:
  - `export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation'`
  - `export interface KeywordTileItem { text: string; category?: KeywordTileCategory }`
  - `export interface NormalizedKeywordTile { text: string; category: KeywordTileCategory }`
  - `export function splitKeywordText(text: string): string[]`
  - `export function classifyKeywordTile(text: string): KeywordTileCategory`
  - `export function normalizeKeywordTiles(input: { items?: KeywordTileItem[]; fallbackText?: string; maxItems?: number }): NormalizedKeywordTile[]`
- Consumes: no project-specific dependencies.

- [ ] **Step 1: Write the failing helper tests**

Create `apps/web/tests/keyword-tiles.test.tsx`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyKeywordTile, normalizeKeywordTiles, splitKeywordText } from '../src/components/report/keyword-tiles';

describe('keyword tile helpers', () => {
  it('splits Chinese AI assessment text into distinct keyword phrases', () => {
    expect(splitKeywordText('假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。')).toEqual([
      '假设市场流动性充足',
      '未考虑冲击成本',
      '滑点恶化亏损',
      '基于日线回测',
    ]);
  });

  it('classifies fallback phrases by deterministic keyword rules', () => {
    expect(classifyKeywordTile('假设市场流动性充足')).toBe('assumption');
    expect(classifyKeywordTile('未考虑冲击成本')).toBe('limitation');
    expect(classifyKeywordTile('滑点恶化亏损')).toBe('risk');
    expect(classifyKeywordTile('交易样本偏少')).toBe('observation');
  });

  it('normalizes legacy text into classified tiles', () => {
    expect(normalizeKeywordTiles({
      fallbackText: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
    })).toEqual([
      { text: '假设市场流动性充足', category: 'assumption' },
      { text: '未考虑冲击成本', category: 'limitation' },
      { text: '滑点恶化亏损', category: 'risk' },
      { text: '基于日线回测', category: 'assumption' },
    ]);
  });

  it('uses structured item categories before fallback classification', () => {
    expect(normalizeKeywordTiles({
      items: [{ text: '未考虑冲击成本', category: 'risk' }],
      fallbackText: '假设市场流动性充足',
    })).toEqual([{ text: '未考虑冲击成本', category: 'risk' }]);
  });

  it('deduplicates phrases and applies the maximum tile count', () => {
    expect(normalizeKeywordTiles({
      fallbackText: '假设市场流动性充足；假设市场流动性充足；滑点恶化亏损；基于日线回测',
      maxItems: 2,
    })).toEqual([
      { text: '假设市场流动性充足', category: 'assumption' },
      { text: '滑点恶化亏损', category: 'risk' },
    ]);
  });
});
```

- [ ] **Step 2: Run helper tests and verify RED**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
```

Expected: FAIL because `../src/components/report/keyword-tiles` does not exist.

- [ ] **Step 3: Implement the helper module**

Create `apps/web/src/components/report/keyword-tiles.ts`:

```ts
export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';

export interface KeywordTileItem {
  text: string;
  category?: KeywordTileCategory;
}

export interface NormalizedKeywordTile {
  text: string;
  category: KeywordTileCategory;
}

const SPLIT_PATTERN = /[；。！？、，;.!?,\n]+/u;
const MIN_PHRASE_LENGTH = 2;
const DEFAULT_MAX_ITEMS = 12;

const KEYWORDS: Record<Exclude<KeywordTileCategory, 'observation'>, string[]> = {
  assumption: ['假设', '基于', '前提', '默认', '充足'],
  limitation: ['未考虑', '不足', '限制', '缺少', '未纳入'],
  risk: ['风险', '亏损', '恶化', '冲击', '滑点', '回撤'],
};

function isValidCategory(category: unknown): category is KeywordTileCategory {
  return category === 'assumption' || category === 'limitation' || category === 'risk' || category === 'observation';
}

export function splitKeywordText(text: string): string[] {
  const seen = new Set<string>();
  const phrases: string[] = [];

  for (const raw of text.split(SPLIT_PATTERN)) {
    const phrase = raw.trim();
    if (phrase.length < MIN_PHRASE_LENGTH || seen.has(phrase)) continue;
    seen.add(phrase);
    phrases.push(phrase);
  }

  return phrases;
}

export function classifyKeywordTile(text: string): KeywordTileCategory {
  if (KEYWORDS.limitation.some((keyword) => text.includes(keyword))) return 'limitation';
  if (KEYWORDS.risk.some((keyword) => text.includes(keyword))) return 'risk';
  if (KEYWORDS.assumption.some((keyword) => text.includes(keyword))) return 'assumption';
  return 'observation';
}

export function normalizeKeywordTiles({
  items,
  fallbackText,
  maxItems = DEFAULT_MAX_ITEMS,
}: {
  items?: KeywordTileItem[];
  fallbackText?: string;
  maxItems?: number;
}): NormalizedKeywordTile[] {
  const sourceItems = items?.length
    ? items
    : splitKeywordText(fallbackText ?? '').map((text) => ({ text }));

  const seen = new Set<string>();
  const normalized: NormalizedKeywordTile[] = [];

  for (const item of sourceItems) {
    const text = item.text.trim();
    if (text.length < MIN_PHRASE_LENGTH || seen.has(text)) continue;
    seen.add(text);
    normalized.push({
      text,
      category: isValidCategory(item.category) ? item.category : classifyKeywordTile(text),
    });
    if (normalized.length >= maxItems) break;
  }

  return normalized;
}
```

- [ ] **Step 4: Run helper tests and verify GREEN**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
```

Expected: PASS, 5 tests passed.

- [ ] **Step 5: Commit Task 1**

Only commit if the user asked for commits in this session. Otherwise skip this step and mention it in the task review.

```bash
git add apps/web/src/components/report/keyword-tiles.ts apps/web/tests/keyword-tiles.test.tsx
git commit -m "feat(web): add report keyword tile helpers"
```

---

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

### Task 3: Build the reusable KeywordTileGrid component and styles

**Files:**
- Create: `apps/web/src/components/report/KeywordTileGrid.tsx`
- Modify: `apps/web/src/styles/report-tables.module.css`
- Test: `apps/web/tests/keyword-tiles.test.tsx`

**Interfaces:**
- Consumes from Task 1:
  - `KeywordTileItem`
  - `normalizeKeywordTiles()`
- Produces:
  - `export function KeywordTileGrid(props: KeywordTileGridProps): JSX.Element | null`
  - `KeywordTileGridProps` with `title?: string`, `items?: KeywordTileItem[]`, `fallbackText?: string`, `maxItems?: number`.

- [ ] **Step 1: Add failing component render test**

Append imports to `apps/web/tests/keyword-tiles.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import { KeywordTileGrid } from '../src/components/report/KeywordTileGrid';
```

Append test inside the existing describe block:

```ts
it('renders fallback phrases as keyword tiles with category labels', () => {
  render(
    <KeywordTileGrid
      title="流动性评估"
      fallbackText="假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。"
    />,
  );

  expect(screen.getByText('流动性评估')).toBeInTheDocument();
  expect(screen.getByText('假设市场流动性充足')).toBeInTheDocument();
  expect(screen.getByText('未考虑冲击成本')).toBeInTheDocument();
  expect(screen.getByText('滑点恶化亏损')).toBeInTheDocument();
  expect(screen.getByText('基于日线回测')).toBeInTheDocument();
  expect(screen.getAllByText('假设').length).toBeGreaterThanOrEqual(2);
  expect(screen.getByText('限制')).toBeInTheDocument();
  expect(screen.getByText('风险')).toBeInTheDocument();
});
```

If `toBeInTheDocument()` is unavailable in this file, import `@testing-library/jest-dom/vitest` is already configured by the project setup. Do not add a duplicate setup import unless the test fails with `Invalid Chai property: toBeInTheDocument`.

- [ ] **Step 2: Run component test and verify RED**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
```

Expected: FAIL because `KeywordTileGrid` does not exist.

- [ ] **Step 3: Implement `KeywordTileGrid.tsx`**

Create `apps/web/src/components/report/KeywordTileGrid.tsx`:

```tsx
import type { KeywordTileItem, NormalizedKeywordTile } from './keyword-tiles';
import { normalizeKeywordTiles } from './keyword-tiles';
import styles from '@/styles/report-tables.module.css';

interface KeywordTileGridProps {
  title?: string;
  items?: KeywordTileItem[];
  fallbackText?: string;
  maxItems?: number;
}

const CATEGORY_LABELS: Record<NormalizedKeywordTile['category'], string> = {
  assumption: '假设',
  limitation: '限制',
  risk: '风险',
  observation: '观察',
};

const CATEGORY_CLASSES: Record<NormalizedKeywordTile['category'], string> = {
  assumption: styles.keywordTileAssumption,
  limitation: styles.keywordTileLimitation,
  risk: styles.keywordTileRisk,
  observation: styles.keywordTileObservation,
};

export function KeywordTileGrid({ title, items, fallbackText, maxItems }: KeywordTileGridProps) {
  const tiles = normalizeKeywordTiles({ items, fallbackText, maxItems });
  if (!tiles.length) return null;

  return (
    <section className={styles.keywordTileSection}>
      {title && <h4 className={styles.assessTitle}>{title}</h4>}
      <div className={styles.keywordTileGrid}>
        {tiles.map((tile) => (
          <article className={`${styles.keywordTile} ${CATEGORY_CLASSES[tile.category]}`} key={`${tile.category}-${tile.text}`}>
            <span className={styles.keywordTileCategory}>{CATEGORY_LABELS[tile.category]}</span>
            <strong className={styles.keywordTileText}>{tile.text}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add CSS classes**

Append to `apps/web/src/styles/report-tables.module.css`:

```css
.keywordTileSection {
  display: grid;
  gap: var(--space-md);
}

.keywordTileGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-sm);
}

.keywordTile {
  display: grid;
  gap: 6px;
  min-height: 82px;
  padding: var(--space-md);
  border: 1px solid var(--line);
  background: rgba(8, 16, 15, 0.4);
  border-radius: var(--radius-sm);
}

.keywordTileCategory {
  width: fit-content;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: var(--tracking-wide);
}

.keywordTileText {
  align-self: end;
  color: var(--text);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
}

.keywordTileAssumption {
  border-color: rgba(98, 216, 255, 0.24);
  background: rgba(98, 216, 255, 0.06);
}

.keywordTileAssumption .keywordTileCategory {
  color: var(--cyan);
  background: rgba(98, 216, 255, 0.12);
}

.keywordTileLimitation {
  border-color: rgba(255, 203, 107, 0.28);
  background: rgba(255, 203, 107, 0.07);
}

.keywordTileLimitation .keywordTileCategory {
  color: #ffcb6b;
  background: rgba(255, 203, 107, 0.14);
}

.keywordTileRisk {
  border-color: rgba(255, 107, 107, 0.28);
  background: rgba(255, 107, 107, 0.07);
}

.keywordTileRisk .keywordTileCategory {
  color: var(--red, #ff6b6b);
  background: rgba(255, 107, 107, 0.14);
}

.keywordTileObservation {
  border-color: rgba(77, 240, 160, 0.2);
  background: rgba(77, 240, 160, 0.05);
}

.keywordTileObservation .keywordTileCategory {
  color: var(--green);
  background: rgba(77, 240, 160, 0.12);
}
```

- [ ] **Step 5: Run component tests**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.ts
```

Expected: PASS.

- [ ] **Step 6: Typecheck**

Run:

```bash
pnpm --filter @quant/web exec tsc --noEmit
```

Expected: exit 0 with no output.

- [ ] **Step 7: Commit Task 3**

Only commit if the user asked for commits. Otherwise skip.

```bash
git add apps/web/src/components/report/KeywordTileGrid.tsx apps/web/src/styles/report-tables.module.css apps/web/tests/keyword-tiles.test.tsx
git commit -m "feat(web): add keyword tile grid component"
```

---

### Task 4: Convert Potential Issues tab to tile dashboard

**Files:**
- Modify: `apps/web/src/components/report/ReportIssues.tsx`
- Modify: `apps/web/src/styles/report-tables.module.css`
- Test: `apps/web/tests/report-issues.test.tsx`

**Interfaces:**
- Consumes from Task 3:
  - `KeywordTileGrid`
- Produces:
  - Potential Issues tab uses tiled layout for status cards, liquidity assessment, and capacity estimate.

- [ ] **Step 1: Write failing `ReportIssues` render test**

Create `apps/web/tests/report-issues.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportIssues } from '../src/components/report/ReportIssues';
import { createBacktestReportFull, getReportUiCopy } from '../src/appData';

function makeReport() {
  return createBacktestReportFull({
    issues: {
      overfittingRisk: 'medium',
      survivorshipBias: false,
      lookAheadBias: false,
      liquidityAssessment: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
      capacityEstimate: '容量受成交额约束；大资金需要分批建仓。',
    },
  });
}

describe('ReportIssues keyword tiles', () => {
  it('renders potential issues as status and keyword tiles', () => {
    const { container } = render(<ReportIssues report={makeReport()} ui={getReportUiCopy('zh')} />);

    expect(screen.getByText('假设市场流动性充足')).toBeInTheDocument();
    expect(screen.getByText('未考虑冲击成本')).toBeInTheDocument();
    expect(screen.getByText('滑点恶化亏损')).toBeInTheDocument();
    expect(screen.getByText('基于日线回测')).toBeInTheDocument();
    expect(screen.getByText('容量受成交额约束')).toBeInTheDocument();
    expect(screen.getByText('大资金需要分批建仓')).toBeInTheDocument();

    expect(container.querySelectorAll('[data-keyword-tile="true"]').length).toBeGreaterThanOrEqual(6);
    expect(container.querySelector('[data-testid="liquidity-assessment-paragraph"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm --filter @quant/web test -- tests/report-issues.test.tsx
```

Expected: FAIL because `ReportIssues` still renders paragraph layout and no `data-keyword-tile` attributes exist.

- [ ] **Step 3: Update `KeywordTileGrid` to expose tile test attribute**

Modify `apps/web/src/components/report/KeywordTileGrid.tsx` tile article:

```tsx
<article
  className={`${styles.keywordTile} ${CATEGORY_CLASSES[tile.category]}`}
  data-keyword-tile="true"
  key={`${tile.category}-${tile.text}`}
>
```

- [ ] **Step 4: Update `ReportIssues.tsx`**

Replace the assessment paragraph blocks with `KeywordTileGrid` and status tiles.

Use this implementation:

```tsx
import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-tables.module.css';
import { KeywordTileGrid } from './KeywordTileGrid';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function RiskIndicator({ level, ui }: { level: 'low' | 'medium' | 'high'; ui: ReportUiCopy['issues'] }) {
  const cls = level === 'low' ? styles.riskLow : level === 'medium' ? styles.riskMed : styles.riskHigh;
  const label = level === 'low' ? ui.lowSeverity : level === 'medium' ? ui.mediumSeverity : ui.highSeverity;
  return (
    <span className={`${styles.riskDot} ${cls}`} title={label}>
      <span className={styles.riskLabel}>{label}</span>
    </span>
  );
}

export function ReportIssues({ report, ui }: Props) {
  const issues = report.issues;
  const labels = ui.issues;

  return (
    <div className={styles.issuesPanel}>
      <div className={`${styles.issuesGrid} ${styles.issuesGridFull} ${styles.issueStatusTiles}`}>
        <article className={`${styles.issueCard} ${styles.issueStatusTile}`} data-keyword-tile="true">
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.overfitting}</span>
            <RiskIndicator level={issues.overfittingRisk} ui={labels} />
          </div>
        </article>
        <article className={`${styles.issueCard} ${styles.issueStatusTile}`} data-keyword-tile="true">
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.survivorshipBias}</span>
            <span className={issues.survivorshipBias ? styles.issueBadWarn : styles.issueBadGood}>
              {issues.survivorshipBias ? labels.yesLabel : labels.noLabel}
            </span>
          </div>
        </article>
        <article className={`${styles.issueCard} ${styles.issueStatusTile}`} data-keyword-tile="true">
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.lookAheadBias}</span>
            <span className={issues.lookAheadBias ? styles.issueBadWarn : styles.issueBadGood}>
              {issues.lookAheadBias ? labels.yesLabel : labels.noLabel}
            </span>
          </div>
        </article>
      </div>

      <KeywordTileGrid
        title={labels.liquidity}
        items={issues.liquidityAssessmentItems}
        fallbackText={issues.liquidityAssessment}
      />

      <KeywordTileGrid
        title={labels.capacity}
        items={issues.capacityEstimateItems}
        fallbackText={issues.capacityEstimate}
      />
    </div>
  );
}
```

- [ ] **Step 5: Adjust layout CSS**

In `apps/web/src/styles/report-tables.module.css`, change `.issuesPanel` to a single-column stack for the tab content:

```css
.issuesPanel {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-lg);
}
```

Add status-tile polish:

```css
.issueStatusTiles {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.issueStatusTile {
  min-height: 82px;
  background: rgba(8, 16, 15, 0.4);
}
```

Keep the existing mobile media rule; it will still work with the new single-column parent.

- [ ] **Step 6: Run ReportIssues test**

Run:

```bash
pnpm --filter @quant/web test -- tests/report-issues.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Run helper and report issue tests together**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx tests/report-issues.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Only commit if the user asked for commits. Otherwise skip.

```bash
git add apps/web/src/components/report/ReportIssues.tsx apps/web/src/components/report/KeywordTileGrid.tsx apps/web/src/styles/report-tables.module.css apps/web/tests/report-issues.test.tsx
git commit -m "feat(web): render potential issues as keyword tiles"
```

---

### Task 5: Final verification and integration check

**Files:**
- No new production files unless prior tasks reveal type/import issues.
- Test: run targeted and existing related checks.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified keyword-tile Potential Issues feature.

- [ ] **Step 1: Run all targeted keyword tile tests**

Run:

```bash
pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx tests/report-issues.test.tsx
```

Expected: both test files pass.

- [ ] **Step 2: Run existing report tests**

Run:

```bash
pnpm --filter @quant/web test -- tests/report.test.tsx tests/use-research-workflow.test.ts
```

Expected: tests pass. If `use-research-workflow.test.ts` prints existing React `act(...)` warnings but exits 0, record the warnings as pre-existing and not caused by this feature.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
pnpm --filter @quant/web exec tsc --noEmit
```

Expected: exit 0 with no output.

- [ ] **Step 4: Review diff for boundary violations**

Run:

```bash
git diff -- apps/web/src/components/report apps/web/src/data apps/web/src/styles apps/web/tests docs/superpowers
```

Expected: diff only touches frontend report display/types/tests and docs. There should be no new imports from `apps/api`, Worker, or Python.

- [ ] **Step 5: Optional manual smoke in running app**

If the dev server is running, open the backtest report and verify the Potential Issues tab visually:

- Status cards are tile-like.
- Liquidity assessment phrase tiles appear separately.
- Capacity estimate phrase tiles appear separately.
- Category labels use category colors.

If the app is not running, do not start services unless the user asks for a manual smoke check.

- [ ] **Step 6: Final commit**

Only commit if the user asked for commits. Otherwise skip.

```bash
git add apps/web/src/components/report apps/web/src/data apps/web/src/styles apps/web/tests docs/superpowers/specs/2026-06-27-report-keyword-tiles-design.md docs/superpowers/plans/2026-06-27-report-keyword-tiles.md
git commit -m "feat(web): add keyword tiles to report issues"
```

---

## Self-Review

- Spec coverage: The plan covers frontend-only scope, optional structured arrays, legacy string fallback, category colors, lightweight classification, Potential Issues tab first, tests, and typecheck.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation steps remain.
- Type consistency: `KeywordTileCategory`, `KeywordTileItem`, `NormalizedKeywordTile`, `splitKeywordText`, `classifyKeywordTile`, `normalizeKeywordTiles`, and `KeywordTileGrid` are defined before use.
- Boundary check: All production changes are under `apps/web`; no backend changes are required.
