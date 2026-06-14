import type { Bar, Tick } from '@quant/common';
import type { EventBus } from './event-bus.js';

/** 行情回放器 — 按时间排序后通过 EventBus 发布行情事件 */
export class MarketReplay {
  constructor(private bus: EventBus) {}

  /** 回放 K 线数据，按 timestamp 升序发布 bar 事件 */
  replayBars(bars: Bar[]): void {
    if (bars.length === 0) return;
    const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);
    for (const bar of sorted) {
      this.bus.emit('bar', bar);
    }
  }

  /** 回放 Tick 数据，按 timestamp 升序发布 tick 事件 */
  replayTicks(ticks: Tick[]): void {
    if (ticks.length === 0) return;
    const sorted = [...ticks].sort((a, b) => a.timestamp - b.timestamp);
    for (const tick of sorted) {
      this.bus.emit('tick', tick);
    }
  }
}
