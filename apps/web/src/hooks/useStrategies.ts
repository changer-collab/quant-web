import { useMemo } from 'react';
import { useApi } from './useApi';
import { fetchStrategies, type ApiStrategy } from '../api/strategies';
import type { StrategyRow, ResearchModeId } from '../appData';

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
  };
}

export function useStrategies() {
  const { data, loading, error, reload } = useApi<ApiStrategy[]>(fetchStrategies);

  const strategies = useMemo(() => (data ?? []).map(mapStrategy), [data]);

  return { strategies, loading, error, reload };
}
