import { OrderSide, OrderType, ResearchMode } from '@quant/common';
import type { Bar } from '@quant/common';
import type { Strategy, StrategyContext, StrategyMeta, StrategyResult } from '@quant/strategy-runtime';
import { StrategyState } from '@quant/strategy-runtime';

export interface RSIParams {
  period: number;
  oversold: number;
  overbought: number;
}

/** RSI 策略 — RSI 低于超卖线买入，高于超买线卖出 */
export class RSIStrategy implements Strategy {
  readonly meta: StrategyMeta;
  private _state: StrategyState = StrategyState.Idle;
  private ctx: StrategyContext | null = null;
  private readonly closes: number[] = [];
  private readonly period: number;
  private readonly oversold: number;
  private readonly overbought: number;

  constructor(params: RSIParams = { period: 14, oversold: 30, overbought: 70 }) {
    this.period = params.period;
    this.oversold = params.oversold;
    this.overbought = params.overbought;
    this.meta = {
      name: 'rsi',
      description: 'RSI 策略：RSI 低于超卖线买入，高于超买线卖出',
      modes: [ResearchMode.Traditional],
      params: [
        { key: 'period', label: 'RSI 周期', type: 'number' as any, default: this.period, min: 2, max: 100 },
        { key: 'oversold', label: '超卖线', type: 'number' as any, default: this.oversold, min: 0, max: 50 },
        { key: 'overbought', label: '超买线', type: 'number' as any, default: this.overbought, min: 50, max: 100 },
      ],
      version: '1.0.0',
    };
  }

  get state() { return this._state; }

  init(context: StrategyContext): void {
    this.ctx = context;
    this._state = StrategyState.Running;
  }

  onBar(bar: Bar, context: StrategyContext): void {
    this.closes.push(bar.close);
    if (!this.ctx) return;

    const rsi = this.calculateRSI();
    if (rsi === null) return;

    const pos = context.getPosition(bar.symbol);

    // RSI 低于超卖线且无持仓 → 买入
    if (rsi < this.oversold && !pos) {
      context.submitOrder({
        symbol: bar.symbol,
        side: OrderSide.Buy,
        type: OrderType.Market,
        quantity: 100,
      });
    }

    // RSI 高于超买线且有持仓 → 卖出
    if (rsi > this.overbought && pos) {
      context.submitOrder({
        symbol: bar.symbol,
        side: OrderSide.Sell,
        type: OrderType.Market,
        quantity: pos.quantity,
      });
    }
  }

  finish(): StrategyResult {
    this._state = StrategyState.Stopped;
    return { meta: this.meta, orders: [], trades: [] };
  }

  /** 计算 RSI */
  private calculateRSI(): number | null {
    const changes: number[] = [];
    for (let i = 1; i < this.closes.length; i++) {
      changes.push(this.closes[i] - this.closes[i - 1]);
    }
    if (changes.length < this.period) return null;

    const recentChanges = changes.slice(-this.period);
    const gains = recentChanges.filter((c) => c > 0);
    const losses = recentChanges.filter((c) => c < 0).map((c) => Math.abs(c));

    const avgGain = gains.length > 0 ? gains.reduce((s, g) => s + g, 0) / this.period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((s, l) => s + l, 0) / this.period : 0;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
