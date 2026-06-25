#!/bin/bash
# Ralph v2 - 自治 AI Agent 循环脚本（改进版：结构化错误记录 + 跨迭代反馈）
# 参考: https://github.com/snarktank/ralph
# 用法: ./ralph-v2.sh [--tool claude] [max_iterations]
# 依赖: claude CLI, git, node
# 改进: 结构化错误记录、跨迭代错误反馈、状态文件传递、收敛检测
set -e

# === 参数解析 ===
TOOL="claude"
MAX_ITERATIONS=50
MAX_CONSECUTIVE_FAILURES=5
MAX_STORY_ATTEMPTS=5

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool) TOOL="$2"; shift 2 ;;
    --tool=*) TOOL="${1#*=}"; shift ;;
    --max-failures) MAX_CONSECUTIVE_FAILURES="$2"; shift 2 ;;
    --max-attempts) MAX_STORY_ATTEMPTS="$2"; shift 2 ;;
    *) if [[ "$1" =~ ^[0-9]+$ ]]; then MAX_ITERATIONS="$1"; fi; shift ;;
  esac
done

[ "$TOOL" == "claude" ] || { echo "Error: Invalid tool '$TOOL'. Must be 'claude'."; exit 1; }

# === 路径定义 ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
STATE_FILE="$SCRIPT_DIR/.prd.state.json"
ERROR_FILE="$SCRIPT_DIR/.last-error.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
PROMPT_FILE="$SCRIPT_DIR/AGENT_PROMPT.md"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# === 文件校验 ===
[ -f "$PRD_FILE" ] || { echo "Error: prd.json not found at $PRD_FILE"; exit 1; }
[ -f "$PROMPT_FILE" ] || { echo "Error: AGENT_PROMPT.md not found at $PROMPT_FILE"; exit 1; }

# === Node.js JSON 工具函数 ===
node_json() {
  node -e "const d=JSON.parse(require('fs').readFileSync('$2','utf8'));console.log($1)" 2>/dev/null || echo ""
}

node_json_raw() {
  node -e "const d=JSON.parse(require('fs').readFileSync('$2','utf8'));process.stdout.write(String($1))" 2>/dev/null || echo ""
}

# === 状态管理 ===

init_state() {
  if [ ! -f "$STATE_FILE" ]; then
    cat > "$STATE_FILE" << 'STATEEOF'
{
  "iterations": 0,
  "lastExitCode": 0,
  "lastError": null,
  "storyAttempts": {},
  "lastChanges": "",
  "consecutiveNoProgress": 0
}
STATEEOF
  fi
}

read_state() {
  node_json "d.$1" "$STATE_FILE"
}

read_state_raw() {
  node_json_raw "d.$1" "$STATE_FILE"
}

update_state() {
  local key="$1" value="$2"
  node -e "
    const fs=require('fs');
    const d=JSON.parse(fs.readFileSync('$STATE_FILE','utf8'));
    d.$key=$value;
    fs.writeFileSync('$STATE_FILE',JSON.stringify(d,null,2));
  " 2>/dev/null
}

# === 错误检测与记录 ===

# 从输出中检测具体的测试/lint/build 失败
detect_failures() {
  local output="$1"
  local failures=()

  # vitest / pnpm test 失败
  if echo "$output" | grep -qiE "Tests.*failed|FAIL|×.*test"; then
    failures+=("vitest_fail")
  fi
  # pytest 失败
  if echo "$output" | grep -qiE "FAILED|failed.*test|pytest.*error"; then
    failures+=("pytest_fail")
  fi
  # lint 错误
  if echo "$output" | grep -qiE "ESLint|lint.*error|error.*rule"; then
    failures+=("lint_error")
  fi
  # TypeScript 类型错误
  if echo "$output" | grep -qiE "TS[0-9]+.*error|TypeScript error"; then
    failures+=("typescript_error")
  fi
  # build 失败
  if echo "$output" | grep -qiE "Build failed|build.*error|Error compiling"; then
    failures+=("build_fail")
  fi
  # git 操作失败
  if echo "$output" | grep -qiE "fatal:|error:.*merge|could not apply"; then
    failures+=("git_error")
  fi

  printf '%s\n' "${failures[@]}" | grep -v '^$' || true
}

