import { describe, it, expect } from 'vitest';

describe('factor-lab', () => {
  it('should be importable', async () => {
    const mod = await import('../src/index');
    expect(mod).toBeDefined();
  });

  it('should export FactorEvalTab', async () => {
    const { FactorEvalTab } = await import('../src/index');
    expect(FactorEvalTab).toBeDefined();
  });

  it('should export FactorStatus', async () => {
    const { FactorStatus } = await import('../src/index');
    expect(FactorStatus).toBeDefined();
  });
});