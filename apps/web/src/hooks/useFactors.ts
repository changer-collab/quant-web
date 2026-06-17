import { useMemo } from 'react';
import { useApi } from './useApi';
import { fetchFactors, type ApiFactor } from '../api/factors';
import type { FactorDisplayRow } from '../appData';
import { FactorStatus } from '../appData';

/** 将 API 因子映射为前端 FactorDisplayRow */
function mapFactor(api: ApiFactor): FactorDisplayRow {
  return {
    id: api.id,
    name: api.name,
    category: api.category,
    description: api.formula,
    ic: '—',
    rankIc: '—',
    groupReturn: '—',
    layerReturn: '—',
    referencedBy: [],
    status: api.status === 'active' ? FactorStatus.Active : FactorStatus.Draft,
  };
}

export function useFactors() {
  const { data, loading, error, reload } = useApi<ApiFactor[]>(fetchFactors);

  const factors = useMemo(() => (data ?? []).map(mapFactor), [data]);

  return { factors, loading, error, reload };
}
