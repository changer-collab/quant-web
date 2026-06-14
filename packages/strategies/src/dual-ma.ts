import { OrderSide, OrderType, ResearchMode } from '@quant/common';
import type { Bar } from '@quant/common';
import type { Strategy, StrategyContext, StrategyMeta, StrategyResult } from '@quant/strategy-runtime';
import { StrategyState } from '@quant/strategy-runtime';

export interface DualMAParams {
  fastPeriod: number;
  slowPeriod: number;
}

/** 双均线策略 — 快线上穿慢线买入，下穿卖出 */
export class DualMAStrategy implements Strategy {
  readonly meta: StrategyMeta;
  private _state: StrategyState = StrategyState.Idle;
  private ctx: StrategyContext | null = null;
  private readonly closes: number[] = [];
  private readonly fastPeriod: number;
  private readonly slowPeriod: number;

  constructor(params: DualMAParams = { fastPeriod: 5, slowPeriod: 10 }) {
    this.fastPeriod = params.fastPeriod;
    this.slowPeriod = params.slowPeriod;
    this.meta = {
      name: 'dual-ma',
      description: '双均线策略：快线上穿慢线买入，下穿卖出',
      modes: [ResearchMode.Traditional],
      params: [
        { key: 'fastPeriod', label: '快线周期', type: 'number' as any, default: this.fastPeriod, min: 2, max: 200 },
        { key: 'slowPeriod', label: '慢线周期', type: 'number' as any, default: this.slowPeriod, min: 5, max: 500 },
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
    if (this.closes.length < this.slowPeriod + 1 || !this.ctx) return;

    const fastMA = this.sma(this.closes, this.fastPeriod);
    const slowMA = this.sma(this.closes, this.slowPeriod);
    const prevFastMA = this.sma(this.closes.slice(0, -1), this.fastPeriod);
    const prevSlowMA = this.sma(this.closes.slice(0, -1), this.slowPeriod);

    const pos = context.getPosition(bar.symbol);

    // 金叉买入
    if (prevFastMA <= prevSlowMA && fastMA > slowMA && !pos) {
      context.submitOrder({
        symbol: bar.symbol,
        side: OrderSide.Buy,
        type: OrderType.Market,
        quantity: 100,
      });
    }

    // 死叉卖出
    if (prevFastMA >= prevSlowMA && fastMA < slowMA && pos) {
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

  /** 简单移动平均 */
  private sma(data: number[], period: number): number {
    const slice = data.slice(-period);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  }
}
