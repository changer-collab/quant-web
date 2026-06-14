import {
  OrderStatus,
  DEFAULT_INITIAL_CASH,
  DEFAULT_SLIPPAGE,
  TimeFrame,
  ResearchMode,
} from '@quant/common';
import type {
  Bar,
  Order,
  Trade,
  BacktestConfig,
  BacktestResult,
  EquityPoint,
} from '@quant/common';
import type { Strategy, StrategyContext } from '@quant/strategy-runtime';
import type { OrderRequest } from '@quant/strategy-runtime';
import { EventBus } from './event-bus.js';
import { MarketReplay } from './replay.js';
import { Matcher } from './matcher.js';
import { Portfolio } from './portfolio.js';
import { calculateMetrics } from './metrics.js';

/** 回测运行配置 */
export interface BacktestRunnerConfig {
  strategy: Strategy;
  bars: Bar[];
  initialCash?: number;
  slippage?: number;
}

/** 回测运行器 — 串联行情回放、策略执行、撮合、持仓和指标计算 */
export class BacktestRunner {
  private readonly strategy: Strategy;
  private readonly bars: Bar[];
  private readonly initialCash: number;
  private readonly slippage: number;

  constructor(config: BacktestRunnerConfig) {
    this.strategy = config.strategy;
    this.bars = config.bars;
    this.initialCash = config.initialCash ?? DEFAULT_INITIAL_CASH;
    this.slippage = config.slippage ?? DEFAULT_SLIPPAGE;
  }

  /** 执行回测，返回完整结果 */
  run(): BacktestResult {
    const bus = new EventBus();
    const replay = new MarketReplay(bus);
    const matcher = new Matcher(this.slippage);
    const portfolio = new Portfolio(this.initialCash);

    const allOrders: Order[] = [];
    const allTrades: Trade[] = [];
    const equityCurve: EquityPoint[] = [];
    const pendingOrders: Order[] = [];
    let orderIdSeq = 0;

    // 策略上下文实现
    const context: StrategyContext = {
      submitOrder: (request: OrderRequest) => {
        const order: Order = {
          id: `ord-${++orderIdSeq}`,
          symbol: request.symbol,
          side: request.side,
          type: request.type,
          price: request.price,
          quantity: request.quantity,
          filledQty: 0,
          status: OrderStatus.Pending,
          timestamp: Date.now(),
        };
        allOrders.push(order);
        pendingOrders.push(order);
      },
      getPosition: (symbol: string) => portfolio.getPosition(symbol),
      getAllPositions: () => portfolio.getAllPositions(),
      getAccount: () => portfolio.getAccount(),
      log: () => {},
    };

    // 初始化策略
    this.strategy.init(context);

    // 监听 bar 事件
    bus.on('bar', (_, data) => {
      const bar = data as Bar;

      // 撮合挂单
      for (let i = pendingOrders.length - 1; i >= 0; i--) {
        const order = pendingOrders[i];
        const trade = matcher.match(order, bar);
        if (trade) {
          order.status = OrderStatus.Filled;
          order.filledQty = order.quantity;
          allTrades.push(trade);
          portfolio.applyTrade(trade);
          pendingOrders.splice(i, 1);
        }
      }

      // 更新市价
      portfolio.updateMarketPrice(bar.symbol, bar.close);

      // 记录权益曲线
      const account = portfolio.getAccount();
      equityCurve.push({ timestamp: bar.timestamp, equity: account.equity });

      // 推送给策略
      this.strategy.onBar(bar, context);
    });

    // 回放行情
    replay.replayBars(this.bars);

    // 结束策略
    this.strategy.finish();

    // 构建配置
    const config: BacktestConfig = {
      strategyName: this.strategy.meta.name,
      mode: this.strategy.meta.modes[0] ?? ResearchMode.Traditional,
      instruments: [],
      timeframe: this.bars[0]?.timeframe ?? TimeFrame.D1,
      startDate: this.bars[0]?.timestamp ?? 0,
      endDate: this.bars[this.bars.length - 1]?.timestamp ?? 0,
      initialCash: this.initialCash,
      slippage: this.slippage,
      params: {},
    };

    return {
      config,
      trades: allTrades,
      equityCurve,
      metrics: calculateMetrics(equityCurve, this.initialCash),
    };
  }
}
