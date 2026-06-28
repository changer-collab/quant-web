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

