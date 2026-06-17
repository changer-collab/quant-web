import { describe, it, expect } from 'vitest';
import { AdapterRegistryImpl } from '../src/registry/index.js';
import type { AdapterRegistry } from '../src/registry/types.js';
import { CsvAdapter } from '../src/adapters/csv-adapter.js';
import { TushareAdapter } from '../src/adapters/tushare-adapter.js';

describe('AdapterRegistry', () => {
  it('注册和查找适配器', () => {
    const registry: AdapterRegistry = new AdapterRegistryImpl();
    const csv = new CsvAdapter();
    registry.register(csv);

    const found = registry.get('csv');
    expect(found).toBe(csv);
  });

  it('按域和数据类型查找适配器', () => {
    const registry: AdapterRegistry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    registry.register(new TushareAdapter());

    const adapters = registry.findByDomainAndType('market', 'bar');
    expect(adapters.length).toBeGreaterThanOrEqual(2);
    const names = adapters.map((a) => a.name);
    expect(names).toContain('csv');
    expect(names).toContain('tushare');
  });

  it('查找不存在的适配器返回 undefined', () => {
    const registry: AdapterRegistry = new AdapterRegistryImpl();
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('列出所有已注册适配器', () => {
    const registry: AdapterRegistry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    registry.register(new TushareAdapter());

    const all = registry.list();
    expect(all).toHaveLength(2);
  });

  it('重复注册覆盖', () => {
    const registry: AdapterRegistry = new AdapterRegistryImpl();
    const csv1 = new CsvAdapter();
    const csv2 = new CsvAdapter();
    registry.register(csv1);
    registry.register(csv2);

    expect(registry.get('csv')).toBe(csv2);
    expect(registry.list()).toHaveLength(1);
  });
});
