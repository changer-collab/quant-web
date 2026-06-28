/**
 * Agent 包装层 — 统一导出
 */

export type { AgentExecutor, AgentRequest, AgentResponse, AgentType } from './base.js';
export { PythonAgent } from './python-agent.js';
export { BacktestAgent } from './backtest-agent.js';

import type { PythonBridge } from '../python-bridge.js';
import type { AgentExecutor } from './base.js';
import { PythonAgent } from './python-agent.js';
import { BacktestAgent } from './backtest-agent.js';

/** 创建回测 Agent（带参数转换） */
export function createBacktestAgent(bridge: PythonBridge): AgentExecutor {
  const pythonAgent = new PythonAgent(bridge);
  return new BacktestAgent(pythonAgent);
}

/** 创建通用 Python Agent（直接调用 Python CLI） */
export function createPythonAgent(bridge: PythonBridge): AgentExecutor {
  return new PythonAgent(bridge);
}
