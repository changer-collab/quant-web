"""默认组合策略实现 — 编排选股 + 择时 + 仓位管理"""

from __future__ import annotations

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    CompositeStrategy, StrategyContext, StrategyMeta, StrategyResult,
    StrategyState, Bar, Signal, OrderSide, OrderType, OrderRequest,
    ResearchMode, StrategyKind,
)


class DefaultComposite(CompositeStrategy):
    """默认组合策略。

    在每个 on_bars 调用中：
    1. 调用 selector.select 得到股票池
    2. 对池中每只股票调用 timer.signal 得到信号
    3. 对非 Hold 信号调用 sizer.size 得到目标数量
    4. 根据目标数量与当前持仓的差异下单

    仓位约定：
    - Buy 信号：sizer.size 返回"买入后应持有的目标总数量"
    - Sell 信号：sizer.size 返回"卖出后应剩余的目标数量"（0 表示清仓）
    """

    def __init__(
        self,
        selector: SelectorStrategy,
        timer: TimingStrategy,
        sizer: PositionStrategy,
    ) -> None:
        self._selector = selector
        self._timer = timer
        self._sizer = sizer
        self._state: StrategyState = StrategyState.Idle

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name=f"composite[{self._selector.meta.name}+{self._timer.meta.name}+{self._sizer.meta.name}]",
            description=f"组合策略: {self._selector.meta.name} + {self._timer.meta.name} + {self._sizer.meta.name}",
            modes=self._selector.meta.modes,
            params=[],
            version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return self._state

    def init(self, context: StrategyContext) -> None:
        self._selector.init(context)
        self._timer.init(context)
        self._sizer.init(context)
        self._state = StrategyState.Running

    def on_bars(self, bars: dict[str, Bar], context: StrategyContext) -> None:
        # 1. 选股
        universe = self._selector.select(bars, context)

        # 2. 逐标的择时 + 仓位 + 下单
        for symbol in universe:
            if symbol not in bars:
                continue

            bar = bars[symbol]
            sig = self._timer.signal(bar, context)
            if sig == Signal.Hold:
                continue

            target_qty = self._sizer.size(symbol, sig, bar.close, context)

            # 当前持仓
            pos = context.get_position(symbol)
            current_qty = pos.quantity if pos else 0.0

            if sig == Signal.Buy and target_qty > current_qty:
                diff = int(target_qty - current_qty)
                if diff > 0:
                    context.submit_order(OrderRequest(
                        symbol=symbol,
                        side=OrderSide.Buy,
                        type=OrderType.Market,
                        quantity=diff,
                    ))
            elif sig == Signal.Sell:
                # 卖出时：目标数量为 sizer 输出值
                # sizer 返回 0 表示清仓，返回 > 0 表示减仓到该数量
                if target_qty < current_qty:
                    diff = int(current_qty - target_qty)
                    if diff > 0:
                        context.submit_order(OrderRequest(
                            symbol=symbol,
                            side=OrderSide.Sell,
                            type=OrderType.Market,
                            quantity=diff,
                        ))

    def finish(self) -> StrategyResult:
        self._state = StrategyState.Stopped
        return StrategyResult(meta=self.meta)
