import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import type { DataCenter } from '@quant/data-center';

function createMockDataCenter(): DataCenter {
  return {
    providers: {} as never,
    repos: {} as never,
    exporter: {} as never,
    close: async () => {},
    status: () => 'ready' as const,
    isClosed: () => false,
    flush: () => {},
    healthCheck: () => ({ status: 'healthy' as const, dcStatus: 'ready' as const }),
    [Symbol.asyncDispose]: async () => {},
  };
}

describe('研究沉淀路由', () => {
  it('手动灵感会创建 collecting 研究过程及事件', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/research/sessions/manual-inspiration',
      payload: {
        strategy: 'dual_ma',
        title: '双均线的震荡市过滤想法',
        content: '只在均线斜率为正时开仓。',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      session: { strategy: 'dual_ma', status: 'collecting' },
      event: { eventType: 'manual_inspiration' },
    });

    await app.close();
  });

  it('结束研究后进入第一次审核并仍可编辑候选内容', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/research/sessions/manual-inspiration',
      payload: { strategy: 'dual_ma', content: '初始假设' },
    });
    const sessionId = created.json().session.id as string;

    const ended = await app.inject({ method: 'POST', url: `/api/research/sessions/${sessionId}/finish` });
    expect(ended.statusCode).toBe(200);
    expect(ended.json().status).toBe('pending_review');

    const update = await app.inject({
      method: 'PUT',
      url: `/api/research/sessions/${sessionId}`,
      payload: { title: '审核后标题' },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().title).toBe('审核后标题');

    await app.close();
  });

  it('相同 dedupe_key 的自动事件只保存一次', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const event = {
      eventType: 'backtest_submitted',
      dedupeKey: 'backtest_submitted:task-7',
      payload: { taskId: 'task-7', strategy: 'dual_ma' },
      occurredAt: 1_720_000_000_000,
    };
    const first = await app.inject({ method: 'POST', url: '/api/internal/research/events', payload: event });
    const second = await app.inject({ method: 'POST', url: '/api/internal/research/events', payload: event });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toMatchObject({ created: false });

    const sessionId = first.json().event.sessionId as string;
    await app.inject({ method: 'POST', url: `/api/research/sessions/${sessionId}/finish` });
    await app.inject({ method: 'POST', url: '/api/internal/research/events', payload: event });
    const sessions = await app.inject({ method: 'GET', url: '/api/research/sessions' });
    expect(sessions.json()).toHaveLength(1);

    await app.close();
  });

  it('携带明确策略的 Git 提交自动聚合到该策略当前研究过程', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/research/events',
      payload: {
        eventType: 'git_commit',
        dedupeKey: 'git:abc123',
        payload: { strategy: 'dual_ma', commitHash: 'abc123', files: ['packages/strategies/dual_ma.py'] },
        occurredAt: 1_720_000_000_000,
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().event.sessionId).toMatch(/^rs_/u);
    await app.close();
  });

  it('待归类提交只能由用户显式归入研究过程', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });
    const unassigned = await app.inject({
      method: 'POST',
      url: '/api/internal/research/events',
      payload: {
        eventType: 'git_commit',
        dedupeKey: 'git:unassigned',
        payload: { commitHash: 'unassigned', files: ['apps/web/src/App.tsx'] },
        occurredAt: 1_720_000_000_000,
      },
    });
    const created = await app.inject({
      method: 'POST',
      url: '/api/research/sessions/manual-inspiration',
      payload: { strategy: 'dual_ma', content: '人工归类目标' },
    });
    const sessionId = created.json().session.id as string;
    const eventId = unassigned.json().event.id as string;

    const assigned = await app.inject({
      method: 'POST',
      url: `/api/research/sessions/${sessionId}/events/${eventId}/assign`,
    });
    expect(assigned.statusCode).toBe(200);
    const detail = await app.inject({ method: 'GET', url: `/api/research/sessions/${sessionId}` });
    expect(detail.json().events).toEqual(expect.arrayContaining([expect.objectContaining({ id: eventId })]));
    await app.close();
  });
});
