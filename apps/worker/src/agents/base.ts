/**
 * Agent 包装层 — 统一的 Agent 执行接口
 *
 * 为现有 Handler 提供标准化的 Agent 调用协议，
 * 使 Loop Engine 能通过统一接口调度不同类型的子任务。
 */

/** Agent 类型 */
export type AgentType = 'backtest' | 'factor_eval' | 'factor_compute' | 'ai_train' | 'collect';

/** Agent 请求 */
export interface AgentRequest {
  agentType: AgentType;
  taskId: string;
  params: Record<string, unknown>;
  /** 可选：事件回调（用于流式输出） */
  onEvent?: (event: { event: string; [key: string]: unknown }) => void;
}

/** Agent 响应 */
export interface AgentResponse {
  success: boolean;
  taskId: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  /** 执行时长（毫秒） */
  durationMs?: number;
}

/** Agent 执行器接口 */
export interface AgentExecutor {
  /** Agent 类型 */
  readonly agentType: AgentType;

  /** 执行 Agent 任务 */
  execute(request: AgentRequest): Promise<AgentResponse>;
}
