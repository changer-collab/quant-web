#!/usr/bin/env node
/**
 * Ralph Core - Shell-Agnostic 自治 AI Agent 循环核心逻辑
 *
 * 所有状态管理、错误检测、收敛判断、PRD 解析、进度日志等
 * 都在这里实现。Shell 包装（.sh / .ps1）只负责循环调用 claude CLI。
 *
 * 直接运行（被 Shell 包装调用）：
 *   node ralph-core.mjs --init           # 初始化 .state.json
 *   node ralph-core.mjs --init-run       # 新 feature run 时重置状态
 *   node ralph-core.mjs --remaining
 *   node ralph-core.mjs --check-convergence 5
 *   node ralph-core.mjs --build-prompt 3
 *   node ralph-core.mjs --record-error 1 0
 *
 * 也作为 ESM 模块被 import。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, cpSync, appendFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// 路径常量
// ═══════════════════════════════════════════════════════════════════

const PROJECT_ROOT = join(__dirname, "..", "..");
const FILES = {
  prd:      join(__dirname, "prd.json"),
  state:    join(__dirname, ".prd.state.json"),
  error:    join(__dirname, ".last-error.json"),
  progress: join(__dirname, "progress.txt"),
  prompt:   join(__dirname, "AGENT_PROMPT.md"),
  archive:  join(__dirname, "archive"),
  lastBranch: join(__dirname, ".last-branch"),
  lastOutput: join(__dirname, ".last-output.txt"),
};

// ═══════════════════════════════════════════════════════════════════
// JSON 工具
// ═══════════════════════════════════════════════════════════════════

function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return null;  // 空文件当作不存在
  return JSON.parse(content);
}

function writeJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

// ═══════════════════════════════════════════════════════════════════
// 状态管理
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_STATE = {
  iterations: 0,
  lastExitCode: 0,
  lastError: null,
  storyAttempts: {},
  lastChanges: "",
  consecutiveNoProgress: 0,
  /** 当前引擎所在的 feature 名（与 prd.json.feature 对齐） */
  feature: "",
  /** 状态文件自身的版本，用于后续结构升级 */
  version: 1,
  /** 上一轮迭代开始前的 HEAD commit hash，用于 git 进度交叉验证 */
  lastGitHead: "",
  /** 单轮完成多个 story 的累计警告次数 */
  multiStoryWarnings: 0,
  /** 每轮迭代前 prd.json 的 passes 快照（用于验证单轮完成数） */
  passesSnapshot: [],
};

export function initState() {
  if (!existsSync(FILES.state)) {
    writeJson(FILES.state, DEFAULT_STATE);
  }
}

export function readState() {
  return readJson(FILES.state) || { ...DEFAULT_STATE };
}

export function updateState(patch) {
  const state = readState();
  Object.assign(state, patch);
  writeJson(FILES.state, state);
  return state;
}

// ═══════════════════════════════════════════════════════════════════
// 引擎生命周期管理
// ═══════════════════════════════════════════════════════════════════

/**
 * 初始化新 run。
 * - 如果 prd.feature 与上次不同 → 清空运行时状态（新 feature run）
 * - 如果相同 → 保持状态继续迭代（同一 feature 的续跑）
 * - 如果 .state.json 不存在 → 新创建
 */
