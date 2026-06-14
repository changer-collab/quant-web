import type { BacktestMetrics, EquityPoint } from '@quant/common';

/** 计算回测指标 */
export function calculateMetrics(
  equityCurve: EquityPoint[],
  initialCash: number,
): BacktestMetrics {
  if (equityCurve.length < 2) {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
    };
  }

  const finalEquity = equityCurve[equityCurve.length - 1].equity;
  const totalReturn = (finalEquity - initialCash) / initialCash;

  // 日收益率序列
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1].equity;
    const curr = equityCurve[i].equity;
    returns.push((curr - prev) / prev);
  }

  // 年化收益率（假设日频，252 个交易日）
  const tradingDays = equityCurve.length - 1;
  const annualizedReturn = tradingDays > 0
    ? Math.pow(1 + totalReturn, 252 / tradingDays) - 1
    : 0;

  // 夏普比率（无风险利率简化为 0）
  const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // 最大回撤
  let maxDrawdown = 0;
  let peak = equityCurve[0].equity;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdown = (peak - point.equity) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // 胜率
  const wins = returns.filter((r) => r > 0).length;
  const winRate = returns.length > 0 ? wins / returns.length : 0;

  return {
    totalReturn: Math.round(totalReturn * 10000) / 10000,
    annualizedReturn: Math.round(annualizedReturn * 10000) / 10000,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
    winRate: Math.round(winRate * 10000) / 10000,
    totalTrades: returns.length,
  };
}
