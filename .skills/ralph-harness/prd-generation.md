# PRD Generation Specification

Heavy reference for generating `scripts/ralph/prd.json` from high-level goals. Load this file when the task involves PRD creation, story decomposition, or acceptance criteria authoring.

## Workflow

```
用户目标
  → 读 AGENTS.md（项目规则、角色边界、依赖白名单）
  → 读相关子项目的 AGENT.md
  → 浏览代码库，理解当前实现状态
  → 三维度前置审查（见下文）
  → 拆解为 user stories
  → 写入 scripts/ralph/prd.json
  → 输出给用户确认
  → 确认后跑引擎
```

## Three-Dimension Pre-Review (mandatory before PRD generation)

Before decomposing into user stories, audit the codebase from three dimensions to identify all blockers. **Skipping this step causes PRDs to miss critical issues — the engine iterates endlessly without converging.**

### Dimension 1: Data Source Completeness — does the backend produce all necessary fields?

**Goal**: Confirm data producers (Python engine / API mapper) can output all fields the report needs.

**Method**:

1. Read data source type definitions (Python dataclass / TS interface), list all output fields
2. Read report type definitions (`BacktestReportFull`), list all required fields
3. Create a cross-reference table: which fields have data sources, which are missing, which need calculation

**Common traps**:

- Python engine only computes basic 6 metrics, but report framework needs 30+ (Sortino, Calmar, VaR, CVaR, volatility, etc.)
- Derived stats (drawdownCurve, monthlyReturns) appended at CLI entry but not in Python dataclass
- Naming inconsistencies: Python uses `return_pct`, TS type uses `return`, frontend uses `return_pct`

**Output format**:

```
| 报告字段 | 数据源 | 状态 |
|---------|--------|------|
| equityCurve | Python runner | ✅ 已有 |
| sortinoRatio | — | ❌ 缺失，需新增计算 |
| var95 | — | ❌ 缺失，需新增计算 |
```

### Dimension 2: Frontend Rendering Safety — can components handle null/empty data?

**Goal**: Confirm all report components don't crash or display garbage when data is null/empty/0.

**Method**:

1. Read report components one by one (`apps/web/src/components/report/Report*.tsx`)
2. Check each component's handling of null/empty/0
3. Classify into three categories:
   - 🔴 **Crash**: null causes runtime exception (e.g., `null.toFixed()`)
   - 🟡 **Garbage display**: shows "null days", "0.0%" etc.
   - 🟢 **Safe**: has guard checks, renders placeholder or nothing on empty data

**Common traps**:

- Template string `${null} 天` renders as "null days"
- `null * 100` is `0` in JS, shows "0.0%" but there's no data
- ECharts with empty array `[]` doesn't crash but renders blank chart
- Radar/bullet charts collapse to a point when all dimensions are 0

**Output format**:

```
| 组件 | 问题字段 | 严重性 | 修复方式 |
|------|---------|--------|---------|
| ReportRiskMetrics | maxDrawdownDuration | 🔴 null 天 | mapper fill default or frontend guard |
| ReportReturnMetrics | alpha | 🟡 shows 0.0% | frontend hides when null |
```

### Dimension 3: Data Pipeline Integrity — can fields flow end-to-end?

**Goal**: Confirm no field loss at each handoff: Python → Worker → API → DB → Frontend.

**Method**:

1. Trace data flow: Python `_result_to_dict()` → Worker `BacktestHandler.handle()` → API `taskRoutes` → `report-mapper` → DB `reportData` → API `GET /reports/:id` → Frontend `fetchReport()`
2. At each handoff, check:
   - Field renaming (snake_case → camelCase, `return_pct` → `return`)
   - `as any` casts that lose type safety
   - JSON serialization/deserialization preserving nested objects
   - `reportData` text column capacity (no truncation risk)

**Common traps**:

- API `BacktestReportFull` and Web `BacktestReportFull` are completely different interface definitions
- `report-mapper.ts` output field names don't match Web types (`drawdownSeries` vs `drawdownCurve`)
- `as any` casts hide type errors until runtime
- Frontend `factories.ts` mapper and API mapper are two independent implementations with inconsistent field mappings

**Output format**:

```
| Handoff 点 | 问题 | 影响 |
|-----------|------|------|
| API mapper → DB | drawdownSeries should be drawdownCurve | Field name mismatch on frontend read |
| DB → Frontend | API and Web BacktestReportFull types differ | Frontend cast may crash |
```

## Story Granularity

- **One story = one concern**: one type, one API endpoint, one mapping logic, one component
- **One story should complete in one iteration**: if it touches 5+ files, split finer
- **Last story must be end-to-end verification**: no code changes, only validates the full chain

## Decomposition Order

```
类型/接口定义 → 核心实现 → 集成点 → 映射/适配 → 验收验证
```

Common pattern:

1. Fill in type definitions first (Python types / TS types)
2. Implement core logic
3. Connect integration points (API routes / CLI commands / Worker handlers)
4. Unify mapping layers (report-mapper / data transforms)
5. End-to-end verification (start services, run full flow, confirm data consistency)

