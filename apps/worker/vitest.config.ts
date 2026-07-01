import { defineConfig } from 'vitest/config';

// e2e-pipeline 测试通过 PythonBridge 拉起真实 Python 子进程跑回测，bridge 本身
// 配置了 60s 预算；vitest 默认单测 5s 超时在 turbo 并发跑 10 个包时会因子进程
// CPU 抢占而误杀这些 e2e 用例。testTimeout 对齐 bridge 预算，消除并发假失败。
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60_000 },
});
