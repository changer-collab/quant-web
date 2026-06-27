"""回测运行器 — 串联行情回放、策略执行、撮合、持仓和指标计算

支持 A 股市场规则：
- T+1 锁定：每个交易日开盘时解锁持仓
- 交易成本：佣金、印花税、过户费
- 最小交易单位：买入数量检查
"""

from __future__ import annotations

from dataclasses import replace
from typing import Callable

from quantforge_strategy import (
    Strategy, Bar, Order, Trade, OrderRequest, OrderStatus, OrderSide,
    TimeFrame, ResearchMode,
)
from .types import (
    BacktestConfig, BacktestResult, BacktestMetrics, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .matcher import Matcher
from .portfolio import PortfolioManager
from .replay import BarReplay
from .metrics import calc_metrics, calc_trade_stats
from .market_rules import ASHARE_RULES, MarketRules


class BacktestRunner:
    def __init__(
        self,
        strategy: Strategy,
        bars: list[Bar],
        initial_cash: float | None = None,
        slippage: float | None = None,
        market_rules: MarketRules | None = None,
    ) -> None:
        """初始化回测运行器

        Args:
            strategy: 策略实例
            bars: 行情数据
            initial_cash: 初始资金
            slippage: 滑点
            market_rules: 市场规则配置
                - None：不启用任何规则（向后兼容）
                - MarketRules 实例：启用指定规则
        """
        self.strategy = strategy
        self.bars = BarReplay.sort_bars(bars)
        self.initial_cash = initial_cash or DEFAULT_INITIAL_CASH
        self.slippage = slippage if slippage is not None else DEFAULT_SLIPPAGE
        self.market_rules = market_rules

    def _apply_limit_prices(self, bar: Bar, prev_close: float | None) -> Bar:
        """用前收盘价补充涨跌停价。"""
        if self.market_rules is None or prev_close is None:
            return bar
        limit_up, limit_down = self.market_rules.calc_limit_prices(prev_close, bar.symbol)
        return replace(bar, limit_up=limit_up, limit_down=limit_down)

    def run(self, on_progress: Callable[[int, int], None] | None = None) -> BacktestResult:
        matcher = Matcher(self.slippage, self.market_rules)
        portfolio = PortfolioManager(self.initial_cash, self.market_rules)

        all_orders: list[Order] = []
        all_trades: list[Trade] = []
        equity_curve: list[EquityPoint] = []
        pending_orders: list[Order] = []
        order_id_seq = 0
        prev_date: int | None = None
        prev_close: float | None = None

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
                    reason=request.reason,
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
        for bar_index, raw_bar in enumerate(self.bars):
            if on_progress is not None:
                on_progress(bar_index, total_bars)
            bar = self._apply_limit_prices(raw_bar, prev_close)

            # T+1 解锁：检测交易日切换（按 bar.timestamp 的日期部分）
            if self.market_rules and self.market_rules.enable_t_plus_1:
                # 简单按 timestamp 当作日期边界（D1 频率下每个 bar 即一天）
                # 更精细的判断需要交易日历，这里用 timestamp 变化近似
                current_date = bar.timestamp
                if prev_date is not None and current_date != prev_date:
                    portfolio.unlock_t_plus_1()
                prev_date = current_date

            # 撮合挂单
            filled_indices: list[int] = []
            for i, order in enumerate(pending_orders):
                # 获取可卖数量（T+1 检查）
                available_qty = None
                if order.side == OrderSide.Sell:
                    pos = portfolio.get_position(order.symbol)
                    available_qty = pos.available_qty if pos else 0.0

                trade = matcher.match(order, bar, available_qty)
                if trade:
                    # 透传 reason 到 Trade
                    if order.reason is not None:
                        trade = Trade(
                            id=trade.id,
                            order_id=trade.order_id,
                            symbol=trade.symbol,
                            side=trade.side,
                            price=trade.price,
                            quantity=trade.quantity,
                            timestamp=trade.timestamp,
                            reason=order.reason,
                        )
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
                        reason=order.reason,
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
            prev_close = bar.close

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
            enable_market_rules=self.market_rules is not None,
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
