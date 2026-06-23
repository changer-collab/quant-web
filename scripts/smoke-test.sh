#!/usr/bin/env bash
#
# API 冒烟测试 — 启动 API server，验证核心端点返回 200，关闭 server。
#
# 前置条件：pnpm build 已完成（apps/api/dist/index.js 存在）。
#
set -euo pipefail

API_PORT=3002
API_URL="http://localhost:${API_PORT}"
API_PID=""

cleanup() {
  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 启动 API server（使用 tsx 直接运行 TypeScript，与 dev 模式一致）
echo "Starting API server..."
npx tsx apps/api/src/index.ts &
API_PID=$!

# 等待 server 就绪（最多 30 秒）
echo "Waiting for API server to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${API_URL}/api/strategies" > /dev/null 2>&1; then
    echo "API server is ready (after ${i}s)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: API server did not start within 30 seconds"
    exit 1
  fi
  sleep 1
done

# 验证核心端点
test_endpoint() {
  local path="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${path}" || true)
  if [ "$status" = "200" ]; then
    echo "  OK   ${path} → ${status}"
  else
    echo "  FAIL ${path} → ${status}"
    exit 1
  fi
}

echo "Testing core endpoints:"
test_endpoint "/api/strategies"
test_endpoint "/api/reports"
test_endpoint "/api/reports/count"

echo "All smoke tests passed!"
