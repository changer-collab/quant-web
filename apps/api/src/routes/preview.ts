/**
 * Preview 端点
 *
 * POST /api/strategies/:name/preview
 * 加载 K 线 → 计算预览叠加层和信号 → 返回
 */
import type { FastifyInstance } from 'fastify';
import { TimeFrame } from '@quant/data-center';
import type { BarRepository } from '@quant/data-center';
import { PreviewService } from '../services/preview-service.js';

const DEFAULT_LIMIT = 200;
/** 首次加载最大批量（条）— 从最早到最新扫描，取最后 limit 条作为最近 K 线 */
const MAX_INITIAL_BATCH = 10_000;

export async function previewRoutes(app: FastifyInstance) {
  app.post<{ Params: { name: string } }>('/:name/preview', async (req, reply) => {
    const { name: _name } = req.params;
    const { symbol, timeframe, cursor, limit = DEFAULT_LIMIT, preview_params = {} } = req.body as {
      symbol: string;
      timeframe: string;
      cursor?: number | null;
      limit?: number;
      preview_params?: Record<string, unknown>;
    };

    if (!symbol || !timeframe) {
      return reply.code(400).send({ error: 'symbol and timeframe are required' });
    }

    const tf = timeframe as TimeFrame;
    const barRepo: BarRepository = app.dataCenter.repos.bars;

    // 加载 K 线（游标分页，向后翻页）
    const { bars, hasMore, nextCursor } = await loadPreviewBars(
      barRepo, symbol, tf, limit, cursor,
    );

    // 预览计算
    const preview = PreviewService.computePreview(bars, preview_params);

    return {
      symbol,
      bars,
      overlays: preview.overlays,
      signals: preview.signals,
      pagination: {
        has_more: hasMore,
        next_cursor: nextCursor ?? null,
      },
      fingerprint: preview.fingerprint,
      engine_version: '1.0.0',
    };
  });
}

/**
 * 加载预览 K 线 — 反向分页（最新在前，逐页向旧翻）
 *
 * cursor=null → 扫描从最早到最新的 MAX_INITIAL_BATCH 条，取最后 limit 条
 * cursor=给定 → 加载 timestamp < cursor 的全部 K 线，取最后 limit 条
 */
async function loadPreviewBars(
  barRepo: BarRepository,
  symbol: string,
  timeframe: TimeFrame,
  limit: number,
  cursor?: number | null,
): Promise<{ bars: any[]; hasMore: boolean; nextCursor?: number }> {
  if (cursor) {
    // 后续页：加载 cursor 之前的 K 线（timestamp < cursor）
    const allBefore = await barRepo.query(symbol, timeframe, undefined, cursor - 1);
    if (allBefore.length <= limit) {
      return { bars: allBefore, hasMore: false };
    }
    const page = allBefore.slice(-limit);
    return {
      bars: page,
      hasMore: true,
      nextCursor: page[0].timestamp,
    };
  }

  // 首页：取最近 limit 条
  const batch = await barRepo.queryPaged(symbol, timeframe, { limit: MAX_INITIAL_BATCH });
  const total = batch.data.length;

  if (total <= limit) {
    return { bars: batch.data, hasMore: false };
  }

  const page = batch.data.slice(-limit);
  return {
    bars: page,
    hasMore: total >= MAX_INITIAL_BATCH || batch.hasMore,
    nextCursor: page[0].timestamp,
  };
}
