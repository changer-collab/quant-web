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
