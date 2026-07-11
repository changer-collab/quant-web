import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface GitCollectorApi {
  getCursor(source: string): Promise<string | undefined>;
  saveCursor(source: string, lastValue: string): Promise<void>;
  ingestEvent(event: {
    eventType: 'git_commit';
    dedupeKey: string;
    payload: Record<string, unknown>;
    occurredAt: number;
  }): Promise<void>;
}

export type GitCommandRunner = (args: string[], cwd: string) => Promise<string>;

export interface GitCollectorOptions {
  api: GitCollectorApi;
  cwd: string;
  source?: string;
  runGit?: GitCommandRunner;
}

export interface GitScanResult {
  baseline: boolean;
  collected: number;
}

const execFileAsync = promisify(execFile);

async function defaultRunGit(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout;
}

/** 仅当提交只修改一个 combined 策略文件时自动归类，其余进入待归类。 */
export function inferStrategyFromFiles(files: string[]): string | undefined {
  const strategies = new Set<string>();
  for (const file of files) {
    const match = /^packages\/strategies\/quantforge_strategies\/combined\/([^/]+)\.py$/u.exec(
      file.replace(/\\/g, '/')
    );
    if (match?.[1]) strategies.add(match[1]);
  }
  return strategies.size === 1 ? [...strategies][0] : undefined;
}

export class GitCollector {
  private readonly source: string;
  private readonly runGit: GitCommandRunner;

  constructor(private readonly options: GitCollectorOptions) {
    this.source = options.source ?? 'git';
    this.runGit = options.runGit ?? defaultRunGit;
  }

  async scan(): Promise<GitScanResult> {
    const head = (await this.runGit(['rev-parse', 'HEAD'], this.options.cwd)).trim();
    if (!head) throw new Error('无法读取当前 Git HEAD');

    const cursor = await this.options.api.getCursor(this.source);
    if (!cursor) {
      await this.options.api.saveCursor(this.source, head);
      return { baseline: true, collected: 0 };
    }
    if (cursor === head) return { baseline: false, collected: 0 };

    let hashes: string[];
    try {
      hashes = (await this.runGit(['rev-list', '--reverse', `${cursor}..${head}`], this.options.cwd))
        .split(/\r?\n/u)
        .map((hash) => hash.trim())
        .filter(Boolean);
    } catch (error) {
      throw new Error(
        `Git 扫描游标 ${cursor} 不可用，请人工处理后再继续：${error instanceof Error ? error.message : String(error)}`
      );
    }

    for (const hash of hashes) {
      const metadata = await this.runGit(['show', '-s', '--format=%s%x1f%ct', hash], this.options.cwd);
      const [message = '', seconds = '0'] = metadata.trim().split('\x1f');
      const files = (await this.runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', hash], this.options.cwd))
        .split(/\r?\n/u)
        .map((file) => file.trim())
        .filter(Boolean);
      const strategy = inferStrategyFromFiles(files);
      await this.options.api.ingestEvent({
        eventType: 'git_commit',
        dedupeKey: `git:${hash}`,
        payload: {
          commitHash: hash,
          message,
          files,
          ...(strategy ? { strategy } : {}),
        },
        occurredAt: Number(seconds) * 1000,
      });
      await this.options.api.saveCursor(this.source, hash);
    }
    return { baseline: false, collected: hashes.length };
  }
}