export function initRun() {
  const prd = readPrd();
  const state = readState();
  const lastFeature = state.feature;

  if (!lastFeature) {
    // 首次 run：记录 feature
    updateState({ feature: prd.feature });
    console.log(`Engine initialized: feature="${prd.feature}"`);
    return;
  }

  if (lastFeature !== prd.feature) {
    // 新 feature：归档旧状态，重置为新 feature
    console.log(`New feature detected: "${prd.feature}" (was: "${lastFeature}")`);
    const date = new Date().toISOString().split("T")[0];
    const archiveFolder = join(FILES.archive, `${date}-${lastFeature}`);
    mkdirSync(archiveFolder, { recursive: true });
    for (const f of [FILES.state, FILES.error, FILES.progress]) {
      if (existsSync(f)) {
        cpSync(f, join(archiveFolder, basename(f)));
      }
    }
    console.log(`   Archived previous run to: ${archiveFolder}`);

    writeJson(FILES.state, { ...DEFAULT_STATE, feature: prd.feature });
    console.log(`State reset for feature="${prd.feature}"`);
  } else {
    console.log(`Continuing run: feature="${prd.feature}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// PRD 解析
// ═══════════════════════════════════════════════════════════════════

export function readPrd() {
  const prd = readJson(FILES.prd);
  if (!prd) {
    console.error(`Error: prd.json not found at ${FILES.prd}`);
    process.exit(1);
  }
  return prd;
}

export function countRemaining(prd) {
  return prd.userStories.filter((s) => !s.passes).length;
}

export function getActiveStories(prd) {
  return prd.userStories.filter((s) => !s.passes);
}

/**
 * 加载 PRD + 注入运行时状态（如尝试次数、错误）供 Claude 使用。
 * 不会写回 prd.json——prd.json 只记录 passes 状态。
 */
export function loadPrdWithRuntime() {
  const prd = readJson(FILES.prd);
  const runtime = readJson(FILES.state) || {};
  const attempts = runtime.storyAttempts || {};

  return {
    ...prd,
    userStories: prd.userStories.map((story) => ({
      ...story,
      _runtime: {
        attempts: attempts[story.id]?.attempts || 0,
        lastError: attempts[story.id]?.lastError || null,
      },
    })),
    _engine: {
      iteration: runtime.iterations || 0,
      consecutiveNoProgress: runtime.consecutiveNoProgress || 0,
      currentFeature: runtime.feature || prd.feature,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// 错误检测（从 Claude 输出中分类）
// ═══════════════════════════════════════════════════════════════════

const FAILURE_PATTERNS = [
  { type: "vitest_fail",       pattern: /Tests?\s+.*failed|FAIL|×\s*.*test/i },
  { type: "pytest_fail",       pattern: /FAILED|failed\s+.*test|pytest.*error/i },
  { type: "lint_error",        pattern: /ESLint|lint.*error|error.*rule/i },
  { type: "typescript_error",  pattern: /TS\d+.*error|TypeScript\s+error/i },
  { type: "build_fail",        pattern: /Build\s+failed|build.*error|Error\s+compiling/i },
  { type: "git_error",         pattern: /fatal:|error:.*merge|could\s+not\s+apply/i },
];

export function detectFailures(output) {
  const failures = [];
  for (const { type, pattern } of FAILURE_PATTERNS) {
    if (pattern.test(output)) {
      failures.push(type);
    }
  }
  return failures;
}

export function extractErrorSummary(output) {
  const lines = output.split("\n");
  const errorLines = lines
    .filter((l) => /Error|error|FAIL|fail|warning|Warning/i.test(l))
    .slice(-10);
  return errorLines.join(" ").slice(0, 500);
}

// ═══════════════════════════════════════════════════════════════════
// 错误记录
// ═══════════════════════════════════════════════════════════════════

export function recordError(iteration, exitCode, output) {
  const failures = detectFailures(output);
  const summary = extractErrorSummary(output);

  const errorRecord = {
    iteration,
    exitCode,
    timestamp: new Date().toISOString(),
    detectedFailures: failures,
    summary,
  };

  writeJson(FILES.error, errorRecord);

  // 同步更新状态文件
  const state = readState();
  state.lastError = errorRecord;
  state.iterations = iteration;
  state.lastExitCode = exitCode;
  writeJson(FILES.state, state);

  return errorRecord;
}

// ═══════════════════════════════════════════════════════════════════
// 收敛检测
// ═══════════════════════════════════════════════════════════════════

/**
 * 检查是否连续 N 轮无进展
 * @returns {{ shouldStop: boolean, reason: string }}
 */
export function checkConvergence(maxFailures) {
  const state = readState();
  const noProgress = state.consecutiveNoProgress || 0;

  if (noProgress >= maxFailures) {
    return {
      shouldStop: true,
      reason: `${noProgress} consecutive iterations without progress (limit: ${maxFailures})`,
    };
  }
  return { shouldStop: false, reason: "" };
}

/**
 * 检查单个 story 的尝试次数是否超限
 * @returns {{ shouldStop: boolean, blockedStories: string[], allBlocked: boolean }}
 */
export function checkStoryLimits(prd, maxAttempts) {
  const state = readState();
  const attempts = state.storyAttempts || {};
  const active = getActiveStories(prd);
  const blocked = active.filter((s) => {
    const a = attempts[s.id]?.attempts || 0;
    return a >= maxAttempts;
  });

  const allBlocked = blocked.length > 0 && blocked.length === active.length;

  return {
    shouldStop: allBlocked,
    blockedStories: blocked.map((s) => s.id),
    activeStories: active.map((s) => s.id),
    allBlocked,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 进度追踪
// ═══════════════════════════════════════════════════════════════════

export function updateProgress(remainingBefore, remainingAfter) {
  const state = readState();

  if (remainingAfter < remainingBefore) {
    // 有进展，重置计数
    state.consecutiveNoProgress = 0;
    console.log(`Progress detected! Stories: ${remainingBefore} → ${remainingAfter}`);
  } else {
    state.consecutiveNoProgress = (state.consecutiveNoProgress || 0) + 1;
    console.log(
      `No progress. Consecutive: ${state.consecutiveNoProgress} / max`,
    );
  }
  writeJson(FILES.state, state);
  return state.consecutiveNoProgress;
}

export function incrementStoryAttempt(storyId) {
  const state = readState();
  if (!state.storyAttempts[storyId]) {
    state.storyAttempts[storyId] = { attempts: 0 };
  }
  state.storyAttempts[storyId].attempts++;
  writeJson(FILES.state, state);
  return state.storyAttempts[storyId].attempts;
}

// ═══════════════════════════════════════════════════════════════════
// Git HEAD 快照 — 用于区分"写了代码但没更新 passes"和"真卡死"
// ═══════════════════════════════════════════════════════════════════

export function recordGitHead() {
  try {
    const head = execSync("git rev-parse HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    updateState({ lastGitHead: head });
    return head;
  } catch {
    // 不在 git 仓库中，记录空字符串
    updateState({ lastGitHead: "" });
    return "";
  }
}

// ═══════════════════════════════════════════════════════════════════
// 下一个待执行 story 选择（考虑 dependsOn DAG）
// ═══════════════════════════════════════════════════════════════════

export function getNextStory(prd) {
  const active = getActiveStories(prd);
  if (active.length === 0) return { storyId: null, blocked: false, reason: "no-remaining" };

  const passedIds = new Set(
    prd.userStories.filter((s) => s.passes).map((s) => s.id)
  );

  // 筛选所有依赖已满足的 story
  const ready = active.filter((s) => {
    if (!s.dependsOn || s.dependsOn.length === 0) return true;
    return s.dependsOn.every((depId) => passedIds.has(depId));
  });

  if (ready.length === 0) {
    return {
      storyId: null,
      blocked: true,
      reason: `all-${active.length}-remaining-have-unsatisfied-deps`,
    };
  }

  // 按 priority 升序（priority 越小越优先），同 priority 按 id 排序（稳定）
  ready.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return { storyId: ready[0].id, blocked: false, reason: "ready" };
}

// ═══════════════════════════════════════════════════════════════════
// Git 进度交叉验证 — 区分"代码写了但 passes 没更新"和"真无进展"
// ═══════════════════════════════════════════════════════════════════

export function checkGitProgress() {
  const state = readState();
  const lastHead = state.lastGitHead || "";

  if (!lastHead) {
    // 未记录基线，无法判断
    return { hasGitProgress: false, reason: "no-baseline" };
  }

  try {
    const currentHead = execSync("git rev-parse HEAD", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    if (currentHead === lastHead) {
      return { hasGitProgress: false, reason: "head-unchanged" };
    }

    // HEAD 变了，检查是否有实质改动
    const diffStat = execSync(
      `git diff --stat ${lastHead}..${currentHead}`,
      { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 }
    ).trim();

    if (diffStat) {
      // 有实质代码改动 — 重置无进展计数器（代码写了对的，只是 passes 可能没更新）
      state.consecutiveNoProgress = 0;
      writeJson(FILES.state, state);
      return {
        hasGitProgress: true,
        reason: "code-changed-but-passes-may-be-stale",
        diffStat: diffStat.split("\n").slice(-3).join("; "),
      };
    }

    return { hasGitProgress: false, reason: "head-changed-no-diff" };
  } catch {
    return { hasGitProgress: false, reason: "git-error" };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 多 story 完成检测 — 防止模型一轮做多个 story 而不被发现
// ═══════════════════════════════════════════════════════════════════

export function detectMultiStory(remainingBefore, remainingAfter) {
  const completed = remainingBefore - remainingAfter;

  if (completed > 1) {
    const state = readState();
    state.multiStoryWarnings = (state.multiStoryWarnings || 0) + 1;
    writeJson(FILES.state, state);

    return {
      isMultiStory: true,
      completedCount: completed,
      totalWarnings: state.multiStoryWarnings,
      warning:
        `⚠️  单轮完成了 ${completed} 个 story！AGENT_PROMPT.md 要求每次只做 1 个。` +
        `累计警告 ${state.multiStoryWarnings} 次。` +
        `多 story 执行可能导致上下文压缩丢失细节。`,
    };
  }

  return { isMultiStory: false, completedCount: completed };
}

// ═══════════════════════════════════════════════════════════════════
// Guardian 确定性预检 — snapshot + validate（不费 token）
// ═══════════════════════════════════════════════════════════════════

/** 快照当前 prd.json 的 passes 状态到 state.passesSnapshot */
export function snapshotPasses() {
  const prd = readPrd();
  const passedIds = prd.userStories.filter((s) => s.passes).map((s) => s.id);
  updateState({ passesSnapshot: passedIds });
  return passedIds;
}

/**
 * 确定性验证（不需要 AI）：
 *   1. 检查单轮完成的 story 数 ≤ 1
 *   2. 检查是否有代码变更支撑 passes 变更
 *   3. 检查是否只改了测试文件没改实现
 *
 * @returns {{ valid: boolean, reason: string, details: object }}
 */
export function validateIteration() {
  const state = readState();
  const prd = readPrd();
  const snapshot = state.passesSnapshot || [];

  // 首轮迭代无基线 → 跳过验证
  if (snapshot.length === 0) {
    const nowPassed = prd.userStories.filter((s) => s.passes).map((s) => s.id);
    return { valid: true, reason: "first-run-no-baseline", newlyCompleted: nowPassed };
  }

  const nowPassed = new Set(prd.userStories.filter((s) => s.passes).map((s) => s.id));
  const newlyCompleted = [...nowPassed].filter((id) => !snapshot.includes(id));

  // ── 规则 1: 单轮不能完成超过 1 个 story ──
  if (newlyCompleted.length > 1) {
    return {
      valid: false,
      reason: `单轮完成 ${newlyCompleted.length} 个 story，超过上限 1。` +
        `已完成: ${newlyCompleted.join(", ")}。` +
        `只允许单轮完成恰好 1 个或 0 个 story。prd.json 将被回滚。`,
      rule: "max-one-story-per-iteration",
      newlyCompleted,
    };
  }

  // ── 规则 2: 如果有 newlyCompleted story，必须至少有 1 个代码文件变更 ──
  if (newlyCompleted.length === 1) {
    try {
      const lastHead = state.lastGitHead;
      // 如果有 lastGitHead 用精确 diff；否则用 HEAD~1 近似
      const diffRange = lastHead ? `${lastHead}..HEAD` : "HEAD~1";
      const diffFiles = execSync(
        `git diff --name-only ${diffRange}`,
        { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 }
      ).trim().split("\n").filter(Boolean);

      const codeFiles = diffFiles.filter((f) =>
        !f.startsWith("scripts/ralph/") &&
        !f.startsWith(".claude/") &&
        !f.startsWith(".superpowers/") &&
        !f.startsWith("data/") &&
        (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".py") ||
         f.endsWith(".js") || f.endsWith(".mjs") || f.endsWith(".css"))
      );

      if (codeFiles.length === 0) {
        return {
          valid: false,
          reason: `story ${newlyCompleted[0]} 标记为完成但没有任何代码文件变更。` +
            `prd.json 将被回滚。`,
          rule: "no-code-changes-for-completion",
          newlyCompleted,
          diffFiles,
        };
      }
    } catch {
      // git 不可用，跳过此检查
    }
  }

  // ── 规则 3: 检查测试文件是否被单独修改（无对应实现变更） ──
  try {
    const diffFiles = execSync(
      "git diff HEAD~1 --name-only",
      { cwd: PROJECT_ROOT, encoding: "utf-8", timeout: 5000 }
    ).trim().split("\n").filter(Boolean);

    const testPatterns = [/test.*\.(ts|tsx|py|js)$/, /\.(test|spec)\.(ts|tsx|py|js)$/];
    const testFiles = diffFiles.filter((f) =>
      testPatterns.some((p) => p.test(f))
    );
    const implFiles = diffFiles.filter((f) =>
      !testFiles.includes(f) &&
      !f.startsWith("scripts/ralph/") &&
      !f.startsWith(".claude/") &&
      !f.startsWith(".superpowers/") &&
      (f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".py") || f.endsWith(".js"))
    );

    if (testFiles.length > 0 && implFiles.length === 0) {
      return {
        valid: false,
        reason: `只修改了 ${testFiles.length} 个测试文件但没有对应的实现文件变更。这是绕过验证的危险信号。prd.json 将被回滚。`,
        rule: "test-files-only-no-impl",
        testFiles,
        implFiles,
      };
    }
  } catch {
    // git 不可用，跳过此检查
  }

  return { valid: true, reason: "all-checks-passed", newlyCompleted };
}

// ═══════════════════════════════════════════════════════════════════
// Git 变更检测
// ═══════════════════════════════════════════════════════════════════

export function recordChanges() {
  try {
    const changes = execSync("git diff --stat", {
      cwd: PROJECT_ROOT,
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    const lastFew = changes.split("\n").slice(-5).join(" ");
    updateState({ lastChanges: lastFew });
    return lastFew;
  } catch {
    updateState({ lastChanges: "no git changes" });
    return "no git changes";
  }
}

// ═══════════════════════════════════════════════════════════════════
// 分支归档
// ═══════════════════════════════════════════════════════════════════

export function archiveIfBranchChanged() {
  const prd = readJson(FILES.prd);
  const currentBranch = prd?.branchName || "";

  if (!existsSync(FILES.lastBranch)) {
    if (currentBranch) writeFileSync(FILES.lastBranch, currentBranch, "utf-8");
    return;
  }

  const lastBranch = readFileSync(FILES.lastBranch, "utf-8").trim();

  if (currentBranch && lastBranch && currentBranch !== lastBranch) {
    const date = new Date().toISOString().split("T")[0];
    const folderName = lastBranch.replace(/^ralph\//, "");
    const archiveFolder = join(FILES.archive, `${date}-${folderName}`);

    console.log(`Archiving previous run: ${lastBranch}`);
    mkdirSync(archiveFolder, { recursive: true });

    for (const f of [FILES.state, FILES.error, FILES.prd, FILES.progress]) {
      if (existsSync(f)) {
        cpSync(f, join(archiveFolder, basename(f)));
      }
    }
    console.log(`   Archived to: ${archiveFolder}`);
    appendFileSync(FILES.progress, `\n# Branch changed to ${currentBranch}\n`, "utf-8");
  }

  writeFileSync(FILES.lastBranch, currentBranch, "utf-8");
}

// ═══════════════════════════════════════════════════════════════════
// Prompt 生成
// ═══════════════════════════════════════════════════════════════════

export function buildEnhancedPrompt(iteration) {
  const prompt = readFileSync(FILES.prompt, "utf-8");
  const error = readJson(FILES.error);
  const state = readState();
  const noProgress = state.consecutiveNoProgress || 0;

  let enhanced = prompt + "\n\n---\n\n";
  enhanced += "## 上一轮运行状态（由 Ralph Core 自动注入）\n\n";
  enhanced += `- 迭代次数: ${iteration}\n`;
  enhanced += `- Feature: ${state.feature || "（未设置）"}\n`;
  enhanced += `- 连续无进展轮数: ${noProgress}\n`;

  if (error) {
    enhanced += "- 上一轮有错误，请先分析失败原因再行动。\n\n";
    enhanced += "```json\n" + JSON.stringify(error, null, 2) + "\n```\n";
  } else {
    enhanced += "- 上一轮无错误记录\n";
  }

  // 注入带运行时状态的 PRD 信息（仅给 Claude 参考，不写回文件）
  const prdRuntime = loadPrdWithRuntime();
  enhanced += "\n## 任务清单（含运行时状态）\n\n";
  enhanced += "```json\n" + JSON.stringify({
    feature: prdRuntime.feature,
    description: prdRuntime.description,
    branchName: prdRuntime.branchName,
    userStories: prdRuntime.userStories,
  }, null, 2) + "\n```\n";

  return enhanced;
}

// ═══════════════════════════════════════════════════════════════════
// 进度日志
// ═══════════════════════════════════════════════════════════════════

export function appendProgressLog(iteration, exitCode, remaining, output) {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const failures = detectFailures(output);

  let entry = `\n## [${now}] - Iteration ${iteration}\n\n`;
  entry += `- Exit code: ${exitCode}\n`;
  entry += `- Stories remaining: ${remaining}\n`;

  if (failures.length > 0) {
    entry += "- **Detected issues:**\n```\n" + failures.join("\n") + "\n```\n";
  }
  entry += "---\n";

  appendFileSync(FILES.progress, entry, "utf-8");
}

export function appendProgressMessage(message) {
  appendFileSync(FILES.progress, `\n${message}\n`, "utf-8");
}

// ═══════════════════════════════════════════════════════════════════
// 完成检测
// ═══════════════════════════════════════════════════════════════════

export function checkComplete(output) {
  return output.includes("<promise>COMPLETE</promise>");
}

// ═══════════════════════════════════════════════════════════════════
// 导出路径常量（供 Shell 包装使用）
// ═══════════════════════════════════════════════════════════════════

export { FILES, PROJECT_ROOT };

// ═══════════════════════════════════════════════════════════════════
// CLI 入口（被 Shell 包装通过 node ralph-core.mjs --xxx 调用）
// ═══════════════════════════════════════════════════════════════════

function cli() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case "--init":
      initState();
      break;

    case "--init-run":
      initRun();
      break;

    case "--remaining": {
      const prd = readPrd();
      console.log(countRemaining(prd));
      break;
    }

    case "--archive":
      archiveIfBranchChanged();
      break;

    case "--check-convergence": {
      const maxFail = parseInt(args[1] || "5", 10);
      const { shouldStop, reason } = checkConvergence(maxFail);
      if (shouldStop) {
        console.error(reason);
        process.exit(3);
      }
      break;
    }

    case "--check-limits": {
      const maxAttempts = parseInt(args[1] || "5", 10);
      const prd = readPrd();
      const { shouldStop, blockedStories } = checkStoryLimits(prd, maxAttempts);
      if (blockedStories.length > 0) {
        console.error(`Blocked stories: ${blockedStories.join(", ")}`);
      }
      if (shouldStop) {
        console.error(`All remaining stories exceeded max attempts (${maxAttempts}).`);
        process.exit(9);
      }
      break;
    }

    case "--increment-story-attempt": {
      const storyId = args[1];
      if (!storyId) {
        console.error("Usage: --increment-story-attempt <storyId>");
        process.exit(1);
      }
      const newCount = incrementStoryAttempt(storyId);
      console.log(newCount);
      break;
    }

    case "--record-git-head":
      recordGitHead();
      break;

    case "--get-next-story": {
      const prd = readPrd();
      const { storyId, blocked, reason } = getNextStory(prd);
      if (blocked) {
        console.log(`BLOCKED:${reason}`);
      } else if (!storyId) {
        console.log("NONE");
      } else {
        console.log(storyId);
      }
      break;
    }

    case "--snapshot-passes": {
      const ids = snapshotPasses();
      console.log(`Snapshotted passes: ${ids.length} stories (${ids.join(", ") || "none"})`);
      break;
    }

    case "--validate-iteration": {
      const result = validateIteration();
      if (result.valid) {
        console.log("ALLOW");
      } else {
        console.error("");
        console.error("┌─────────────────────────────────────────────────┐");
        console.error("│ ⛔ Guardian 验证失败                               │");
        console.error(`│ 规则: ${result.rule}`);
        console.error(`│ ${result.reason.substring(0, 60)}`);
        console.error("└─────────────────────────────────────────────────┘");
        console.error("");
        console.log(`DENY: ${result.reason}`);
      }
      break;
    }

    case "--check-git-progress": {
      const { hasGitProgress, reason, diffStat } = checkGitProgress();
      if (hasGitProgress) {
        console.error(
          `⚠️  Git 检测到代码改动但 passes 计数未变 — 自动重置无进展计数器。` +
          `改动: ${diffStat || reason}`
        );
      }
      // 始终 exit 0（这是信息性检查，不阻止迭代）
      break;
    }

    case "--detect-multi-story": {
      const before = parseInt(args[1] || "0", 10);
      const after = parseInt(args[2] || "0", 10);
      const { isMultiStory, completedCount, totalWarnings, warning } =
        detectMultiStory(before, after);
      if (isMultiStory) {
        console.error("");
        console.error("┌─────────────────────────────────────────────────┐");
        console.error(`│ ⚠️  多 Story 完成警告 (#${totalWarnings})                           │`);
        console.error(`│ 单轮完成 ${completedCount} 个 story（要求每次只做 1 个）              │`);
        console.error(`│ 累计警告: ${totalWarnings} 次                                     │`);
        console.error("│ 多 story 并发可能导致上下文压缩丢失细节              │");
        console.error("└─────────────────────────────────────────────────┘");
        console.error("");
      }
      // 输出计数供 shell 判断
      console.log(completedCount);
      break;
    }

    case "--build-prompt": {
      const iteration = parseInt(args[1] || "1", 10);
      process.stdout.write(buildEnhancedPrompt(iteration));
      break;
    }

    case "--record-error": {
      const iteration = parseInt(args[1] || "0", 10);
      const exitCode = parseInt(args[2] || "0", 10);
      // 输出可能很大，优先从 .last-raw-output.txt 读取
      const rawOutputFile = join(__dirname, ".last-raw-output.txt");
      let output = args[3] || "";
      if (!output && existsSync(rawOutputFile)) {
        output = readFileSync(rawOutputFile, "utf-8");
      }
      recordError(iteration, exitCode, output);
      break;
    }

    case "--update-progress": {
      const before = parseInt(args[1] || "0", 10);
      const after = parseInt(args[2] || "0", 10);
      updateProgress(before, after);
      break;
    }

    case "--record-changes":
      recordChanges();
      break;

    case "--mark-complete":
      updateState({ consecutiveNoProgress: 0 });
      appendProgressMessage("## ✅ ALL STORIES COMPLETE");
      break;

    case "--append-log": {
      const iteration = parseInt(args[1] || "0", 10);
      const exitCode = parseInt(args[2] || "0", 10);
      const remaining = parseInt(args[3] || "0", 10);
      // 同样从 .last-raw-output.txt 读取
      const rawOutputFile = join(__dirname, ".last-raw-output.txt");
      let output = args[4] || "";
      if (!output && existsSync(rawOutputFile)) {
        output = readFileSync(rawOutputFile, "utf-8");
      }
      appendProgressLog(iteration, exitCode, remaining, output);
      break;
    }

    default:
      if (cmd) {
        console.error(`Unknown command: ${cmd}`);
        process.exit(1);
      }
  }
}

// 只在直接运行时执行 CLI（兼容 Windows 路径差异）
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  cli();
}
