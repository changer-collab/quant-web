import { useMemo } from 'react';
import { useApi } from './useApi';
import { fetchStrategies, type ApiStrategy, type ApiStrategyParam } from '../api/strategies';
import type { StrategyRow, ResearchModeId, StrategyParam } from '../appData';

/** 将 API 策略参数映射为前端 StrategyParam */
function mapParam(api: ApiStrategyParam): StrategyParam {
  return {
    key: api.key,
    label: api.label,
    type: api.type as StrategyParam['type'],
    default: api.default,
    min: api.min,
    max: api.max,
    options: api.options,
  };
}

/** 将 API 策略映射为前端 StrategyRow */
function mapStrategy(api: ApiStrategy): StrategyRow {
  return {
    id: api.name,
    mode: 'traditional' as ResearchModeId,
    name: api.description || api.name,
    type: 'Trend',
    return: '—',
    drawdown: '—',
    sharpe: '—',
    status: 'stable',
    description: api.description,
    version: api.version,
    kind: api.kind,
    params: (api.params ?? []).map(mapParam),
  };
}

export function useStrategies() {
  const { data, loading, error, reload } = useApi<ApiStrategy[]>(fetchStrategies);

  const strategies = useMemo(() => (data ?? []).map(mapStrategy), [data]);

  return { strategies, loading, error, reload };
}
