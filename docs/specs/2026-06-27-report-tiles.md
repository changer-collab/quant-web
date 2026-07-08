# Backtest Report Keyword Tiles Design

Date: 2026-06-27

## Goal

Render AI-generated conclusions in the backtest report's **Potential Issues** tab as compact keyword tiles instead of long paragraphs. The first target is the full Potential Issues tab so it becomes the visual and code pattern for later sections such as executive summaries, conclusion advice, and risk warnings.

Example input text:

> 假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。

Expected presentation: four separate keyword tiles with category-based styling.

## Scope

In scope:

- Frontend-only display changes under `apps/web`.
- Potential Issues tab:
  - overfitting risk
  - survivorship bias
  - look-ahead bias
  - liquidity assessment
  - capacity estimate
- A reusable keyword-tile component and parsing/classification helpers.
- Backward compatibility with existing string fields.
- Optional support for future structured AI/backend arrays.

Out of scope for this iteration:

- Changing Python, Worker, or AI analysis generation.
- Requiring backend/API output changes.
- Database schema migration.
- Applying keyword tiles to every report tab immediately.

## Dependency and Boundary Rules

- `apps/web` must not import from `apps/api`, Worker, Python, or backend internals.
- The new component consumes the frontend report display model only.
- Existing report JSON remains valid.
- Structured keyword arrays are optional frontend display fields; they do not require backend changes before use.
- Future backend support can populate these optional fields without breaking the frontend fallback path.

## Data Model

Add frontend display-only types in `apps/web/src/data/types.ts`:

```ts
export type KeywordTileCategory = 'assumption' | 'limitation' | 'risk' | 'observation';

export interface KeywordTileItem {
  text: string;
  category?: KeywordTileCategory;
}
```

Extend `ReportIssues` with optional structured fields while keeping current strings:

```ts
export interface ReportIssues {
  overfittingRisk: 'low' | 'medium' | 'high';
  survivorshipBias: boolean;
  lookAheadBias: boolean;
  liquidityAssessment: string;
  capacityEstimate: string;
  liquidityAssessmentItems?: KeywordTileItem[];
  capacityEstimateItems?: KeywordTileItem[];
}
```

Read priority:

1. Use structured `KeywordTileItem[]` if provided.
2. Otherwise split the legacy string field.
3. If no text is available, render no phrase tiles for that field.

## Component Design

Create a reusable component under:

```text
apps/web/src/components/report/KeywordTileGrid.tsx
```

Responsibilities:

- Accept structured `items` and/or `fallbackText`.
- Normalize phrase items.
- Split legacy strings into phrases.
- Drop empty and too-short fragments.
- De-duplicate phrases.
- Apply a maximum display count, default 12.
- Apply category-based styling.
- Stay presentation-focused: it should not read the global report object or know business-specific report semantics.

Suggested props:

```ts
interface KeywordTileGridProps {
  title?: string;
  items?: KeywordTileItem[];
  fallbackText?: string;
  maxItems?: number;
}
```

`ReportIssues.tsx` will use this component for liquidity and capacity:

```tsx
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
```

The three boolean/risk status indicators should also be restyled as tile/card elements so the whole Potential Issues tab reads as one tiled dashboard.

## Tile Categories

Use category semantics instead of severity semantics:

- `assumption`: blue/cyan; preconditions or modelling assumptions.
- `limitation`: amber/yellow; missing assumptions, missing costs, data limitations.
- `risk`: red; loss, worsening, drawdown, impact, or explicit risk.
- `observation`: green or neutral; general finding when no stronger category applies.

Structured input category wins over automatic classification.

## Fallback Splitting Rules

Split legacy strings by:

- Chinese punctuation: `；。！？、，`
- English punctuation: `; . ! ? ,`
- Newlines

Then:

- Trim whitespace.
- Remove empty fragments.
- Remove fragments with length <= 1.
- De-duplicate exact text.
- Limit to 12 tiles by default.

## Fallback Classification Rules

The frontend classifier is intentionally lightweight and deterministic:

- `assumption` when text includes any of:
  - `假设`, `基于`, `前提`, `默认`, `充足`
- `limitation` when text includes any of:
  - `未考虑`, `不足`, `限制`, `缺少`, `未纳入`
- `risk` when text includes any of:
  - `风险`, `亏损`, `恶化`, `冲击`, `滑点`, `回撤`
- otherwise `observation`

If multiple categories match, use this priority:

1. Structured category, if present.
2. `limitation`
3. `risk`
4. `assumption`
5. `observation`

This priority makes phrases like `未考虑冲击成本` classify as `limitation` by default, while `滑点恶化亏损` classifies as `risk`.

## Styling

Reuse existing report visual language:

- dark panel background
- thin borders
- compact uppercase/category labels
- responsive grid with `auto-fit`/`minmax`
- hover border/brightness changes only if consistent with current report cards

Styling can live in `report-tables.module.css` for the first iteration because `ReportIssues` already uses it. If keyword tiles later spread across more tabs, extract to a dedicated `keyword-tiles.module.css`.

## Testing

Use TDD.

Target tests:

1. Helper test for text splitting and classification:
   - input: `假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。`
   - output: four tiles
   - categories: assumption, limitation, risk, assumption

2. Helper test for structured data priority:
   - given `{ text: '未考虑冲击成本', category: 'risk' }`
   - output category remains `risk`, not fallback `limitation`

3. Component/report test:
   - render Potential Issues with a legacy liquidity string
   - assert each phrase appears as a tile
   - assert liquidity/capacity are rendered through the tile grid instead of the old paragraph-only layout

4. Existing workflow compatibility:
   - existing report tests still pass
   - `pnpm --filter @quant/web exec tsc --noEmit` passes

## Future Extension Pattern

Later sections should reuse the same component and helper functions:

- Executive Summary: recommendation reason and main risks.
- Conclusion: advantages, potential risks, improvements.
- Risk Warnings: limitations and red lines.

Future backend/AI structured output should map to `KeywordTileItem[]` fields, while retaining legacy strings during migration.
