import { describe, it, expect } from 'vitest';
import { MarketReplay } from '../src/replay.js';
import { EventBus } from '../src/event-bus.js';
import { TimeFrame } from '@quant/common';
import type { Bar } from '@quant/common';

function makeBar(timestamp: number, close: number): Bar {
  return {
    symbol: 'CSI500',
    timeframe: TimeFrame.D1,
    timestamp,
    open: close - 10,
    high: close + 20,
    low: close - 20,
    close,
    volume: 100000,
  };
}

describe('MarketReplay', () => {
  it('按时间顺序回放 K 线', () => {
    const bus = new EventBus();
    const replay = new MarketReplay(bus);
    const received: Bar[] = [];
    bus.on('bar', (_, data) => received.push(data as Bar));

    const bars = [makeBar(3000, 5050), makeBar(1000, 5000), makeBar(2000, 5020)];
    replay.replayBars(bars);

    expect(received).toHaveLength(3);
    expect(received[0].timestamp).toBe(1000);
    expect(received[1].timestamp).toBe(2000);
    expect(received[2].timestamp).toBe(3000);
  });

  it('空数组不触发事件', () => {
    const bus = new EventBus();
    const replay = new MarketReplay(bus);
    let count = 0;
    bus.on('bar', () => count++);
    replay.replayBars([]);
    expect(count).toBe(0);
  });
});
