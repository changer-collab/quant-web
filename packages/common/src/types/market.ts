export { TimeFrame } from '@quant/data-center';
export type { Instrument, Bar, Tick } from '@quant/data-center';

import type { Bar, Tick } from '@quant/data-center';

/** 行情事件 */
export interface MarketEvent {
  type: 'bar' | 'tick';
  data: Bar | Tick;
}
