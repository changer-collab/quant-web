/**
 * 数据源选择器 — 按数据类型优先级自动回退
 *
 * 为每种数据类型定义优先级列表，当首选源失败时自动尝试下一个。
 */

/** 数据源优先级配置 */
export const SOURCE_PRIORITY: Record<string, string[]> = {
  bar: ['mootdx', 'akshare', 'baostock', 'efinance', 'yfinance', 'tushare'],
  tick: ['tushare'],
  trade_record: ['mootdx'],
  l2_snapshot: ['mootdx'],
  f10: ['mootdx'],
  instrument: ['akshare', 'baostock', 'efinance', 'tushare'],
  calendar: ['tushare'],
  adjustment_factor: ['baostock', 'akshare', 'tushare'],
  financial_report: ['baostock', 'akshare', 'tushare'],
  shareholder_metrics: ['baostock', 'efinance', 'tushare'],
  valuation: ['baostock', 'tushare', 'tencent'],
  news: ['akshare'],
  // 东财扩展数据类型
  dragon_tiger: ['eastmoney_dragon_tiger'],
  lockup: ['eastmoney_lockup'],
  margin: ['eastmoney_margin'],
  block_trade: ['eastmoney_block_trade'],
  dividend: ['eastmoney_dividend'],
  research_report: ['eastmoney_research'],
  hot_stocks: ['eastmoney_hot_stocks'],
  northbound_flow: ['eastmoney_northbound'],
};

/** 获取某数据类型的优先级列表 */
export function getSourcePriority(dataType: string): string[] {
  return SOURCE_PRIORITY[dataType] ?? [];
}

/** 尝试执行采集，自动按优先级回退 */
export async function executeWithFallback<T>(
  sources: string[],
  fn: (source: string) => Promise<T>
): Promise<{ source: string; result: T }> {
  const errors: { source: string; error: Error }[] = [];
  for (const source of sources) {
    try {
      const result = await fn(source);
      return { source, result };
    } catch (err) {
      errors.push({ source, error: err instanceof Error ? err : new Error(String(err)) });
    }
  }
  throw new Error(
    `所有数据源均失败: ${errors.map((e) => `${e.source}: ${e.error.message}`).join('; ')}`
  );
}
