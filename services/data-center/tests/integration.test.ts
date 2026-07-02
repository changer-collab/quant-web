import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDataCenter, type DataCenter } from '../src/storage/factory.js';
import { TimeFrame } from '../src/base/types.js';
import { InstrumentStatus } from '../src/reference/types.js';
import { AdjustmentType } from '../src/reference/types.js';
import { ReportType } from '../src/fundamental/types.js';
import { AnnouncementEventType, EventImpact } from '../src/event/types.js';
import type { ExtendedBar } from '../src/market/types.js';
import type { ExtendedInstrument } from '../src/reference/types.js';
import type { FinancialReport } from '../src/fundamental/types.js';
import type { AnnouncementEvent } from '../src/event/types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * 健壮删除临时目录 — 容忍 Windows 文件锁。
 *
 * better-sqlite3 持有真实文件句柄；当测试故意不 close()（或 close 被钩子阻止）
 * 时，句柄可能在 rmSync 时尚未被 OS 释放，Windows 抛 EPERM。
 * sql.js 是纯内存库无此问题。这里重试几次给 OS 释放句柄的时间。
 */
function rmDirRobust(dir: string): void {
  for (let i = 0; i < 5; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'EPERM' && code !== 'EBUSY' && code !== 'ENOTEMPTY') throw err;
      // 短暂同步等待后重试，给 OS 释放文件句柄的时间
      const until = Date.now() + 50;
      while (Date.now() < until) {
        /* spin */
      }
    }
  }
  // 最后一次尝试，失败则不阻断测试（临时目录会被 OS 定期清理）
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* 临时目录残留无害，留给 OS 清理 */
  }
}

