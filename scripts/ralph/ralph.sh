#!/bin/bash
# Ralph - 自治 AI Agent 循环脚本（Bash 包装层）
# 核心逻辑在 ralph-core.mjs 中实现
# 用法: ./ralph.sh [--tool claude] [max_iterations]
# 依赖: claude CLI, git, node
set -e

# 参数解析
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CORE="node $SCRIPT_DIR/ralph-core.mjs"

# 初始化
$CORE --init 2>/dev/null || true
$CORE --init-run 2>/dev/null || true
REMAINING=$($CORE --remaining 2>/dev/null || echo 0)
[ "$REMAINING" -eq 0 ] && { echo "All stories complete!"; exit 0; }
$CORE --archive 2>/dev/null || true

echo "Starting Ralph (Bash) - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo "Remaining stories: $REMAINING"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  cd "$PROJECT_ROOT"

  # 收敛检测
  $CORE --check-convergence "$MAX_CONSECUTIVE_FAILURES" 2>&1 || { [ $? -eq 3 ] && exit 3; true; }

  # Story 尝试次数检测
  $CORE --check-limits "$MAX_STORY_ATTEMPTS" 2>&1 || { [ $? -eq 9 ] && exit 9; true; }

  # 记录本轮开始前的 git HEAD（用于事后交叉验证）
  $CORE --record-git-head 2>/dev/null || true

  # 快照 prd.json passes 状态（用于 Guardian 验证单轮完成数）
  $CORE --snapshot-passes 2>/dev/null || true

  # 获取下一个应执行的 story 并递增其尝试计数
  NEXT_STORY=$($CORE --get-next-story 2>/dev/null || echo "NONE")
  echo "  → Next story: $NEXT_STORY"
  if [ "$NEXT_STORY" != "NONE" ] && [ "${NEXT_STORY#BLOCKED:}" = "$NEXT_STORY" ]; then
    ATTEMPT_NUM=$($CORE --increment-story-attempt "$NEXT_STORY" 2>/dev/null || echo "?")
    echo "  → Attempt #$ATTEMPT_NUM for $NEXT_STORY"
  fi

  # 执行 claude CLI
  ENHANCED_PROMPT=$($CORE --build-prompt "$i" 2>/dev/null)
  PRE_ITERATION_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
  OUTPUT=$(echo "$ENHANCED_PROMPT" | claude --dangerously-skip-permissions --print 2>&1) || true
  CLAUDE_EXIT=$?

  # 持久化输出到文件（防止命令行参数过长）
  echo "$OUTPUT" > "$SCRIPT_DIR/.last-raw-output.txt"

  # 记录错误（不传 output 参数，让 core 从文件读取）
  $CORE --record-error "$i" "$CLAUDE_EXIT" 2>/dev/null || true

  # Guardian 验证（在更新进度之前——防止假完成）
  VALIDATION=$($CORE --validate-iteration 2>/dev/null || echo "ALLOW")
  if echo "$VALIDATION" | grep -q "^DENY:"; then
    echo ""
    echo "⛔ GUARDIAN REJECTED: $(echo "$VALIDATION" | sed 's/^DENY: //')"
    if [ -n "$PRE_ITERATION_HEAD" ]; then
      echo "   → 硬重置到迭代前 $(echo "$PRE_ITERATION_HEAD" | cut -c1-7)"
      git reset --hard "$PRE_ITERATION_HEAD" 2>/dev/null || true
      git clean -fd -- "$SCRIPT_DIR/" 2>/dev/null || true
    else
      echo "   → 回滚 prd.json 到迭代前状态"
      git checkout -- "$SCRIPT_DIR/prd.json" 2>/dev/null || true
    fi
    REMAINING_NOW=$($CORE --remaining 2>/dev/null || echo "$REMAINING")
  else
    REMAINING_NOW=$($CORE --remaining 2>/dev/null || echo 0)
  fi

  # 完成信号
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""; echo "Ralph completed all tasks at iteration $i!"
    $CORE --mark-complete 2>/dev/null || true
    exit 0
  fi

  # 检测进展
  $CORE --update-progress "$REMAINING" "$REMAINING_NOW" 2>/dev/null || true

  # Git 进度交叉验证（代码改了但 passes 没更新 → 自动纠正）
  $CORE --check-git-progress 2>/dev/null || true

  # 多 story 完成检测（一轮完成 >1 个 → 醒目告警）
  COMPLETED_COUNT=$($CORE --detect-multi-story "$REMAINING" "$REMAINING_NOW" 2>/dev/null || echo "0")
  if [ "$COMPLETED_COUNT" -gt 1 ] 2>/dev/null; then
    echo "⚠️  单轮完成 $COMPLETED_COUNT 个 story（预期每次 1 个），请检查上下文是否压缩丢失细节。"
  fi

  REMAINING=$REMAINING_NOW

  # 记录变更和日志
  $CORE --record-changes 2>/dev/null || true
  $CORE --append-log "$i" "$CLAUDE_EXIT" "$REMAINING" "$OUTPUT" 2>/dev/null || true

  sleep 2
done

echo "Ralph reached max iterations ($MAX_ITERATIONS)."
exit 1
