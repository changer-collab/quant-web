What I implemented
- Added `D:\quant-web\apps\web\src\components\report\keyword-tiles.ts` with the required frontend-only helpers:
  - `KeywordTileCategory`
  - `KeywordTileItem`
  - `NormalizedKeywordTile`
  - `splitKeywordText`
  - `classifyKeywordTile`
  - `normalizeKeywordTiles`
- Added `D:\quant-web\apps\web\tests\keyword-tiles.test.tsx` with 5 helper tests covering splitting, deterministic classification, fallback normalization, structured-category precedence, deduplication, and `maxItems` limiting.

TDD Evidence
- RED command/output summary and why expected:
  - Command: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
  - Result: FAIL.
  - Expected failure: Vitest could not resolve `../src/components/report/keyword-tiles` from `tests/keyword-tiles.test.tsx` because the helper module did not exist yet. This is the expected RED state proving the test was exercising missing functionality rather than passing against pre-existing code.
- GREEN command/output summary:
  - Command: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
  - Result: PASS.
  - Output summary: `1 passed` test file, `5 passed` tests.

Files changed
- `D:\quant-web\apps\web\src\components\report\keyword-tiles.ts`
- `D:\quant-web\apps\web\tests\keyword-tiles.test.tsx`

Self-review findings
- Implementation matches the task brief verbatim for public types, function names, keyword sets, split pattern, default max items, and classification precedence.
- The module has no project-specific dependencies and stays within `apps/web` frontend boundaries.
- Deduplication is applied both when splitting fallback text and when normalizing structured/fallback inputs, matching the requested behavior.
- Structured item categories are preserved when valid, with fallback classification only used when category is absent or invalid.

Any concerns
- The brief contains a likely typo (`keyword-tiles.test.tsxx`) and test command examples referencing `.ts`; I followed the user instruction and actual created file path `apps/web/tests/keyword-tiles.test.tsx`, and used that path in the executed test commands.
- No commit was created, per session instructions.

Task 1 review-fix update
- Fixed structured-array precedence in `D:\quant-web\apps\web\src\components\report\keyword-tiles.ts` by treating `items !== undefined` as authoritative input. This preserves an explicitly provided empty array (`items: []`) and prevents fallback to legacy text in that case.
- Fixed `maxItems <= 0` handling by returning `[]` before any normalization work, preventing the previous push-then-break behavior from emitting one tile when `maxItems` was `0`.
- Expanded `D:\quant-web\apps\web\tests\keyword-tiles.test.tsx` with 2 regression tests covering:
  - explicit empty `items` array should produce no tiles even when `fallbackText` exists
  - `maxItems: 0` and `maxItems: -1` should both produce no tiles

TDD evidence for review fixes
- RED: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
  - Result: FAIL with 2 expected assertion failures.
  - Failure 1 proved the bug where `items?.length ? items : fallback...` incorrectly fell back when `items` was explicitly `[]`.
  - Failure 2 proved the bug where `maxItems: 0` still returned one normalized tile.
- GREEN: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
  - Result: PASS.
  - Output summary: `1 passed` test file, `7 passed` tests.

Task 1 null structured items hardening
- Scope: narrow fix only in `D:\quant-web\apps\web\src\components\report\keyword-tiles.ts` plus the requested regression test in `D:\quant-web\apps\web\tests\keyword-tiles.test.tsx`.
- Change made:
  - Added regression test: `falls back to legacy text when structured items is null from JSON`
  - Changed source item selection from `items !== undefined ? items : ...` to `Array.isArray(items) ? items : ...`

RED
- Command: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
- Result: FAIL
- Relevant failure proving the bug:
  - `TypeError: sourceItems is not iterable`
  - Stack: `D:\quant-web\apps\web\src\components\report\keyword-tiles.ts:66`
- Additional observed failure during the same run:
  - `preserves structured AI issue keyword items when mapping backtest results`
  - Received `undefined` for `report.issues.liquidityAssessmentItems`
  - This appears unrelated to the null-array guard change and was left untouched.

GREEN
- Command: `pnpm --filter @quant/web test -- tests/keyword-tiles.test.tsx`
- Result: still overall FAIL because of the unrelated existing mapping test above
- Targeted regression status:
  - `falls back to legacy text when structured items is null from JSON` now PASS
- File summary after the narrow fix:
  - `8 passed`, `1 failed`
- Interpretation:
  - The null/non-array handling bug in `normalizeKeywordTiles` is fixed.
  - The requested full command does not go fully green on this branch due to a separate pre-existing failure outside the requested narrow fix scope.