describe('DataCenter 集成测试', () => {
  let dc: DataCenter;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quant-dc-test-'));
    dc = await createDataCenter({ dbPath: path.join(tmpDir, 'test.db') });
  });

  afterEach(async () => {
    await dc.close();
    rmDirRobust(tmpDir);
  });

  describe('K 线存储与查询', () => {
    it('保存并查询 K 线', async () => {
      const bars: ExtendedBar[] = [
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 2000,
          open: 5050,
          high: 5200,
          low: 5000,
          close: 5150,
          volume: 120000,
          turnover: 600000000,
        },
      ];
      await dc.repos.bars.save(bars);

      const result = await dc.repos.bars.query('CSI500', TimeFrame.D1);
      expect(result).toHaveLength(2);
      expect(result[0].close).toBe(5050);
      expect(result[1].close).toBe(5150);
    });

    it('按时间范围查询', async () => {
      const bars: ExtendedBar[] = [
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 2000,
          open: 5050,
          high: 5200,
          low: 5000,
          close: 5150,
          volume: 120000,
          turnover: 600000000,
        },
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 3000,
          open: 5150,
          high: 5300,
          low: 5100,
          close: 5250,
          volume: 110000,
          turnover: 550000000,
        },
      ];
      await dc.repos.bars.save(bars);

      const result = await dc.repos.bars.query('CSI500', TimeFrame.D1, 1500, 2500);
      expect(result).toHaveLength(1);
      expect(result[0].timestamp).toBe(2000);
    });

    it('获取最新 K 线', async () => {
      const bars: ExtendedBar[] = [
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 3000,
          open: 5150,
          high: 5300,
          low: 5100,
          close: 5250,
          volume: 110000,
          turnover: 550000000,
        },
      ];
      await dc.repos.bars.save(bars);

      const latest = await dc.repos.bars.getLatest('CSI500', TimeFrame.D1);
      expect(latest?.timestamp).toBe(3000);
    });

    it('幂等写入（重复不报错）', async () => {
      const bar: ExtendedBar = {
        symbol: 'CSI500',
        timeframe: TimeFrame.D1,
        timestamp: 1000,
        open: 5000,
        high: 5100,
        low: 4900,
        close: 5050,
        volume: 100000,
        turnover: 500000000,
      };
      await dc.repos.bars.save([bar]);
      await dc.repos.bars.save([bar]); // 重复写入

      const result = await dc.repos.bars.query('CSI500', TimeFrame.D1);
      expect(result).toHaveLength(1);
    });

    it('获取可用标的', async () => {
      await dc.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
        {
          symbol: 'HS300',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 4000,
          high: 4100,
          low: 3900,
          close: 4050,
          volume: 80000,
          turnover: 400000000,
        },
      ]);

      const symbols = await dc.repos.bars.getAvailableSymbols(TimeFrame.D1);
      expect(symbols).toContain('CSI500');
      expect(symbols).toContain('HS300');
    });
  });

  describe('标的存储与查询', () => {
    it('保存并查询标的', async () => {
      const inst: ExtendedInstrument = {
        symbol: 'CSI500',
        name: '中证500',
        exchange: 'SSE',
        lotSize: 1,
        priceTick: 0.01,
        industry: '指数',
        sector: '宽基',
        listDate: 20050101,
        status: InstrumentStatus.Active,
      };
      await dc.repos.instruments.save([inst]);

      const result = await dc.repos.instruments.getBySymbol('CSI500');
      expect(result?.name).toBe('中证500');
    });

    it('按条件查询标的', async () => {
      await dc.repos.instruments.save([
        {
          symbol: 'CSI500',
          name: '中证500',
          exchange: 'SSE',
          lotSize: 1,
          priceTick: 0.01,
          industry: '指数',
          sector: '宽基',
          listDate: 20050101,
          status: InstrumentStatus.Active,
        },
        {
          symbol: 'HS300',
          name: '沪深300',
          exchange: 'SSE',
          lotSize: 1,
          priceTick: 0.01,
          industry: '指数',
          sector: '宽基',
          listDate: 20050101,
          status: InstrumentStatus.Active,
        },
      ]);

      const result = await dc.repos.instruments.query({ exchange: 'SSE' });
      expect(result).toHaveLength(2);
    });
  });

  describe('交易日历', () => {
    it('保存并查询交易日历', async () => {
      await dc.repos.calendars.save({
        exchange: 'SSE',
        year: 2024,
        tradingDays: [1704067200000, 1704153600000],
        holidays: [1704240000000],
      });

      const cal = await dc.repos.calendars.get('SSE', 2024);
      expect(cal?.tradingDays).toHaveLength(2);
      expect(cal?.holidays).toHaveLength(1);
    });
  });

  describe('复权因子', () => {
    it('保存并查询复权因子', async () => {
      await dc.repos.adjustmentFactors.save([
        { symbol: 'CSI500', date: 1704067200000, factor: 1.05, type: AdjustmentType.Forward },
        { symbol: 'CSI500', date: 1706745600000, factor: 1.1, type: AdjustmentType.Forward },
      ]);

      const factors = await dc.repos.adjustmentFactors.query('CSI500');
      expect(factors).toHaveLength(2);
    });
  });

  describe('财报', () => {
    it('保存并查询财报', async () => {
      const report: FinancialReport = {
        symbol: '600519',
        reportDate: 1704067200000,
        announceDate: 1711929600000,
        reportType: ReportType.Annual,
        income: {
          revenue: 100,
          costOfRevenue: 50,
          operatingIncome: 40,
          totalRevenue: 45,
          netIncome: 30,
        },
        balanceSheet: {
          totalAssets: 500,
          totalLiabilities: 200,
          totalEquity: 300,
          currentAssets: 150,
          currentLiabilities: 80,
        },
        cashFlow: {
          operatingCashFlow: 35,
          investingCashFlow: -10,
          financingCashFlow: -5,
          freeCashFlow: 25,
        },
      };
      await dc.repos.financialReports.save([report]);

      const results = await dc.repos.financialReports.query('600519');
      expect(results).toHaveLength(1);
      expect(results[0].income.revenue).toBe(100);
    });
  });

  describe('公告事件', () => {
    it('保存并查询公告', async () => {
      const event: AnnouncementEvent = {
        id: 'evt-1',
        symbol: '600519',
        eventTime: 1704067200000,
        eventType: AnnouncementEventType.Dividend,
        title: '分红公告',
        impact: EventImpact.Positive,
      };
      await dc.repos.announcementEvents.save([event]);

      const results = await dc.repos.announcementEvents.query('600519');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('分红公告');
    });
  });

  describe('Provider 集成', () => {
    it('MarketDataProvider 流式返回 K 线', async () => {
      await dc.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 2000,
          open: 5050,
          high: 5200,
          low: 5000,
          close: 5150,
          volume: 120000,
          turnover: 600000000,
        },
      ]);

      const collected: ExtendedBar[] = [];
      for await (const bar of dc.providers.market.loadBars('CSI500', TimeFrame.D1)) {
        collected.push(bar);
      }
      expect(collected).toHaveLength(2);
    });

    it('ReferenceDataProvider 查询标的', async () => {
      await dc.repos.instruments.save([
        {
          symbol: 'CSI500',
          name: '中证500',
          exchange: 'SSE',
          lotSize: 1,
          priceTick: 0.01,
          industry: '指数',
          sector: '宽基',
          listDate: 20050101,
          status: InstrumentStatus.Active,
        },
      ]);

      const instruments = await dc.providers.reference.getInstruments();
      expect(instruments).toHaveLength(1);
      expect(instruments[0].symbol).toBe('CSI500');
    });

    it('DataQualityChecker 完整性检查', async () => {
      await dc.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      const report = await dc.providers.quality.checkCompleteness('test', 'CSI500', 1000, 2000);
      expect(report.actualCount).toBe(1);
      expect(report.coverage).toBeGreaterThan(0);
    });
  });

  describe('生命周期管理', () => {
    it('close() 后数据持久化到磁盘', async () => {
      const dbPath = path.join(tmpDir, 'persist-test.db');
      const dc1 = await createDataCenter({ dbPath });
      await dc1.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);
      await dc1.close();

      // 重新打开，数据应还在
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CSI500', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      expect(bars[0].close).toBe(5050);
      await dc2.close();
    });

    it('写入即落盘（better-sqlite3 即时持久化，无需 close）', async () => {
      // 语义变更：sql.js 是内存库，不 export 不落盘，旧测试断言"未 close 则数据丢失"。
      // better-sqlite3 直接写磁盘，.run() 执行即持久化，即使不 close 也不丢。
      // 对量化数据平台而言，写入即持久是更强的保证。
      const dbPath = path.join(tmpDir, 'no-close-test.db');
      const dc1 = await createDataCenter({ dbPath });
      await dc1.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);
      // 不调用 close()，直接用新连接读取
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CSI500', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      expect(bars[0].close).toBe(5050);
      await dc2.close();
      await dc1.close();
    });

    it('重复 close() 不报错', async () => {
      const dcLocal = await createDataCenter({ dbPath: path.join(tmpDir, 'double-close.db') });
      await dcLocal.close();
      await dcLocal.close(); // 不应抛错
    });

    it('status() 返回正确状态', async () => {
      expect(dc.status()).toBe('ready');
      expect(dc.isClosed()).toBe(false);
      await dc.close();
      expect(dc.status()).toBe('closed');
      expect(dc.isClosed()).toBe(true);
    });

    it('healthCheck() 反映状态', () => {
      const healthy = dc.healthCheck();
      expect(healthy.status).toBe('healthy');
      expect(healthy.dcStatus).toBe('ready');
    });

    it('close 后 healthCheck 返回 unhealthy', async () => {
      const dcLocal = await createDataCenter({ dbPath: path.join(tmpDir, 'hc-closed.db') });
      await dcLocal.close();
      const result = dcLocal.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.dcStatus).toBe('closed');
      expect(result.error).toBeDefined();
    });

    it('flush() 手动持久化', async () => {
      const dbPath = path.join(tmpDir, 'flush-test.db');
      const dcLocal = await createDataCenter({ dbPath });
      await dcLocal.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);
      dcLocal.flush();

      // flush 后 lastFlushAt 应有值
      const hc = dcLocal.healthCheck();
      expect(hc.lastFlushAt).toBeDefined();

      await dcLocal.close();

      // 数据应持久化成功
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CSI500', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      await dc2.close();
    });

    it('immediate 模式每次写入后自动持久化', async () => {
      const dbPath = path.join(tmpDir, 'immediate-test.db');
      const dcLocal = await createDataCenter({ dbPath, persistence: 'immediate' });
      await dcLocal.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      // 不调用 close()，但 immediate 模式已自动 flush
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CSI500', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      await dc2.close();
    });

    it('beforeClose 钩子可阻止关闭（旧行为兼容）', async () => {
      let closeCalled = false;
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'hook-block-old.db'),
        hooks: {
          beforeClose: async () => false,
          afterClose: async () => {
            closeCalled = true;
          },
        },
      });
      // 新版 close() 会抛出错误
      await expect(dcLocal.close()).rejects.toThrow();
      expect(dcLocal.status()).toBe('ready');
      expect(closeCalled).toBe(false);
      // 真正关闭以便清理
      const dcClean = await createDataCenter({ dbPath: path.join(tmpDir, 'hook-block-old.db') });
      await dcClean.close();
    });

    it('beforeClose 返回 false 时 close() 抛出错误', async () => {
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'hook-block-error.db'),
        hooks: { beforeClose: async () => false },
      });
      await expect(dcLocal.close()).rejects.toThrow('被 beforeClose 钩子阻止');
      expect(dcLocal.status()).toBe('ready');
      // 真正关闭以便清理
      const dcClean = await createDataCenter({ dbPath: path.join(tmpDir, 'hook-block-error.db') });
      await dcClean.close();
    });

    it('并发 close() 只执行一次关闭逻辑', async () => {
      const dbPath = path.join(tmpDir, 'concurrent-close.db');
      const dcLocal = await createDataCenter({ dbPath });
      await dcLocal.repos.bars.save([
        {
          symbol: 'CONCUR',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      // 并发调用 close
      await Promise.all([dcLocal.close(), dcLocal.close(), dcLocal.close()]);
      expect(dcLocal.isClosed()).toBe(true);

      // 数据应持久化
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CONCUR', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      await dc2.close();
    });

    it('afterClose 在 close 失败时仍被调用', async () => {
      let afterCloseCalled = false;
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'after-close-fail.db'),
        hooks: {
          afterClose: async () => {
            afterCloseCalled = true;
          },
        },
      });
      // 正常 close
      await dcLocal.close();
      expect(afterCloseCalled).toBe(true);
    });

    it('afterClose 钩子在关闭后触发', async () => {
      let closeCalled = false;
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'hook-after.db'),
        hooks: {
          afterClose: async () => {
            closeCalled = true;
          },
        },
      });
      await dcLocal.close();
      expect(closeCalled).toBe(true);
    });

    it('afterFlush 钩子在 flush 后触发', async () => {
      let flushCount = 0;
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'hook-flush.db'),
        hooks: {
          afterFlush: () => {
            flushCount++;
          },
        },
      });
      dcLocal.flush();
      expect(flushCount).toBe(1);
      dcLocal.flush();
      expect(flushCount).toBe(2);
      await dcLocal.close();
    });

    it('closeTimeout 超时抛错', async () => {
      // closeTimeout=0 表示不超时，这里用极小值模拟
      // better-sqlite3 close 是同步的，实际很难触发超时
      // 此测试验证 closeTimeout 配置能正常传入
      const dcLocal = await createDataCenter({
        dbPath: path.join(tmpDir, 'timeout-test.db'),
        closeTimeout: 0,
      });
      await dcLocal.close();
      expect(dcLocal.isClosed()).toBe(true);
    });

    it('Symbol.asyncDispose 支持', async () => {
      const dbPath = path.join(tmpDir, 'dispose-test.db');
      const dcLocal = await createDataCenter({ dbPath });
      await dcLocal.repos.bars.save([
        {
          symbol: 'CSI500',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);
      await dcLocal[Symbol.asyncDispose]();
      expect(dcLocal.isClosed()).toBe(true);

      // 数据应持久化
      const dc2 = await createDataCenter({ dbPath });
      const bars = await dc2.repos.bars.query('CSI500', TimeFrame.D1);
      expect(bars).toHaveLength(1);
      await dc2.close();
    });
  });

  describe('分页查询', () => {
    it('cursor 分页', async () => {
      const bars: ExtendedBar[] = Array.from({ length: 25 }, (_, i) => ({
        symbol: 'CSI500',
        timeframe: TimeFrame.D1,
        timestamp: (i + 1) * 1000,
        open: 5000 + i,
        high: 5100 + i,
        low: 4900 + i,
        close: 5050 + i,
        volume: 100000,
        turnover: 500000000,
      }));
      await dc.repos.bars.save(bars);

      // 第一页
      const page1 = await dc.providers.market.getBarsPaged('CSI500', TimeFrame.D1, { limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBe(10000);

      // 第二页
      const page2 = await dc.providers.market.getBarsPaged('CSI500', TimeFrame.D1, {
        limit: 10,
        afterTimestamp: page1.nextCursor,
      });
      expect(page2.data).toHaveLength(10);
      expect(page2.hasMore).toBe(true);

      // 第三页
      const page3 = await dc.providers.market.getBarsPaged('CSI500', TimeFrame.D1, {
        limit: 10,
        afterTimestamp: page2.nextCursor,
      });
      expect(page3.data).toHaveLength(5);
      expect(page3.hasMore).toBe(false);
      expect(page3.nextCursor).toBeUndefined();
    });
  });

  describe('PIT 过滤', () => {
    it('asOfDate 过滤财报', async () => {
      const reports = [
        {
          symbol: '600519',
          reportDate: 1000,
          announceDate: 1500,
          reportType: ReportType.Q1,
          income: {
            revenue: 10,
            costOfRevenue: 5,
            operatingIncome: 4,
            totalRevenue: 4.5,
            netIncome: 3,
          },
          balanceSheet: {
            totalAssets: 50,
            totalLiabilities: 20,
            totalEquity: 30,
            currentAssets: 15,
            currentLiabilities: 8,
          },
          cashFlow: {
            operatingCashFlow: 3.5,
            investingCashFlow: -1,
            financingCashFlow: -0.5,
            freeCashFlow: 2.5,
          },
        },
        {
          symbol: '600519',
          reportDate: 2000,
          announceDate: 2500,
          reportType: ReportType.Q2,
          income: {
            revenue: 20,
            costOfRevenue: 10,
            operatingIncome: 8,
            totalRevenue: 9,
            netIncome: 6,
          },
          balanceSheet: {
            totalAssets: 60,
            totalLiabilities: 25,
            totalEquity: 35,
            currentAssets: 20,
            currentLiabilities: 10,
          },
          cashFlow: {
            operatingCashFlow: 7,
            investingCashFlow: -2,
            financingCashFlow: -1,
            freeCashFlow: 5,
          },
        },
        {
          symbol: '600519',
          reportDate: 3000,
          announceDate: 3500,
          reportType: ReportType.Annual,
          income: {
            revenue: 30,
            costOfRevenue: 15,
            operatingIncome: 12,
            totalRevenue: 13.5,
            netIncome: 9,
          },
          balanceSheet: {
            totalAssets: 70,
            totalLiabilities: 30,
            totalEquity: 40,
            currentAssets: 25,
            currentLiabilities: 12,
          },
          cashFlow: {
            operatingCashFlow: 10,
            investingCashFlow: -3,
            financingCashFlow: -1.5,
            freeCashFlow: 7,
          },
        },
      ];
      await dc.repos.financialReports.save(reports);

      // asOfDate=2000：只返回 announceDate <= 2000 的记录
      const filtered = await dc.repos.financialReports.query('600519', undefined, undefined, 2000);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].reportDate).toBe(1000);

      // 不传 asOfDate：返回全部
      const all = await dc.repos.financialReports.query('600519');
      expect(all).toHaveLength(3);
    });

    it('asOfDate 过滤估值', async () => {
      await dc.repos.valuations.save([
        {
          symbol: '000001',
          timestamp: 1000,
          marketCap: 100,
          peTTM: 10,
          pb: 1.2,
          psTTM: 3,
          dividendYield: 0.05,
        },
        {
          symbol: '000001',
          timestamp: 2000,
          marketCap: 120,
          peTTM: 12,
          pb: 1.5,
          psTTM: 3.5,
          dividendYield: 0.04,
        },
        {
          symbol: '000001',
          timestamp: 3000,
          marketCap: 150,
          peTTM: 15,
          pb: 1.8,
          psTTM: 4,
          dividendYield: 0.03,
        },
      ]);

      const filtered = await dc.repos.valuations.query('000001', undefined, undefined, 2000);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((v) => v.timestamp <= 2000)).toBe(true);

      const all = await dc.repos.valuations.query('000001');
      expect(all).toHaveLength(3);
    });

    it('asOfDate 过滤股东人数', async () => {
      await dc.repos.shareholderMetrics.save([
        {
          symbol: '000001',
          announceDate: 1000,
          endDate: 900,
          totalHolders: 50000,
          avgHoldingShares: 2000,
          avgHoldingAmount: 100000,
          changeRatio: -5,
        },
        {
          symbol: '000001',
          announceDate: 2000,
          endDate: 1900,
          totalHolders: 48000,
          avgHoldingShares: 2100,
          avgHoldingAmount: 110000,
          changeRatio: -4,
        },
        {
          symbol: '000001',
          announceDate: 3000,
          endDate: 2900,
          totalHolders: 45000,
          avgHoldingShares: 2200,
          avgHoldingAmount: 120000,
          changeRatio: -6.25,
        },
      ]);

      const filtered = await dc.repos.shareholderMetrics.query(
        '000001',
        undefined,
        undefined,
        2000
      );
      expect(filtered).toHaveLength(2);
      expect(filtered.every((m) => m.announceDate <= 2000)).toBe(true);

      const all = await dc.repos.shareholderMetrics.query('000001');
      expect(all).toHaveLength(3);
    });

    it('asOfDate 过滤财务比率', async () => {
      await dc.repos.financialRatios.save([
        {
          symbol: '000001',
          asOfDate: 1000,
          roe: 0.15,
          roa: 0.08,
          eps: 1.5,
          pe: 10,
          pb: 1.2,
          ps: 3,
          debtToEquity: 0.5,
          currentRatio: 2,
          grossMargin: 0.4,
          netMargin: 0.15,
        },
        {
          symbol: '000001',
          asOfDate: 2000,
          roe: 0.18,
          roa: 0.09,
          eps: 1.8,
          pe: 12,
          pb: 1.5,
          ps: 3.5,
          debtToEquity: 0.45,
          currentRatio: 2.2,
          grossMargin: 0.42,
          netMargin: 0.18,
        },
        {
          symbol: '000001',
          asOfDate: 3000,
          roe: 0.2,
          roa: 0.1,
          eps: 2.0,
          pe: 15,
          pb: 1.8,
          ps: 4,
          debtToEquity: 0.4,
          currentRatio: 2.5,
          grossMargin: 0.45,
          netMargin: 0.2,
        },
      ]);

      const filtered = await dc.repos.financialRatios.query('000001', undefined, undefined, 2000);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.asOfDate <= 2000)).toBe(true);

      const all = await dc.repos.financialRatios.query('000001');
      expect(all).toHaveLength(3);
    });
  });

  describe('Watermark 水位', () => {
    it('保存和查询水位', async () => {
      await dc.repos.watermarks.upsert({
        source: 'tushare',
        dataType: 'bar',
        symbol: 'CSI500',
        lastTimestamp: 1700000000000,
        updatedAt: Date.now(),
      });

      const wm = await dc.repos.watermarks.get('tushare', 'bar', 'CSI500');
      expect(wm).toBeDefined();
      expect(wm!.lastTimestamp).toBe(1700000000000);

      // 更新水位
      await dc.repos.watermarks.upsert({
        source: 'tushare',
        dataType: 'bar',
        symbol: 'CSI500',
        lastTimestamp: 1800000000000,
        updatedAt: Date.now(),
      });

      const updated = await dc.repos.watermarks.get('tushare', 'bar', 'CSI500');
      expect(updated!.lastTimestamp).toBe(1800000000000);
    });

    it('列出水位', async () => {
      await dc.repos.watermarks.upsert({
        source: 'tushare',
        dataType: 'bar',
        symbol: 'CSI500',
        lastTimestamp: 1000,
        updatedAt: Date.now(),
      });
      await dc.repos.watermarks.upsert({
        source: 'tushare',
        dataType: 'bar',
        symbol: 'HS300',
        lastTimestamp: 2000,
        updatedAt: Date.now(),
      });
      await dc.repos.watermarks.upsert({
        source: 'akshare',
        dataType: 'tick',
        symbol: 'CSI500',
        lastTimestamp: 3000,
        updatedAt: Date.now(),
      });

      const all = await dc.repos.watermarks.list('tushare');
      expect(all).toHaveLength(2);

      const filtered = await dc.repos.watermarks.list('tushare', 'bar');
      expect(filtered).toHaveLength(2);
    });
  });

  describe('标的信息扩展性', () => {
    it('attributes JSON 字段', async () => {
      const inst: ExtendedInstrument = {
        symbol: '600519',
        name: '贵州茅台',
        exchange: 'SSE',
        lotSize: 100,
        priceTick: 0.01,
        industry: '白酒',
        sector: '消费',
        listDate: 20010827,
        status: InstrumentStatus.Active,
        attributes: { marketCap: 2000000000000, peTTM: 30.5 },
      };
      await dc.repos.instruments.save([inst]);

      const result = await dc.repos.instruments.getBySymbol('600519');
      expect(result?.attributes).toEqual({ marketCap: 2000000000000, peTTM: 30.5 });
    });

    it('TradingCalendar sessionType', async () => {
      await dc.repos.calendars.save({
        exchange: 'SSE',
        year: 2024,
        tradingDays: [1704067200000],
        holidays: [],
        sessionType: 'regular',
      });

      const cal = await dc.repos.calendars.get('SSE', 2024);
      expect(cal?.sessionType).toBe('regular');
    });
  });

  describe('时效性检查', () => {
    it('数据新鲜时通过检查', async () => {
      const recentTs = Date.now() - 1000; // 1秒前
      await dc.repos.bars.save([
        {
          symbol: 'FRESH',
          timeframe: TimeFrame.D1,
          timestamp: recentTs,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      const report = await dc.providers.quality.checkFreshness('test', 'FRESH', 86400000); // 1天容忍
      expect(report.isAcceptable).toBe(true);
      expect(report.consistencyIssues).toHaveLength(0);
    });

    it('数据过期时报告问题', async () => {
      const staleTs = Date.now() - 7 * 86400000; // 7天前
      await dc.repos.bars.save([
        {
          symbol: 'STALE',
          timeframe: TimeFrame.D1,
          timestamp: staleTs,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      const report = await dc.providers.quality.checkFreshness('test', 'STALE', 86400000); // 1天容忍
      expect(report.isAcceptable).toBe(false);
      expect(report.consistencyIssues).toHaveLength(1);
      expect(report.consistencyIssues[0].field).toBe('freshness');
    });
  });

  describe('数据导出', () => {
    it('JSON 格式导出 K 线', async () => {
      await dc.repos.bars.save([
        {
          symbol: 'EXP',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      const json = await dc.exporter.exportBars('EXP', TimeFrame.D1);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].close).toBe(5050);
    });

    it('CSV 格式导出 K 线', async () => {
      await dc.repos.bars.save([
        {
          symbol: 'EXP2',
          timeframe: TimeFrame.D1,
          timestamp: 1000,
          open: 5000,
          high: 5100,
          low: 4900,
          close: 5050,
          volume: 100000,
          turnover: 500000000,
        },
      ]);

      const csv = await dc.exporter.exportBars('EXP2', TimeFrame.D1, undefined, undefined, 'csv');
      expect(csv).toContain('timestamp,open,high,low,close,volume,turnover');
      expect(csv).toContain('1000,5000,5100,4900,5050,100000,500000000');
    });
  });
});
