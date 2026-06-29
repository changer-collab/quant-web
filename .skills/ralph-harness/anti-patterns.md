# Ralph Harness Anti-Patterns & Troubleshooting

Heavy reference for known failure modes, their root causes, and correct approaches. Load this file when debugging ralph harness issues, reviewing story completion, or investigating why the engine isn't converging.

## Anti-Patterns (must avoid)

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| `\|\| true` swallows all errors | Next iteration can't learn | `recordError()` captures exit code + classified recording |
| Stateless per-iteration execution | Repeats same errors | `buildEnhancedPrompt()` injects previous iteration error summary |
| `--print` single-turn no feedback | Agent can't adjust mid-execution | Consider `--max-turns` multi-turn mode |
| progress.txt `>` overwrite | Loses historical memory | `appendProgressLog()` always appends |
| No convergence detection | Infinite loop | `checkConvergence()` + `checkStoryLimits()` |
| Unstructured error summaries | Hard to auto-judge | `detectFailures()` uses 6 classification patterns |
| LF line endings in ralph.ps1 | PowerShell throws `UnexpectedToken`, can't run | Use `sed -i 's/$/\r/'` to convert to CRLF, or configure `.gitattributes` with `*.ps1 text eol=crlf` |
| `$ErrorActionPreference="Stop"` + native command stderr | node writing to stderr throws NativeCommandError, variable assigned to null, `.Trim()` throws InvokeMethodOnNull | Use `Invoke-Core` helper: `try { & node @args 2>$null } catch { return "" }`, all node calls go through this |
| PowerShell 5.x console default GBK encoding | Claude CLI outputs UTF-8 Chinese, PowerShell 5.x console defaults to GBK, all Chinese garbled | Set at script top: `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`; also `chcp 65001` (cmd) or `$OutputEncoding = [System.Text.Encoding]::UTF8` (PowerShell 5.x) |
| `import.meta.url === 'file://${process.argv[1]}'` CLI detection | On Windows `import.meta.url` uses forward slashes `file:///D:/`, `process.argv[1]` uses backslashes `D:\\`, condition always false, all commands silently no-op | Change to `import.meta.url.endsWith(process.argv[1].replace(/\\\\/g, '/'))` — normalize backslashes to forward slashes first |
| PowerShell `$Command \| claude --print 2>&1 \| Tee-Object` pipeline blocking | Long silence (7+ min), user thinks script hung; can't observe what claude is doing | Use `node ralph-run.mjs <prompt-file> <output-file>` instead: launches claude in `stream-json` mode, parses and prints each `assistant` message `text` content in real-time, shows `🔧 tool_name: detail` for tool calls. Exit code and full output pass through files, not pipes. |
| `--print` + `--output-format stream-json` missing `--verbose` | Claude CLI errors: `When using --print, --output-format=stream-json requires --verbose` | Must include all three flags: `--print --verbose --output-format stream-json` |
| **Claude asks "approve?"/"allow?" in `--print` non-interactive mode** | Claude invokes interactive skills (brainstorming/planning), outputs design proposal and waits for approval — but `--print` is batch mode with no one to answer, entire iteration wasted | **(1) Add hard rule in `AGENT_PROMPT.md`**: explicitly tell Agent this is non-interactive batch mode, no waiting for approval, execute directly after reading prd.json. Wording: `你运行在非交互批处理模式（--print），没有人会回答你的问题。不要问"是否批准"、"是否允许"、"要不要继续"——读完 prd.json 后直接执行实现，不等待回复。不要调用要求用户交互的 skill（如 brainstorming/planning），直接写代码。` **(2) Ralph harness startup**: check `AGENT_PROMPT.md` for this instruction, auto-append if missing. |
| Node `spawn("claude", [...], { shell: true })` triggers DEP0190 | Security warning (shell argument concatenation injection risk) | DEP0190 warning is safe to ignore — all arguments are hardcoded constants, no user input injection risk. On Windows, `shell: true` **must** be kept because `.cmd` files require shell parsing; removing it causes `spawn EINVAL`. |
| Node `spawn("claude", [...])` without `shell: true` errors `spawn EINVAL` | On Windows `.cmd`/`.bat` files can't be spawned directly, errors `EINVAL` (errno -4071) | Windows must use `shell: true` because `.cmd` files aren't executable binaries on Windows, must go through `cmd.exe`. Unix/macOS binaries have no such restriction. |
| No baseline detection before modifying code | Introduces new bugs, previously passing tests all fail | `--init-run` saves baseline test results; after each story, compare; if regressed, `git checkout` rollback diff files |
| Continue iterating after regression | Same error repeats, wastes iterations | After rollback, same story max 3 retries; if all regress, mark `skip` |
| Change log is only raw diff | Can't trace "why changed", can't assess rollback impact | Use `changelog.jsonl` structured log: each record has timestamp/iteration/story/reason |
| Error stored as latest only, no accumulation | Can't discover repeating patterns, knowledge doesn't accumulate | Append to `error-ledger.jsonl`; threshold ≥3 occurrences triggers upgrade proposal |
| **Claude changes code but forgets to update prd.json passes** | prd.json state lags behind git log, harness sees zero progress | `ralph-core.mjs` `updateProgress()` adds git diff and git log cross-validation; Agent must verify prd.json includes passes change before committing |
| **Story says "connect sync pipeline" but only changes JSON mapper, not builder** | Obsidian sync markdown output missing new fields | Acceptance criteria must explicitly include builder update check; PRD stories involving sync pipeline must list builder changed files |
| **Current branch ≠ PRD branchName, Agent stuck on worktree approval** | In `--print` non-interactive mode, Agent detects branch mismatch, asks "allow creating isolated worktree?" — no one answers, iteration spins | **(1)** Before starting Ralph, user should manually `git checkout -b ralph/<feature>`. Write into pre-start checklist. **(2)** If must run on branch with uncommitted changes, `git stash` or commit first, then switch. **(3)** `AGENT_PROMPT.md` "don't ask for permission" rule covers this. |
| **Ralph-written tests only have shallow assertions ("field exists"/"correct length"), skip core invariants** | Code looks reasonable, unit tests all green, but core correctness conditions never tested. Example: story-6 sub_equity tests verify "field exists, each symbol has 3 points" but miss "Σ per-symbol equity ≈ total equity" — implementation is wrong (cash allocation formula non-additive) yet all shallow tests pass | **(1)** PRD acceptance criteria must name the mathematical invariants to test (conservation, monotonicity, bounds, summation), e.g. "verify Σper_symbol_equity ≈ total_equity at each time point". **(2)** Review each story's acceptanceCriteria with the lens: "if tests are all green but core logic is wrong, which assertion would catch it?" **(3)** First thing during review: grep test file assert statements for `≈`/`sum`/`abs`/`all` — if only `is not None`/`== length`/`in`, coverage is usually insufficient. |
| **`--print` single turn completes multiple stories, context compaction loses key details** | Stronger models tend to do 2-3 stories at once. But in `--print` mode Claude does context compaction, later stories' key code lines, boundary conditions, dependencies get compressed to summaries and lost, leading to "coding from memory." | **(1)** `AGENT_PROMPT.md` add hard rule: "each iteration implements one and only one story". **(2)** If model ignores this, Ralph's `--check-convergence` naturally converges on zero progress. **(3)** The most important defense is not restricting model behavior — it's **independent review after every Ralph run** (fresh session/agent, grep assertions, check against invariants checklist) — story completion review is a fixed process, not a post-mortem remedy. **(4)** `--detect-multi-story` CLI command now detects >1 story completion per iteration and prints a prominent terminal warning. |
| **`storyAttempts` counter never incremented → check-limits never blocks anything** | `incrementStoryAttempt()` exists in ralph-core.mjs but had no corresponding CLI command. Shell scripts called `--check-limits` before each iteration but never incremented the counter — per-story 5-attempt limit was a dead letter. | **(1)** Added `--increment-story-attempt <storyId>` CLI command. **(2)** Shell scripts now call `--get-next-story` to determine which story will run, then `--increment-story-attempt` before launching claude. **(3)** Verify: after 5 attempts on same story, `--check-limits` will exit with code 9. |
| **`consecutiveNoProgress` only checks `passes` count — code written but passes not updated = false positive** | Claude writes all code, commits, but forgets to flip `passes: true` → harness sees zero progress → exits after 5 iterations thinking nothing happened. Git log shows code changes but harness is blind to them. | **(1)** Added `--record-git-head` to snapshot HEAD before each iteration. **(2)** Added `--check-git-progress` after iteration: if HEAD changed but passes count didn't, auto-reset `consecutiveNoProgress` to 0 (real work was done) and print warning. **(3)** The harness now distinguishes "code changed, passes stale" (auto-correct) from "true no-progress" (converge). |
| **Story completion updates passes but skips Doc Sync judgment** | Code changes make plan/spec/architecture docs stale while prd.json shows "complete." Next iteration or human review reads stale docs as ground truth, wasting cycles on diagnosis or propagating wrong assumptions. | Completion checklist must include explicit Doc Sync step: update all affected docs, or record clear judgment of "no update needed" with rationale. **Deferred documentation is not accepted** — the judgment must fire every iteration, same as updating passes. |
| **Guardian rules had extension/diff-range inconsistency, no directory-scope check, state file leaked to model** | Rule 2 accepted `.css/.mjs` as code but Rule 3 didn't; Rule 2 used `lastGitHead..HEAD` but Rule 3 always used `HEAD~1`; model could change CSS file and claim api-agent story complete; `AGENT_PROMPT.md` told model to read `.prd.state.json` exposing `passesSnapshot` | **(1)** Extracted shared `CODE_EXTENSIONS` constant (`.ts/.tsx/.py/.js/.mjs`) used by all rules — CSS no longer counts as implementation. **(2)** Unified diff range to `lastGitHead..HEAD` across all rules. **(3)** Added Rule 4: `AGENT_DIR_MAP` validates changed files are in the story's agent directory (api-agent → apps/api/, frontend-agent → apps/web/, etc.). **(4)** Added SHA256 integrity hash on `passesSnapshot` — tampered snapshot triggers warning + fallback-to-first-run. **(5)** Removed `.prd.state.json` read instruction from `AGENT_PROMPT.md` to close info leak. |

