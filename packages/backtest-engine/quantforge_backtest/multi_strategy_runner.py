"""多策略组合运行器 — 多个独立策略按权重分配资金，各自独立运行后合并结果"""

from __future__ import annotations

from quantforge_strategy import (
    CompositeStrategy, Bar, Trade, TimeFrame, ResearchMode,
)
from .types import (
    BacktestConfig, BacktestResult, BacktestMetrics, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .multi_runner import MultiSymbolRunner
from .metrics import calc_metrics, calc_trade_stats


class MultiStrategyRunner:
    """多策略组合运行器。

    接收多个 (CompositeStrategy, weight) 组合，为每个子策略分配
    initial_cash * weight 的资金，各自用 MultiSymbolRunner 独立运行，
    最后按时间戳合并权益曲线、合并成交、重新计算指标。
    """

    def __init__(
        self,
        strategies: list[tuple[CompositeStrategy, float]],
        bars: dict[str, list[Bar]],
        initial_cash: float | None = None,
        slippage: float | None = None,
    ) -> None:
        self.strategies = strategies
        self.bars_by_symbol = bars
        self.initial_cash = initial_cash or DEFAULT_INITIAL_CASH
        self.slippage = slippage if slippage is not None else DEFAULT_SLIPPAGE

    def run(self) -> BacktestResult:
        if not self.strategies:
            # 空策略列表，返回空结果
            config = BacktestConfig(
                strategy_name="empty_portfolio",
                mode=ResearchMode.Traditional,
                timeframe=TimeFrame.D1,
            )
            return BacktestResult(config=config)

        all_trades: list[Trade] = []
        all_equity_curves: list[list[EquityPoint]] = []
        strategy_names: list[str] = []

        # 逐个子策略独立运行
        for strategy, weight in self.strategies:
            sub_cash = self.initial_cash * weight
            sub_runner = MultiSymbolRunner(
                strategy=strategy,
                bars=self.bars_by_symbol,
                initial_cash=sub_cash,
                slippage=self.slippage,
            )
            sub_result = sub_runner.run()

            all_trades.extend(sub_result.trades)
            all_equity_curves.append(sub_result.equity_curve)
            strategy_names.append(strategy.meta.name)

        # 按时间戳合并权益曲线（各子策略权益相加）
        merged_equity = self._merge_equity_curves(all_equity_curves)

        # 构建配置
        first_bars = [b[0] for b in self.bars_by_symbol.values() if b]
        last_bars = [b[-1] for b in self.bars_by_symbol.values() if b]

        config = BacktestConfig(
            strategy_name=f"portfolio[{'+'.join(strategy_names)}]",
            mode=ResearchMode.Traditional,
            timeframe=first_bars[0].timeframe if first_bars else TimeFrame.D1,
            start_date=first_bars[0].timestamp if first_bars else 0,
            end_date=last_bars[-1].timestamp if last_bars else 0,
            initial_cash=self.initial_cash,
            slippage=self.slippage,
        )

        # 计算交易级衍生统计
        trade_stats = calc_trade_stats(all_trades)

        return BacktestResult(
            config=config,
            trades=all_trades,
            equity_curve=merged_equity,
            metrics=calc_metrics(merged_equity, self.initial_cash, len(all_trades)),
            profit_loss_ratio=trade_stats["profit_loss_ratio"],
            avg_holding_days=trade_stats["avg_holding_days"],
            max_single_profit=trade_stats["max_single_profit"],
            max_single_loss=trade_stats["max_single_loss"],
        )

    def _merge_equity_curves(
        self, curves: list[list[EquityPoint]]
    ) -> list[EquityPoint]:
        """按时间戳合并多条权益曲线，相同时间戳的权益相加。"""
        if not curves:
            return []

        # 收集所有时间戳
        ts_to_equity: dict[int, float] = {}
        for curve in curves:
            for point in curve:
                if point.timestamp not in ts_to_equity:
                    ts_to_equity[point.timestamp] = 0.0
                ts_to_equity[point.timestamp] += point.equity

        # 按时间戳排序生成合并曲线
        return [
            EquityPoint(timestamp=ts, equity=ts_to_equity[ts])
            for ts in sorted(ts_to_equity.keys())
        ]
