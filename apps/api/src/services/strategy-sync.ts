import { exec } from 'child_process';
import { promisify } from 'util';
import { resolve, dirname } from 'path';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);

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
    options?: string[];
  }>;
  version: string;
  modes: string[];
  kind: string;
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

    const projectRoot = resolve(__dirname, '../../../..');
    const script = `
import json, sys
sys.path.insert(0, r'${projectRoot}\\packages\\strategies')
from quantforge_strategies import list_all

strategies = []
for name, cls in list_all().items():
    instance = cls()
    meta = instance.meta
    strategies.append({
        'name': meta.name,
        'description': meta.description,
        'params': [
            {
                'key': p.key,
                'label': p.label,
                'type': p.type.value,
                'default': p.default,
                'min': p.min,
                'max': p.max,
                'options': p.options
            }
            for p in meta.params
        ],
        'version': meta.version,
        'modes': [m.value for m in meta.modes],
        'kind': meta.kind.value
    })

print(json.dumps(strategies))
`;

    let tmpPath = '';
    try {
      // 写入临时文件，避免 shell 转义问题
      tmpPath = resolve(tmpdir(), `quantforge-strategy-sync-${Date.now()}.py`);
      writeFileSync(tmpPath, script, 'utf-8');

      const { stdout, stderr } = await execAsync(`python "${tmpPath}"`, {
        cwd: projectRoot,
        timeout: 30_000,
      });

      if (stderr) {
        console.warn('Strategy sync stderr:', stderr);
      }

      const strategies = JSON.parse(stdout.trim()) as PythonStrategyMeta[];
      this.cache = strategies;
      this.lastSync = now;
      return strategies;
    } catch (error) {
      console.error('Failed to sync strategies from Python:', error);
      return this.cache ?? [];
    } finally {
      if (tmpPath) {
        try { unlinkSync(tmpPath); } catch { /* ignore cleanup errors */ }
      }
    }
  }

  clearCache(): void {
    this.cache = null;
    this.lastSync = 0;
  }
}

export const strategySyncService = new StrategySyncService();