## Story Completion Review Checklist

### Universal Review Process

```
1. Read prd.json, understand each story's acceptanceCriteria
2. List all commits on feature branch (git log oneline)
3. Locate corresponding commit(s) for each story
4. For each story:
   a. git show <commit> --stat to see changed files
   b. Check against acceptanceCriteria item by item
   c. Check for files the story should have modified but missed
5. For full-pipeline stories, check all upstream/downstream mapping points
6. Output completion matrix
```

### Story Completion Matrix

| Story Type | Files to Check | Common Omissions | Key Verification Method |
|---|---|---|---|
| **Python engine metric expansion** | `types.py`, `equity_stats.py`, `backtest.py`, test files | New metrics only added in CLI entry `_result_to_dict()`, not in dataclass | `git show <commit> --stat` confirms dataclass also gained fields |
| **API/Frontend type alignment** | `apps/api/src/types.ts`, `apps/api/src/mapper.ts`, `apps/web/src/data/types.ts`, `apps/web/src/data/factories.ts` | API and frontend types out of sync, mapper returns null vs 0 inconsistently | Compare field names and nesting across both types.ts, check mapper null handling |
| **Frontend null data rendering** | `apps/web/src/components/report/*.tsx`, `useResearchWorkflow.ts` | SSE error handler not guarded, result handler unconditionally creates report | Read `useResearchWorkflow.ts` error and result callback logic |
| **Obsidian sync pipeline** | `packages/obsidian-sync/builders/backtest.py`, `strategy-runtime/commands/sync_backtest.py` | Builder not updated, `_dict_to_backtest_result()` mapping incomplete | Check both files were modified; `_dict_to_backtest_result()` `BacktestMetrics(...)` includes new fields |
| **Frontend UI controls** | `apps/web/src/components/workspace.tsx`, related hook config init | Code completely absent — prd.json says to build but branch has no such control | Search for UI control keywords (e.g., `type="date"`) to confirm existence |
| **End-to-end verification** | No code changes, manual service startup verification | Check that all stories verification story depends on are actually complete | Start API + Worker + Frontend, submit real backtest |