## Required Story Fields

| Field                | Requirement                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `id`                 | `story-N`, incrementing from 1                                     |
| `title`              | One-line summary (Chinese)                                         |
| `description`        | What's broken, which file, what to change                          |
| `acceptanceCriteria` | Verifiable check items, must include quality check command results |
| `agent`              | Role per AGENTS.md based on sub-project touched                    |
| `priority`           | 1 = first, higher = later                                          |
| `dependsOn`          | IDs of prerequisite stories (forms a DAG)                          |

## Acceptance Criteria Guidelines

- **Specific**: not "works correctly", but "GET /api/factors returns JSON array"
- **Verifiable**: each criterion maps to a concrete command or check method
- **Include test commands**: last 1-2 items must be quality check passes. For frontend stories this means `npm test` (not just lint + build). For API stories this means `pnpm --filter @quant/api test`. For Python stories this means `cd packages/<pkg> && python -m pytest -v`.
- **One failure-path criterion required**: every story must include at least one criterion for the first thing that can go wrong (e.g., "API 不可用时前端显示错误提示而非白屏"、"缺少必填字段时返回 4xx"、"数据为空时渲染空状态"), not just happy-path behavior. The failure criterion must describe the concrete user-visible outcome — "doesn't crash" alone is insufficient; say what the user sees instead.
- **Prefer executable over descriptive**: "curl GET /api/strategies/:name → 200, body.config.name exists" over "returns 200 with config body". The criterion should be copy-paste-runnable where possible.
- **Type structure consistency**: when aligning upstream/downstream types (e.g., API ↔ Frontend `BacktestReportFull`), criteria must include "field names and nesting structure identical on both sides" — not just "value fields non-null"
- **Final render observation**: when frontend display is involved, criteria must describe concrete rendering results (e.g., "overview shows strategy name, symbol, time range"), not abstract "data displays correctly"

```json
"acceptanceCriteria": [
  "BacktestResult gains drawdownCurve field",
  "report-mapper removes all as any casts",
  "API BacktestReportFull field names and nesting match frontend types.ts exactly",
  "pnpm --filter @quant/api test passes",
  "pnpm build passes"
]
```

## Verification Story Specification (mandatory)

The final verification story (agent = `fullstack-agent`) **must** include two tiers of validation:

### Tier 1: Data Pipeline (CI-automatable)

- API response structure fully aligned with frontend types
- Numeric metrics meet business expectations (e.g., "drawdown > 0" not "non-null")
- Chinese content renders correctly on frontend (no garbled text)

### Tier 2: UI Rendering (manual or screenshot comparison)

- Core modules have data, not blank
- Each card/chart has actual content
- Console has no JS/TS errors

```json
{
  "id": "story-6",
  "title": "端到端验收",
  "acceptanceCriteria": [
    "curl GET /api/reports/:id response reportData structure matches apps/web/src/data/types.ts BacktestReportFull exactly",
    "Risk metric cards sortinoRatio/calmarRatio are non-zero (positive or negative OK, but not 0 or null)",
    "Strategy overview module shows strategies/symbol/timeRange etc. (non-empty)",
    "Frontend report page has no blank sections",
    "Console has no TypeScript type errors"
  ]
}
```

## Verification Boundary Checklist

Use this checklist when writing or reviewing PRD acceptance criteria:

| #   | Check                                   | Bad Example                                                  | Correct                                                                                                                         |
| --- | --------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Type structure completeness**         | "verify reportData contains drawdownCurve (non-empty array)" | "verify reportData.equityData.drawdownCurve is { timestamp, drawdown }[] with length > 0"                                       |
| 2   | **Nested object alignment**             | Only checking top-level fields                               | Check overview/dataParams/executiveSummary sub-object field names match consumer side                                           |
| 3   | **Numeric semantic correctness**        | "verify sortinoRatio > 0" (negative when strategy loses)     | "verify sortinoRatio is non-null and non-undefined, negative is OK"                                                             |
| 4   | **Upstream attribution for empty data** | Frontend blank → fix frontend                                | First check if API returns data, then if mapper maps it, then decide which layer                                                |
| 5   | **Chinese rendering verification**      | Only test values in API JSON                                 | Must observe actual frontend page for Chinese garbled text                                                                      |
| 6   | **Frontend runtime errors**             | Don't check console                                          | Acceptance criteria must include "no JS/TS errors in console"                                                                   |
| 7   | **Mock vs real data**                   | Tests pass with mock data but fail with real                 | Verification story must use real running services + real backtest data                                                          |
| 8   | **Obsidian Builder completeness**       | Builder only verifies old 6 metrics exist                    | Criteria must include all new metrics (sortinoRatio/calmarRatio/annualizedVolatility etc.) appearing in builder markdown output |
| 9   | **Cross-resource type alignment**       | Only verify JSON structure                                   | For implementation stories, also verify `sync_backtest.py` `_dict_to_backtest_result()` and new builder field mappings match    |
| 10  | **SSE error isolation**                 | Don't test failure redirect                                  | Verification must submit a failed backtest to confirm frontend doesn't redirect and state is correct                            |

