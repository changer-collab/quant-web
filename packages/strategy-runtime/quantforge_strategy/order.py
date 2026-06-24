"""订单、成交相关类型"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .types import OrderSide, OrderStatus, OrderType


@dataclass(frozen=True)
class Order:
    id: str
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: float
    filled_qty: float = 0.0
    price: float | None = None
    status: OrderStatus = OrderStatus.Pending
    timestamp: int = 0
    # 交易原因（策略填写，用于归因和日志）
    reason: str | None = None


@dataclass(frozen=True)
class Trade:
    id: str
    order_id: str
    symbol: str
    side: OrderSide
    price: float
    quantity: float
    timestamp: int = 0
    # 交易原因（从 Order 透传）
    reason: str | None = None


@dataclass(frozen=True)
class OrderRequest:
    symbol: str
    side: OrderSide
    type: OrderType
    quantity: float
    price: float | None = None
    # 交易原因（策略填写，用于归因和日志）
    reason: str | None = None
