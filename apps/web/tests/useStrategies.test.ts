import { describe, it, expect } from 'vitest';
import type { ApiStrategyParam } from '../src/api/strategies';

// 直接测 mapParam 逻辑（若未导出，可复制实现或导出后测）
describe('mapParam UIConstraint 映射', () => {
  it('snake_case ui_constraints 转 camelCase uiConstraints', async () => {
    const api: ApiStrategyParam = {
      key: 'period',
      label: '周期',
      type: 'int',
      default: 20,
      chart_relevant: false,
      ui_constraints: [
        {
          kind: 'disable_when',
          target_field: 'mode',
          target_value: 'advanced',
          action_value: true,
        },
      ],
    };
    // 调用 mapParam（若未导出，需先 export）
    // 假设 mapParam 已从 useStrategies.ts 导出
    const { mapParam } = await import('../src/hooks/useStrategies');
    const result = mapParam(api);
    expect(result.uiConstraints).toBeDefined();
    expect(result.uiConstraints![0].targetField).toBe('mode');
    expect(result.uiConstraints![0].targetValue).toBe('advanced');
    expect(result.uiConstraints![0].actionValue).toBe(true);
  });
});
