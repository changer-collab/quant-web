"""持仓、账户相关类型"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Position:
    symbol: str
    quantity: float = 0.0
    avg_price: float = 0.0
    market_value: float = 0.0
    unrealized_pnl: float = 0.0
    # T+1 可卖数量：买入当日 available_qty 不增加，下一交易日才解锁
    # 默认等于 quantity（向后兼容，未启用 T+1 时两者一致）
    available_qty: float = 0.0


@dataclass
class Account:
    initial_cash: float
    cash: float
    equity: float
    positions: dict[str, Position] = field(default_factory=dict)
