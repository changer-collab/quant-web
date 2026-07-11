import type { FastifyInstance } from 'fastify';
import { InstrumentStatus, TimeFrame } from '@quant/data-center';
import { TaskType } from '../types.js';

export async function dataRoutes(app: FastifyInstance) {
  /** 触发数据采集任务（异步，由 Worker 执行） */
  app.post('/collect', async (req, reply) => {
    const { source, dataType, symbols, start, end, extra } = req.body as {
      source: string;
      dataType: string;
      symbols?: string[];
      start?: number;
      end?: number;
      extra?: Record<string, unknown>;
    };
    const task = await app.taskService.submit(TaskType.Collect, {
      source,
      dataType,
      symbols: symbols ?? [],
      start,
      end,
      extra,
    });
    return reply.code(202).send({ id: task.id, status: task.status });
  });

  app.get('/instruments', async (req) => {
    const { industry, sector, status } = req.query as {
      industry?: string;
      sector?: string;
      status?: string;
    };
    return app.dataCenter.providers.reference.getInstruments({
      industry,
      sector,
      status: status as InstrumentStatus | undefined,
    });
  });

  app.get('/bars', async (req) => {
    const { symbol, timeframe, start, end } = req.query as {
      symbol: string;
      timeframe: string;
      start?: string;
      end?: string;
    };
    const bars = [];
    for await (const bar of app.dataCenter.providers.market.loadBars(
      symbol,
      timeframe as TimeFrame,
      start ? Number(start) : undefined,
      end ? Number(end) : undefined
    )) {
      bars.push(bar);
    }
    return bars;
  });

  app.get('/coverage', async (req) => {
    const { source, symbol, start, end } = req.query as {
      source: string;
      symbol: string;
      start: string;
      end: string;
    };
    return app.dataCenter.providers.quality.checkCompleteness(
      source,
      symbol,
      Number(start),
      Number(end)
    );
  });

  app.get('/quality', async (req) => {
    const { source, symbol, start, end } = req.query as {
      source: string;
      symbol: string;
      start: string;
      end: string;
    };
    return app.dataCenter.providers.quality.checkConsistency(
      source,
      symbol,
      Number(start),
      Number(end)
    );
  });
}
