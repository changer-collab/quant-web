import { describe, it, expect } from 'vitest';
import { EventBus } from '../src/event-bus.js';

describe('EventBus', () => {
  it('on + emit 触发回调', () => {
    const bus = new EventBus();
    const received: Array<{ event: string; data: unknown }> = [];
    bus.on('bar', (event, data) => received.push({ event, data }));
    bus.emit('bar', { symbol: 'CSI500' });
    expect(received).toHaveLength(1);
    expect(received[0].event).toBe('bar');
    expect(received[0].data).toEqual({ symbol: 'CSI500' });
  });

  it('off 移除回调', () => {
    const bus = new EventBus();
    let count = 0;
    const cb = () => count++;
    bus.on('bar', cb);
    bus.emit('bar', {});
    bus.off('bar', cb);
    bus.emit('bar', {});
    expect(count).toBe(1);
  });

  it('无监听器时 emit 不报错', () => {
    const bus = new EventBus();
    expect(() => bus.emit('unknown', {})).not.toThrow();
  });

  it('clear 清除所有监听器', () => {
    const bus = new EventBus();
    let count = 0;
    bus.on('bar', () => count++);
    bus.on('trade', () => count++);
    bus.clear();
    bus.emit('bar', {});
    bus.emit('trade', {});
    expect(count).toBe(0);
  });

  it('同一事件多个回调', () => {
    const bus = new EventBus();
    let a = 0, b = 0;
    bus.on('bar', () => a++);
    bus.on('bar', () => b++);
    bus.emit('bar', {});
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});
