/**
 * Python 子进程桥接器
 *
 * Worker 通过此模块调用 Python CLI，传入 JSON 配置，解析 JSON 输出。
 * 通信协议: stdin JSON → stdout JSON
 */

import { spawn } from "node:child_process";

export interface PythonBridgeConfig {
  /** Python 可执行文件路径，默认 "python" */
  pythonPath?: string;
  /** 超时毫秒数，默认 60000 */
  timeout?: number;
}

export interface PythonResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

export class PythonBridge {
  private readonly pythonPath: string;
  private readonly timeout: number;

  constructor(config?: PythonBridgeConfig) {
    this.pythonPath = config?.pythonPath ?? "python";
    this.timeout = config?.timeout ?? 60_000;
  }

  /**
   * 调用 Python CLI
   * @param request 传入的 JSON 对象
   * @returns Python 返回的 JSON 结果
   */
  async call(request: Record<string, unknown>): Promise<PythonResult> {
    const input = JSON.stringify(request);

    return new Promise<PythonResult>((resolve, reject) => {
      const proc = spawn(this.pythonPath, ["-m", "quantforge_strategy"], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
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
        try {
          const result = JSON.parse(stdout.trim()) as PythonResult;
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${stdout.trim()}`));
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
}
