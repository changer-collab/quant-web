"""多标的回测运行器 — 支持组合策略"""

from __future__ import annotations

from typing import Callable

from quantforge_strategy import (
    CompositeStrategy, Bar, Order, Trade, OrderRequest, OrderStatus,
    TimeFrame, ResearchMode,
)
from .types import (
    BacktestConfig, BacktestResult, BacktestMetrics, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .matcher import Matcher
from .portfolio import PortfolioManager
from .metrics import calc_metrics, calc_trade_stats


class MultiSymbolRunner:
    """多标的回测运行器。

    接收多标的行情（dict[symbol, list[Bar]]），按时间戳合并后逐时间点回放。
    每个时间点调用 CompositeStrategy.on_bars(bars_dict, context)。
    """

    def __init__(
        self,
        strategy: CompositeStrategy,
        bars: dict[str, list[Bar]],
        initial_cash: float | None = None,
        slippage: float | None = None,
    ) -> None:
        self.strategy = strategy
        self.bars_by_symbol = bars
        self.initial_cash = initial_cash or DEFAULT_INITIAL_CASH
        self.slippage = slippage if slippage is not None else DEFAULT_SLIPPAGE

    def _merge_bars(self) -> list[dict[str, Bar]]:
        """将多标的 bars 按时间戳合并为时间序列。

        Returns:
            按时间戳排序的 list，每个元素是 {symbol: Bar} 字典
        """
        timestamp_to_bars: dict[int, dict[str, Bar]] = {}
        for symbol, symbol_bars in self.bars_by_symbol.items():
            for bar in symbol_bars:
                if bar.timestamp not in timestamp_to_bars:
                    timestamp_to_bars[bar.timestamp] = {}
                timestamp_to_bars[bar.timestamp][symbol] = bar

        return [timestamp_to_bars[ts] for ts in sorted(timestamp_to_bars.keys())]

    def run(self, on_progress: Callable[[int, int], None] | None = None) -> BacktestResult:
        matcher = Matcher(self.slippage)
        portfolio = PortfolioManager(self.initial_cash)

        all_orders: list[Order] = []
        all_trades: list[Trade] = []
        equity_curve: list[EquityPoint] = []
        pending_orders: list[Order] = []
        order_id_seq = 0

        # 策略上下文实现
        class _Context:
            def submit_order(self, request: OrderRequest) -> None:
                nonlocal order_id_seq
                order_id_seq += 1
                order = Order(
                    id=f"ord-{order_id_seq}",
                    symbol=request.symbol,
                    side=request.side,
                    type=request.type,
                    price=request.price,
                    quantity=request.quantity,
                    filled_qty=0.0,
                    status=OrderStatus.Pending,
                    timestamp=0,
                )
                all_orders.append(order)
                pending_orders.append(order)

            def get_position(self, symbol: str):
                return portfolio.get_position(symbol)

            def get_all_positions(self):
                return portfolio.get_all_positions()

            def get_account(self):
                return portfolio.get_account()

            def log(self, level: str, message: str, data: object = None) -> None:
                pass

        context = _Context()

        # 初始化策略
        self.strategy.init(context)

        # 合并多标的 bars
        # 逐时间点回放
        timeline = self._merge_bars()
        total_steps = len(timeline)

        for step_index, bars_at_ts in enumerate(timeline):
            if on_progress is not None:
                on_progress(step_index, total_steps)
            current_ts = min(b.timestamp for b in bars_at_ts.values())

            # 撮合挂单（只撮合当前时间点有行情的标的）
            filled_indices: list[int] = []
            for i, order in enumerate(pending_orders):
                if order.symbol not in bars_at_ts:
                    continue
                bar = bars_at_ts[order.symbol]
                trade = matcher.match(order, bar)
                if trade:
                    filled_order = Order(
                        id=order.id,
                        symbol=order.symbol,
                        side=order.side,
                        type=order.type,
                        price=order.price,
                        quantity=order.quantity,
                        filled_qty=order.quantity,
                        status=OrderStatus.Filled,
                        timestamp=current_ts,
                    )
                    idx = all_orders.index(order)
                    all_orders[idx] = filled_order
                    all_trades.append(trade)
                    portfolio.apply_trade(trade)
                    filled_indices.append(i)

            # 移除已成交订单
            for i in sorted(filled_indices, reverse=True):
                pending_orders.pop(i)

            # 更新市价
            for symbol, bar in bars_at_ts.items():
                portfolio.update_market_price(symbol, bar.close)

            # 记录权益曲线
            account = portfolio.get_account()
            equity_curve.append(EquityPoint(timestamp=current_ts, equity=account.equity))

            # 推送给策略
            self.strategy.on_bars(bars_at_ts, context)

        # 结束策略
        self.strategy.finish()

        # 构建配置
        first_bars = [b[0] for b in self.bars_by_symbol.values() if b]
        last_bars = [b[-1] for b in self.bars_by_symbol.values() if b]

        config = BacktestConfig(
            strategy_name=self.strategy.meta.name,
            mode=self.strategy.meta.modes[0] if self.strategy.meta.modes else ResearchMode.Traditional,
            timeframe=first_bars[0].timeframe if first_bars else TimeFrame.D1,
            start_date=first_bars[0].timestamp if first_bars else 0,
            end_date=last_bars[-1].timestamp if last_bars else 0,
            initial_cash=self.initial_cash,
            slippage=self.slippage,
            strategy_kind=self.strategy.meta.kind.value,
        )

        # 计算交易级衍生统计
        trade_stats = calc_trade_stats(all_trades)

        return BacktestResult(
            config=config,
            trades=all_trades,
            equity_curve=equity_curve,
            metrics=calc_metrics(equity_curve, self.initial_cash, len(all_trades)),
            profit_loss_ratio=trade_stats["profit_loss_ratio"],
            avg_holding_days=trade_stats["avg_holding_days"],
            max_single_profit=trade_stats["max_single_profit"],
            max_single_loss=trade_stats["max_single_loss"],
        )
