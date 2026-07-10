import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PythonStrategyMeta {
  name: string;
  description: string;
  params: Array<{
    key: string;
    label: string;
    type: string;
    default: number | string | boolean;
    min?: number;
    max?: number;
    options?: string[] | null;
    chart_relevant?: boolean;
    ui_constraints?: Array<{
      kind: string;
      target_field: string;
      target_value: unknown;
      action_value?: unknown;
    }>;
  }>;
  version: string;
  modes: string[];
  kind: string;
  /** 是否可独立回测（组件策略如选股器/择时器/仓位器不实现 on_bar，不可独立回测） */
  backtestable: boolean;
  /** 策略分类（默认 non_factor，向后兼容） */
  category?: string;
  /** 策略子分类（null 表示未分类） */
  subcategory?: string | null;
}

export interface PythonModelMeta {
  id: string;
  algorithm: string;
  trainedAt: number;
  metrics: Record<string, unknown>;
  path: string;
}

interface CLIResult {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

/**
 * 从当前目录向上查找项目根目录（以 pnpm-workspace.yaml 为标志）
 */
function resolveProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(__dirname, '../../..');
}

/**
 * 解析 NDJSON 事件流，提取最终 result 或 error 事件
 */
function parseCLIOutput(stdout: string): CLIResult {
  const lines = stdout.split('\n').filter((l) => l.trim());
  // 从后往前找 result/error 事件（最后一个 result 为终态）
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const event = JSON.parse(lines[i].trim());
      if (event.event === 'result') return { ok: true, data: event.data };
      if (event.event === 'error')
        return { ok: false, error: event.error ?? { code: 'CLI_ERROR', message: 'Unknown CLI error' } };
    } catch {
      continue;
    }
  }
  return {
    ok: false,
    error: { code: 'PARSE_ERROR', message: `Failed to parse Python CLI output: ${stdout.substring(0, 200)}` },
  };
}

/**
 * 将 CLI listStrategies 的 camelCase 输出映射回内部的 PythonStrategyMeta（snake_case）
 *
 * CLI 输出（camelCase）：
 *   { name, category, subcategory, version, description, workflowReady, backtestable,
 *     params: [{ name, range: [min, max], chartRelevant, uiConstraints: [{targetField, targetValue, actionValue}] }] }
 *
 * 内部接口（PythonStrategyMeta，snake_case）：
 *   { name, description, params: [{ key, label, type, default, min, max, options, chart_relevant, ui_constraints }] }
 */
function camelToSnakeMeta(camel: Record<string, unknown>): PythonStrategyMeta {
  const rawParams = (camel.params as Array<Record<string, unknown>>) ?? [];
  return {
    name: (camel.name as string) ?? '',
    description: (camel.description as string) ?? '',
    params: rawParams.map((p) => {
      const range = (p.range as [number, number]) ?? [0, 0];
      const uics = (p.uiConstraints as Array<Record<string, unknown>>) ?? [];
      return {
        key: (p.name as string) ?? '',
        label: (p.label as string) ?? (p.name as string) ?? '', // CLI 输出 label，缺省回退 name（向后兼容）
        type: (p.type as string) ?? 'number', // CLI 输出 type，缺省回退 'number'
        default: (p.default as number | string | boolean | null | undefined) ?? 0, // CLI 输出 default，缺省回退 0
        min: range[0] ?? 0,
        max: range[1] ?? 0,
        options: p.options !== undefined ? (p.options as string[] | null) : undefined,
        chart_relevant: (p.chartRelevant as boolean) ?? false,
        ui_constraints: uics.map((c) => ({
          kind: (c.kind as string) ?? '',
          target_field: (c.targetField as string) ?? '',
          target_value: c.targetValue,
          action_value: c.actionValue,
        })),
      };
    }),
    version: (camel.version as string) ?? '0.0.0',
    modes: [],
    kind: 'combined',
    backtestable: (camel.backtestable as boolean) ?? false,
    category: (camel.category as string) ?? 'non_factor',
    subcategory: (camel.subcategory as string) ?? null,
  };
}

class StrategySyncService {
  private cache: PythonStrategyMeta[] | null = null;
  private lastSync: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 分钟缓存

  async syncFromPython(): Promise<PythonStrategyMeta[]> {
    const now = Date.now();
    if (this.cache && now - this.lastSync < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      const result = await this._callCLI({ command: 'listStrategies' });

      if (result.ok && Array.isArray(result.data)) {
        const strategies = (result.data as Array<Record<string, unknown>>).map(camelToSnakeMeta);
        this.cache = strategies;
        this.lastSync = now;
        return strategies;
      }

      console.warn('Strategy sync: CLI returned error:', result.error?.message ?? 'unknown error');
      return this.cache ?? [];
    } catch (err) {
      console.warn('Strategy sync: CLI unavailable:', (err as Error)?.message ?? String(err));
      return this.cache ?? [];
    }
  }

  /**
   * 调用 Python CLI（spawn + stdin JSON + NDJSON stdout）
   * 等效于 Worker 的 PythonBridge.call()
   */
  private async _callCLI(request: Record<string, unknown>): Promise<CLIResult> {
    return new Promise<CLIResult>((resolve, reject) => {
      const proc = spawn(process.env.PYTHON_PATH ?? 'python', ['-m', 'quantforge_strategy'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: resolveProjectRoot(),
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
        },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Python CLI timed out after 30000ms`));
      }, 30_000);

      proc.on('close', (code) => {
        clearTimeout(timer);

        if (code !== 0 && !stdout.trim()) {
          reject(new Error(`Python CLI exited with code ${code}: ${stderr.trim()}`));
          return;
        }

        resolve(parseCLIOutput(stdout));
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      // 写入请求 JSON 到 stdin
      proc.stdin.on('error', () => {
        // Python 进程已退出,EPIPE 静默吞掉,close 事件会处理
      });
      proc.stdin.write(JSON.stringify(request));
      proc.stdin.end();
    });
  }

  /**
   * 列出已注册的模型（无缓存，每次调用都查最新状态）
   */
  async listModels(): Promise<PythonModelMeta[]> {
    try {
      const result = await this._callCLI({ command: 'listModels' });
      if (result.ok && Array.isArray(result.data)) {
        return result.data as PythonModelMeta[];
      }
      console.warn('List models: CLI returned error:', result.error?.message ?? 'unknown error');
      return [];
    } catch (err) {
      console.warn('List models: CLI unavailable:', (err as Error)?.message ?? String(err));
      return [];
    }
  }

  clearCache(): void {
    this.cache = null;
    this.lastSync = 0;
  }
}

export const strategySyncService = new StrategySyncService();

// 用于测试
export { parseCLIOutput, camelToSnakeMeta };
