import type { AdapterRegistry } from './types.js';
import type { DataSourceAdapter } from '../adapters/types.js';

export class AdapterRegistryImpl implements AdapterRegistry {
  private adapters = new Map<string, DataSourceAdapter>();

  register(adapter: DataSourceAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): DataSourceAdapter | undefined {
    return this.adapters.get(name);
  }

  findByDomainAndType(domain: string, dataType: string): DataSourceAdapter[] {
    return [...this.adapters.values()].filter(
      (a) => a.supportedDomains.includes(domain) && a.supportedDataTypes.includes(dataType),
    );
  }

  list(): DataSourceAdapter[] {
    return [...this.adapters.values()];
  }
}

export type { AdapterRegistry } from './types.js';
