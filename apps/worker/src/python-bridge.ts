/**
 * Python 子进程桥接器
 *
 * Worker 通过此模块调用 Python CLI，传入 JSON 配置，解析 JSON 输出。
 * 通信协议: stdin JSON → stdout NDJSON 事件流
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StreamEvent } from "./types.js";

export interface PythonBridgeConfig {
  /** Python 可执行文件路径，默认 "python" */
  pythonPath?: string;
  /** 超时毫秒数，默认 60000 */
  timeout?: number;
  /** Python 子进程工作目录，默认自动探测项目根目录 */
  cwd?: string;
}

export interface PythonResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

/**
 * 从当前工作目录向上查找项目根目录（以 pnpm-workspace.yaml 为标志）
 * 确保 Python 子进程的相对路径（如 data/quant.db）能正确解析
 */
function resolveProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break; // 到达根目录
    dir = parent;
  }
  return process.cwd();
}

export class PythonBridge {
  private readonly pythonPath: string;
  private readonly timeout: number;
  private readonly cwd: string;

  constructor(config?: PythonBridgeConfig) {
    this.pythonPath = config?.pythonPath ?? "python";
    this.timeout = config?.timeout ?? 60_000;
    this.cwd = config?.cwd ?? resolveProjectRoot();
  }

  /**
   * 调用 Python CLI（同步模式，等待进程结束返回结果）
   * @param request 传入的 JSON 对象
   * @returns Python 返回的 JSON 结果
   */
  async call(request: Record<string, unknown>): Promise<PythonResult> {
    const input = JSON.stringify(request);

    return new Promise<PythonResult>((resolve, reject) => {
      const proc = spawn(this.pythonPath, ["-m", "quantforge_strategy"], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: this.cwd,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
        },
      });
      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf-8");
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Python CLI timed out after ${this.timeout}ms`));
      }, this.timeout);

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`Python CLI exited with code ${code}: ${stderr.trim()}`));
          return;
        }
        // 解析 NDJSON 事件流，提取最终 result 或 error
        const result = this._parseFinalEvent(stdout.trim());
        resolve(result);
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.stdin.write(input);
      proc.stdin.end();
    });
  }

  /**
   * 流式调用 Python CLI
   * @param request 传入的 JSON 对象
   * @param onEvent 收到每个 NDJSON 事件时的回调
   * @returns 最终结果（result 或 error 事件中的数据）
   */
  async streamCall(
    request: Record<string, unknown>,
    onEvent: (event: StreamEvent) => void,
  ): Promise<PythonResult> {
    const input = JSON.stringify(request);

    return new Promise<PythonResult>((resolve, reject) => {
      const proc = spawn(this.pythonPath, ["-m", "quantforge_strategy"], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: this.cwd,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
        },
      });
      let buffer = "";
      let stderr = "";
      let finalResult: PythonResult | null = null;

      proc.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf-8");
        // 逐行解析 NDJSON
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留未完成的行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as StreamEvent;
            onEvent(event);

            // 捕获终态事件
            if (event.event === "result") {
              finalResult = { ok: true, data: event.data };
            } else if (event.event === "error") {
              finalResult = { ok: false, error: event.error };
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf-8");
      });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Python CLI timed out after ${this.timeout}ms`));
      }, this.timeout);

      proc.on("close", (code) => {
        clearTimeout(timer);

        // 处理 buffer 中剩余内容
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as StreamEvent;
            onEvent(event);
            if (event.event === "result") {
              finalResult = { ok: true, data: event.data };
            } else if (event.event === "error") {
              finalResult = { ok: false, error: event.error };
            }
          } catch {
            // 忽略
          }
        }

        if (finalResult) {
          resolve(finalResult);
        } else if (code !== 0) {
          reject(new Error(`Python CLI exited with code ${code}: ${stderr.trim()}`));
        } else {
          resolve({ ok: true });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.stdin.write(input);
      proc.stdin.end();
    });
  }

  /** 从 NDJSON 事件流中提取最终结果 */
  private _parseFinalEvent(stdout: string): PythonResult {
    const lines = stdout.split("\n").filter((l) => l.trim());
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const event = JSON.parse(lines[i].trim()) as StreamEvent;
        if (event.event === "result") {
          return { ok: true, data: event.data };
        }
        if (event.event === "error") {
          return { ok: false, error: event.error };
        }
      } catch {
        continue;
      }
    }
    // fallback: 尝试旧格式
    try {
      return JSON.parse(stdout) as PythonResult;
    } catch {
      return { ok: false, error: { code: "PARSE_ERROR", message: `Failed to parse Python output: ${stdout.substring(0, 200)}` } };
    }
  }
}
