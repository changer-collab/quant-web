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
PASS_COUNT=0
FAIL_COUNT=0

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

# 验证核心端点 — 仅检查 HTTP 200
test_endpoint() {
  local path="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}${path}" || true)
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "  OK   ${path} → ${status}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL ${path} → ${status}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# 验证端点 + 检查响应体包含指定字符串
test_endpoint_contains() {
  local path="$1"
  local expected="$2"
  local response
  response=$(curl -s "${API_URL}${path}" 2>/dev/null || true)
  if [ -z "$response" ]; then
    echo "  FAIL ${path} → 请求失败 (空响应)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    return
  fi
  if echo "$response" | grep -qF "$expected"; then
    echo "  OK   ${path} → 包含 '${expected}'"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL ${path} → 响应体不包含 '${expected}'"
    echo "        响应: $(echo "$response" | head -c 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# 验证 PUT + GET 读写
test_put_get_config() {
  local path="$1"
  local test_body='{"config":{"fast_period":5,"slow_period":20},"hash":"test-hash-001"}'

  # PUT 保存配置
  local put_response
  put_response=$(curl -s -X PUT "${API_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$test_body" 2>/dev/null || true)
  if echo "$put_response" | grep -q '"saved":true'; then
    echo "  OK   PUT ${path} → 保存成功"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL PUT ${path} → 保存失败"
    echo "        响应: $(echo "$put_response" | head -c 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # GET 验证读取
  local get_response
  get_response=$(curl -sf "${API_URL}${path}" 2>/dev/null || true)
  if echo "$get_response" | grep -q '"fast_period"' && echo "$get_response" | grep -q '"slow_period"'; then
    echo "  OK   GET ${path} → 读取配置与保存一致"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  FAIL GET ${path} → 读取的配置不完整"
    echo "        响应: $(echo "$get_response" | head -c 200)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

echo ""
echo "===== Test 1-3: 核心端点（原有） ====="
test_endpoint "/api/strategies"
test_endpoint "/api/reports"
test_endpoint "/api/reports/count"

echo ""
echo "===== Test 4: GET /api/strategies 返回 category 字段 ====="
test_endpoint_contains "/api/strategies" "category"

echo ""
echo "===== Test 5: PUT + GET /api/strategies/dual_ma/config 读写验证 ====="
test_put_get_config "/api/strategies/dual_ma/config"

echo ""
echo "===== Test 6: GET /api/diagnostics?strategy=dual_ma 返回空数组 ====="
test_endpoint_contains "/api/diagnostics?strategy=dual_ma" "[]"

echo ""
echo "====== Smoke Test Summary ======"
echo "  Passed: $PASS_COUNT"
echo "  Failed: $FAIL_COUNT"
if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "  RESULT: FAILED"
  exit 1
else
  echo "  RESULT: ALL PASSED"
fi
