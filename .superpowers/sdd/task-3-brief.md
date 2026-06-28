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

