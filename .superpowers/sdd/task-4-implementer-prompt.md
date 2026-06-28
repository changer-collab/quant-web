You are a fresh implementer subagent for Task 4 of the report keyword tiles plan in D:/quant-web. You are a subagent, so skip superpowers:using-superpowers. Work in the existing workspace; do not create a git worktree and do not commit.

Read this first — it is your requirements, with exact values to use verbatim:
D:/quant-web/.superpowers/sdd/task-4-brief.md

Context:
- Tasks 1-3 are already present in the working tree: keyword-tiles helpers, KeywordTileGrid component, types/mapping, styles, and keyword-tiles.test.tsx.
- Task 4 is incomplete. ReportIssues.tsx still uses paragraph cards for liquidity/capacity. KeywordTileGrid article lacks data-keyword-tile="true". apps/web/tests/report-issues.test.tsx does not exist.
- Stay inside frontend display/tests scope for this feature: apps/web/src/components/report, apps/web/src/styles/report-tables.module.css, apps/web/tests. Do not touch backend/API/Worker/Python. Do not touch unrelated modified files.
- Follow the plan’s test-driven steps as much as practical: add the ReportIssues test first, observe it fail if possible, then implement, then re-run the relevant tests.
- The plan’s commit steps are explicitly skipped because the user did not ask for commits.

Report contract:
Write your full report to D:/quant-web/.superpowers/sdd/task-4-report.md. Include:
1. Status: DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED
2. Files changed
3. Tests run, with command and pass/fail output summary
4. Self-review notes against the Task 4 requirements
5. Any concerns

Return only: status, one-line summary, tests run, and concerns. Do not paste diffs.
