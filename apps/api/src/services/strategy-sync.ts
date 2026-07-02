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
    # 组件策略（选股器/择时器/仓位器）不实现 on_bar，不能独立回测
    backtestable = callable(getattr(instance, 'on_bar', None))
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
                'options': p.options,
                'chart_relevant': p.chart_relevant,
                'ui_constraints': [
                    {
                        'kind': c.kind,
                        'target_field': c.target_field,
                        'target_value': c.target_value,
                        'action_value': c.action_value,
                    }
                    for c in (p.ui_constraints or [])
                ] if p.ui_constraints else None,
            }
            for p in meta.params
        ],
        'version': meta.version,
        'modes': [m.value for m in meta.modes],
        'kind': meta.kind.value,
        'backtestable': backtestable,
        'category': meta.category.value if meta.category else 'non_factor',
        'subcategory': meta.subcategory.value if meta.subcategory else None,
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
        try {
          unlinkSync(tmpPath);
        } catch {
          /* ignore cleanup errors */
        }
      }
    }
  }

  clearCache(): void {
    this.cache = null;
    this.lastSync = 0;
  }
}

export const strategySyncService = new StrategySyncService();