# 提取错误摘要（最后几行关键错误信息）
extract_error_summary() {
  local output="$1"
  echo "$output" | grep -iE "Error|error|FAIL|fail|warning|Warning" | tail -10 | head -200
}

# 记录结构化错误
record_error() {
  local iteration="$1" exit_code="$2" output="$3"

  local failures=()
  while IFS= read -r line; do
    [ -n "$line" ] && failures+=("\"$line\"")
  done < <(detect_failures "$output")

  local failure_json="[]"
  if [ ${#failures[@]} -gt 0 ]; then
    failure_json="[$(IFS=,; echo "${failures[*]}")]"
  fi

  local summary
  summary=$(extract_error_summary "$output" | tr '\n' ' ' | sed 's/"/\\"/g' | head -200)

  cat > "$ERROR_FILE" << ERREOF
{
  "iteration": $iteration,
  "exitCode": $exit_code,
  "timestamp": "$(date -Iseconds)",
  "detectedFailures": $failure_json,
  "summary": "$summary"
}
ERREOF

  # 更新状态文件
  update_state "lastError" "$(cat "$ERROR_FILE" | tr '\n' ' ')"
  update_state "iterations" "$iteration"
  update_state "lastExitCode" "$exit_code"
}

# === 分支归档 ===

archive_if_branch_changed() {
  local CURRENT_BRANCH
  CURRENT_BRANCH=$(node_json_raw "d.branchName||''" "$PRD_FILE" 2>/dev/null || echo "")

  if [ -f "$LAST_BRANCH_FILE" ]; then
    local LAST_BRANCH
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
      local DATE FOLDER_NAME ARCHIVE_FOLDER
      DATE=$(date +%Y-%m-%d)
      FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
      ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"
      echo "Archiving previous run: $LAST_BRANCH"
      mkdir -p "$ARCHIVE_FOLDER"
      [ -f "$STATE_FILE" ] && cp "$STATE_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$ERROR_FILE" ] && cp "$ERROR_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
      echo "   Archived to: $ARCHIVE_FOLDER"
      echo "" >> "$PROGRESS_FILE"
      echo "# Branch changed to $CURRENT_BRANCH" >> "$PROGRESS_FILE"
    fi
  fi

  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
}

# === 收敛检测 ===

check_convergence() {
  local no_progress
  no_progress=$(read_state "consecutiveNoProgress")
  no_progress=${no_progress:-0}

  if [ "$no_progress" -ge "$MAX_CONSECUTIVE_FAILURES" ]; then
    echo "ERROR: $no_progress consecutive iterations without progress. Exiting."
    echo "Ralph v2 stopped after $no_progress consecutive iterations without progress." >> "$PROGRESS_FILE"
    exit 3
  fi
}

# 检查单个 story 是否尝试次数超限
check_story_limits() {
  local story_attempts
  story_attempts=$(read_state_raw "storyAttempts")

  node -e "
    const prd=JSON.parse(require('fs').readFileSync('$PRD_FILE','utf8'));
    const state=JSON.parse('$story_attempts' || '{}');
    let blockedStories=[];
    for(const story of prd.userStories.filter(s=>!s.passes)) {
      const attempts=(state[story.id]&&state[story.id].attempts)||0;
      if(attempts>=$MAX_STORY_ATTEMPTS) blockedStories.push(story.id);
    }
    const active=prd.userStories.filter(s=>!s.passes);
    if(blockedStories.length>0 && blockedStories.length===active.length) {
      process.stderr.write('All remaining stories ('+active.map(s=>s.id).join(',')+') exceeded max attempts ('+MAX_STORY_ATTEMPTS+').\n');
      process.exit(1);
    }
    if(blockedStories.length>0) {
      process.stderr.write('Blocked stories: '+blockedStories.join(', ')+'. Skipping.\n');
    }
  " 2>&1 && return 0 || return $?
}

# 增量 git changes 检测
record_changes() {
  local changes
  changes=$(cd "$PROJECT_ROOT" && git diff --stat 2>/dev/null | tail -5 || echo "no git changes")
  update_state "lastChanges" "\"$(echo "$changes" | tr '\n' ' ' | sed 's/"/\\"/g')\""
}

# === 初始化 ===

init_state
REMAINING=$(node_json "d.userStories.filter(s=>!s.passes).length" "$PRD_FILE")
REMAINING=${REMAINING:-0}
[ "$REMAINING" -eq 0 ] && { echo "All stories are already complete! Nothing to do."; exit 0; }

archive_if_branch_changed

echo "Starting Ralph v2 - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo "Remaining stories: $REMAINING"
echo "Project root: $PROJECT_ROOT"

# === 主循环 ===

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph v2 Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  cd "$PROJECT_ROOT"

  # 1. 收敛检测
  check_convergence

  # 2. Story 尝试次数检测
  check_story_limits || true

  # 3. 读取上一轮状态
  LAST_ERROR=$(cat "$ERROR_FILE" 2>/dev/null || echo "null")
  STORY_ATTEMPTS=$(read_state_raw "storyAttempts" 2>/dev/null || echo "{}")
  CONSECUTIVE_NO_PROGRESS=$(read_state "consecutiveNoProgress")
  CONSECUTIVE_NO_PROGRESS=${CONSECUTIVE_NO_PROGRESS:-0}

  # 4. 构建增强 Prompt
  {
    cat "$PROMPT_FILE"
    echo ""
    echo "---"
    echo ""
    echo "## 上一轮运行状态（由 Ralph v2 自动注入，供你参考）"
    echo ""
    echo "- 迭代次数: $i"
    echo "- 连续无进展轮数: $CONSECUTIVE_NO_PROGRESS"
    if [ "$LAST_ERROR" != "null" ]; then
      echo "- 上一轮有错误，请先读取 \`.last-error.json\` 了解失败原因，再开始实现。"
      echo ""
      echo "\`\`\`json"
      echo "$LAST_ERROR" | python -m json.tool 2>/dev/null || echo "$LAST_ERROR"
      echo "\`\`\`"
    else
      echo "- 上一轮无错误记录"
    fi
  } | claude --dangerously-skip-permissions --print 2>&1 | tee "$SCRIPT_DIR/.last-output.txt" || true

  # 获取 claude 的退出码
  claude_exit=${PIPESTATUS[0]:-0}
  OUTPUT=$(cat "$SCRIPT_DIR/.last-output.txt" 2>/dev/null || echo "")

  # 5. 结构化错误记录
  record_error "$i" "$claude_exit" "$OUTPUT"

  # 6. 检查完成信号
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    echo "Ralph v2 completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    update_state "consecutiveNoProgress" 0
    echo "## [$(date '+%Y-%m-%d %H:%M:%S')] - ✅ ALL STORIES COMPLETE" >> "$PROGRESS_FILE"
    exit 0
  fi

  # 7. 检测进展
  REMAINING_NOW=$(node_json "d.userStories.filter(s=>!s.passes).length" "$PRD_FILE")
  REMAINING_NOW=${REMAINING_NOW:-0}

  if [ "$REMAINING_NOW" -lt "$REMAINING" ]; then
    echo "Progress detected! Stories remaining: $REMAINING → $REMAINING_NOW"
    update_state "consecutiveNoProgress" 0
  else
    CONSECUTIVE_NO_PROGRESS=$((CONSECUTIVE_NO_PROGRESS + 1))
    update_state "consecutiveNoProgress" "$CONSECUTIVE_NO_PROGRESS"
    echo "No progress this iteration. Consecutive: $CONSECUTIVE_NO_PROGRESS / $MAX_CONSECUTIVE_FAILURES"
  fi
  REMAINING=$REMAINING_NOW

  # 8. 记录 git 变更
  record_changes

  # 9. 写入进度日志
  {
    echo ""
    echo "## [$(date '+%Y-%m-%d %H:%M:%S')] - Iteration $i"
    echo ""
    echo "- Exit code: $claude_exit"
    echo "- Stories remaining: $REMAINING"

    # 记录检测到的失败类型
    local_detected=$(detect_failures "$OUTPUT")
    if [ -n "$local_detected" ]; then
      echo "- **Detected issues:**"
      echo "\`\`\`"
      echo "$local_detected"
      echo "\`\`\`"
    fi
    echo "---"
  } >> "$PROGRESS_FILE"

  sleep 2
done

echo ""
echo "Ralph v2 reached max iterations ($MAX_ITERATIONS) without completing all stories."
echo "Check $PROGRESS_FILE and $ERROR_FILE for details."
exit 1