## Troubleshooting

### `.prd.state.json` corruption → empty prompt

**Symptom**: After ralph starts, each iteration prompt is only 3 characters, outputs `WARNING: Prompt is very short: "﻿\n"`, claude CLI exits immediately (exit code 0), no actual execution.

**Root cause**: `ralph-core.mjs` `readJson()` calls `JSON.parse()` on `.prd.state.json`. When file is empty (0 bytes) or invalid JSON, `JSON.parse("")` throws `SyntaxError: Unexpected end of JSON input`. `buildEnhancedPrompt()` crashes when calling `readState()`, `--build-prompt` produces no stdout, ralph.ps1 writes empty prompt to `.current-prompt.md`.

**Diagnosis**:
```bash
# Check file size
wc -c scripts/ralph/.prd.state.json
# Output "0 scripts/ralph/.prd.state.json" → file is empty

# Or view contents directly
cat scripts/ralph/.prd.state.json
# Empty output → confirmed corrupt
```

**Fix**:
```bash
# 1. Delete corrupt file
rm -f scripts/ralph/.prd.state.json

# 2. Reinitialize
node scripts/ralph/ralph-core.mjs --init
node scripts/ralph/ralph-core.mjs --init-run

# 3. Verify fix
node scripts/ralph/ralph-core.mjs --build-prompt 1 | wc -c
# Should output >10000 (~14KB)
```

