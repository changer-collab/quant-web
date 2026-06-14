import { describe, it, expect } from 'vitest';
import { QuantError } from '../src/errors.js';

describe('QuantError', () => {
  it('应包含 code 和 message', () => {
    const err = new QuantError('BACKTEST_FAILED', '回测失败');
    expect(err.name).toBe('QuantError');
    expect(err.code).toBe('BACKTEST_FAILED');
    expect(err.message).toBe('回测失败');
    expect(err.detail).toBeUndefined();
  });

  it('应支持 detail 字段', () => {
    const detail = { reason: '数据不足' };
    const err = new QuantError('DATA_MISSING', '数据缺失', detail);
    expect(err.detail).toEqual(detail);
  });

  it('应是 Error 实例', () => {
    const err = new QuantError('TEST', 'test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(QuantError);
  });
});
