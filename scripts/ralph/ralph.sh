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

  # 获取下一个应执行的 story 并递增其尝试计数
  NEXT_STORY=$($CORE --get-next-story 2>/dev/null || echo "NONE")
  echo "  → Next story: $NEXT_STORY"
  if [ "$NEXT_STORY" != "NONE" ] && [ "${NEXT_STORY#BLOCKED:}" = "$NEXT_STORY" ]; then
    ATTEMPT_NUM=$($CORE --increment-story-attempt "$NEXT_STORY" 2>/dev/null || echo "?")
    echo "  → Attempt #$ATTEMPT_NUM for $NEXT_STORY"
  fi

  # 执行 claude CLI
  ENHANCED_PROMPT=$($CORE --build-prompt "$i" 2>/dev/null)
  OUTPUT=$(echo "$ENHANCED_PROMPT" | claude --dangerously-skip-permissions --print 2>&1) || true
  CLAUDE_EXIT=$?

  # 持久化输出到文件（防止命令行参数过长）
  echo "$OUTPUT" > "$SCRIPT_DIR/.last-raw-output.txt"

  # 记录错误（不传 output 参数，让 core 从文件读取）
  $CORE --record-error "$i" "$CLAUDE_EXIT" 2>/dev/null || true

  # 完成信号
  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""; echo "Ralph completed all tasks at iteration $i!"
    $CORE --mark-complete 2>/dev/null || true
    exit 0
  fi

  # 检测进展
  REMAINING_NOW=$($CORE --remaining 2>/dev/null || echo 0)
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