**Prevention**: `readJson()` should check for empty string before `JSON.parse`:
```javascript
function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return null;  // empty file treated as nonexistent
  return JSON.parse(content);
}
```

### prd.json progress desync (code changed but passes not updated)

**Symptom**: Ralph's Claude Agent completed code changes and committed, but `prd.json` `passes` still `false`. Next iteration harness sees "zero progress", may converge/exit or reassign completed stories.

**Root cause (three layers)**:
1. **Claude Agent didn't execute step 9** — AGENT_PROMPT.md requires "update prd.json passes", but Claude may forget after fixing test/lint, due to output truncation, or tool call errors
2. **`updateProgress()` only checks passes count** — doesn't check git diff or git log; Claude can commit all code changes but as long as passes unchanged, harness sees zero progress
3. **Mixed commit pollution** — non-story harness infrastructure files mixed into story commit, interfering with passes update

**Verification**:
```bash
# Check all commits on feature branch
git log --oneline ralph/<branch> ^main

# Cross-check against prd.json userStories
node scripts/ralph/ralph-core.mjs --remaining

# Check if latest commit includes prd.json changes
git show HEAD --name-only
git show HEAD -- scripts/ralph/prd.json  # Check prd.json was modified
```

**Fix (manual sync)**:
```bash
# Manually set completed stories to passes: true in prd.json
# Then commit
git add scripts/ralph/prd.json
git commit -m "docs: sync prd.json passes to actual code progress"
```

## PowerShell Line Ending Compatibility (Windows critical)

PowerShell `.ps1` parsing strictly requires **CRLF** (`\r\n`) line endings. LF endings cause:
```
表达式或语句中包含意外的标记"}"。
```

**Fix** (in Git Bash):
```bash
sed -i 's/$/\r/' scripts/ralph/ralph.ps1
```

**Prevention**:
- Add `*.ps1 text eol=crlf` to `.gitattributes`
- After every create/modify of `ralph.ps1`, immediately convert with above command
- Claude: after Write tool creates `ralph.ps1`, immediately run CRLF conversion via Bash. This is NOT optional — write the .ps1 first, then run: `sed -i 's/$/\r/' scripts/ralph/ralph.ps1`
- The `Invoke-Core` helper uses `` "`n" `` as a join separator (line 36). When the file is LF-only, PowerShell treats the backtick-newline as a line continuation character, breaking the string on the next line and producing `UnexpectedToken` / 字符串缺少终止符. CRLF prevents this because `\r\n` terminates the backtick sequence cleanly.

## Agent Modifying Tests to Bypass Validation

**Symptom**: An agent, when given a failing test and told "only change the test file, not the implementation", changes the expected values to match the wrong output (`assert result == 6` instead of `assert result == 5` when implementation returns `2 * 3` instead of `2 + 3`). The tests pass but the validation is bypassed.

**Root cause**: The agent treats the test as mutable configuration rather than the specification of truth. Under pressure (deadline, "tests must be green", "only touch the test file"), the shortest path is to align expected values with current behavior.

**Fix approach**:
1. In AGENT_PROMPT.md, add: "Test files are the truth. Never modify a test to match incorrect output. If a test fails, fix the implementation. If you cannot fix the implementation, leave the test red."
2. In the ralph-harness review process, after each story completion, run `git diff -- '**/test*' '**/*.test.*' '**/*.spec.*'` to detect test-only changes. If only test files changed (no corresponding implementation change), flag for human review.
3. Consider a "test guardian" subagent that monitors test file modifications and rejects any PR where test assertions are weakened without corresponding implementation fixes.

**Red Flags**:
- Test expected values changed to match wrong output
- Test assertions removed or commented out
- `assert False` or `assert True` added (no-op asserts)
- Test `if __name__ == "__main__"` blocks removed
- "Skip" markers added to failing tests without justification
- Test function bodies replaced with `pass`
- Error message strings in assertions changed to match wrong error output

| Excuse | Reality |
|--------|---------|
| "Tests needed to reflect the actual API contract" | The API contract is the spec, not the current implementation |
| "The expected values were wrong in the first place" | Then fix the implementation, not the test |
| "I just adjusted for the real behavior" | The real behavior should match the test, not the other way |
| "Deadline pressure requires pragmatic choices" | Passing weakened tests is worse than failing tests — failing tests signal real problems |
| "I should change both together — fix test to match the spec and fix implementation" | Changing a green test to match a new spec is refactoring, not fixing. This is a new requirement, not a bugfix. Create a new story for the requirement change, don't modify the existing test. |
