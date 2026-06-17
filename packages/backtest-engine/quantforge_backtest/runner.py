"""回测运行器 — 串联行情回放、策略执行、撮合、持仓和指标计算"""

from __future__ import annotations

from typing import Callable

from quantforge_strategy import (
    Strategy, Bar, Order, Trade, OrderRequest, OrderStatus,
    TimeFrame, ResearchMode,
)
from .types import (
    BacktestConfig, BacktestResult, BacktestMetrics, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .matcher import Matcher
from .portfolio import PortfolioManager
from .replay import BarReplay
from .metrics import calc_metrics


class BacktestRunner:
    def __init__(
        self,
        strategy: Strategy,
        bars: list[Bar],
        initial_cash: float | None = None,
        slippage: float | None = None,
    ) -> None:
        self.strategy = strategy
        self.bars = BarReplay.sort_bars(bars)
        self.initial_cash = initial_cash or DEFAULT_INITIAL_CASH
        self.slippage = slippage if slippage is not None else DEFAULT_SLIPPAGE

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

        # 逐 bar 回放
        total_bars = len(self.bars)
        for bar_index, bar in enumerate(self.bars):
            if on_progress is not None:
                on_progress(bar_index, total_bars)
            # 撮合挂单
            filled_indices: list[int] = []
            for i, order in enumerate(pending_orders):
                trade = matcher.match(order, bar)
                if trade:
                    # 更新订单状态（frozen dataclass → 替换）
                    filled_order = Order(
                        id=order.id,
                        symbol=order.symbol,
                        side=order.side,
                        type=order.type,
                        price=order.price,
                        quantity=order.quantity,
                        filled_qty=order.quantity,
                        status=OrderStatus.Filled,
                        timestamp=bar.timestamp,
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
            portfolio.update_market_price(bar.symbol, bar.close)

            # 记录权益曲线
            account = portfolio.get_account()
            equity_curve.append(EquityPoint(timestamp=bar.timestamp, equity=account.equity))

            # 推送给策略
            self.strategy.on_bar(bar, context)

        # 结束策略
        self.strategy.finish()

        # 构建配置
        config = BacktestConfig(
            strategy_name=self.strategy.meta.name,
            mode=self.strategy.meta.modes[0] if self.strategy.meta.modes else ResearchMode.Traditional,
            timeframe=self.bars[0].timeframe if self.bars else TimeFrame.D1,
            start_date=self.bars[0].timestamp if self.bars else 0,
            end_date=self.bars[-1].timestamp if self.bars else 0,
            initial_cash=self.initial_cash,
            slippage=self.slippage,
        )

        return BacktestResult(
            config=config,
            trades=all_trades,
            equity_curve=equity_curve,
            metrics=calc_metrics(equity_curve, self.initial_cash, len(all_trades)),
        )