## Fault Investigation Order

When verification fails, investigate in this order — don't guess fixes:

1. **What did the API return?** → `curl GET /api/reports/:id`
2. **Do structures align?** → Compare API `BacktestReportFull` vs frontend `BacktestReportFull` type definitions
3. **What did the frontend request?** → Browser Network panel, actual response data
4. **What did the component render?** → Component field names vs API response field names
5. **Which layer is root cause?** → Data source → Mapping → Storage → API → Frontend render, layer by layer

## Agent Assignment Rules

| Code Location                | Agent                  |
| ---------------------------- | ---------------------- |
| `apps/api/`                  | api-agent              |
| `apps/web/`                  | frontend-agent         |
| `apps/worker/`               | worker-agent           |
| `packages/backtest-engine/`  | backtest-agent         |
| `packages/factor-lab/`       | factor-lab-agent       |
| `packages/ai-engine/`        | ai-agent               |
| `packages/strategy-runtime/` | strategy-runtime-agent |
| `packages/strategies/`       | strategies-agent       |
| `packages/data-client/`      | data-client-agent      |
| `packages/obsidian-sync/`    | obsidian-sync-agent    |
| `packages/loop-engine/`      | loop-engine-agent      |
| `services/data-center/`      | data-center-agent      |
| `services/data-collector/`   | data-collector-agent   |
| Cross-project                | fullstack-agent        |

## dependsOn Rules

- Prerequisite stories must complete first (dependency DAG)
- Order: types/interfaces → core impl → integration → verification
- Verification story depends on all implementation stories
- Don't add dependsOn for unrelated stories
- Check for circular dependencies

## branchName Convention

```
ralph/<kebab-case-feature-name>
```

Derived from `feature` field, all lowercase, `-` separated.

## Output Format

Write to `scripts/ralph/prd.json`:

```json
{
  "feature": "feature-name",
  "branchName": "ralph/feature-name",
  "description": "One-line feature goal description",
  "qualityChecks": {
    "js": "pnpm lint && pnpm test && pnpm build",
    "python": "cd packages/<relevant-pkg> && python -m pytest -v"
  },
  "userStories": [
    {
      "id": "story-1",
      "title": "Story title",
      "description": "Detailed: current problem + scope + approach",
      "acceptanceCriteria": ["Specific check item", "pnpm --filter @quant/xxx test passes"],
      "agent": "xxx-agent",
      "priority": 1,
      "passes": false
    }
  ]
}
```

## Quality Check Command Reference

```json
{
  "js": "pnpm lint && pnpm test && pnpm build",
  "python": "cd packages/<relevant-pkg> && python -m pytest -v",
  "multi": "pnpm lint && pnpm test && pnpm build && for pkg in strategy-runtime backtest-engine strategies data-client factor-lab ai-engine obsidian-sync; do (cd packages/$pkg && python -m pytest -v); done"
}
```

**Note**: When a story involves `packages/obsidian-sync`, always check that `build_backtest_report()` and `_dict_to_backtest_result()` have been updated. Quality check command must include `cd packages/obsidian-sync && python -m pytest -v`.

## After Generation

Inform the user:

1. Story count and dependency graph
2. Estimated execution order (topological sort by priority + dependsOn)
3. Suggested max iterations (2-3 per story)
4. Ask for confirmation

**Never auto-start the engine** — wait for user confirmation.

## Prohibitions

- ❌ No unverifiable acceptance criteria ("works correctly" is vague; "returns 200 with field X" is specific)
- ❌ No more than 8 stories (more means needs multiple features)
- ❌ Don't skip dependsOn topology validation (check for circular deps)
- ❌ Don't ignore AGENTS.md role boundaries (each story's agent must have permission for target files)
- ❌ Don't skip the three-dimension pre-review
- ❌ Don't forget PowerShell script line-ending compatibility: ralph.ps1 must use CRLF, otherwise PowerShell throws `UnexpectedToken`
- ❌ **Don't lock in fix locations without evidence**: when unsure where the fault is, first priority is adding observability probes to gather evidence — not guessing fixes. A "fix" story without an evidence chain likely fixes the wrong thing. Correct: add logging/probes first, confirm root cause, then write fix story.
- ❌ **Don't skip the "observe first" phase**: when the user says "I don't know where the problem is", the first PRD story must be **add logging** (no logic changes), run once to confirm fault location, then write fix stories. Observation and fix must be separate stories.
- ❌ **Don't write "checklists" as fix steps**: "check X, check Y" as fix steps is guessing 6 possible locations. Write one story to add logging, run it, then decide what to fix based on logs.
- ❌ **Always update prd.json passes after story completion**: Claude Agent must write `"passes": true` after each story completion commit. Before committing, verify prd.json diff includes passes state change.
- ❌ **Verification story must include Obsidian builder update check**: when "打通同步链路", verify both `build_backtest_report()` and `_dict_to_backtest_result()` were updated, and check builder output markdown template includes all new fields.
