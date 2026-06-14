type EventCallback = (event: string, data: unknown) => void;

/** 事件总线 — 回测引擎内部通信核心 */
export class EventBus {
  private readonly listeners = new Map<string, Set<EventCallback>>();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    const set = this.listeners.get(event);
    if (set) set.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((cb) => cb(event, data));
  }

  clear(): void {
    this.listeners.clear();
  }
}
