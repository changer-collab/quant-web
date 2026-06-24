"""A 股市场规则与成本计算

借鉴 OSkhQuant khTrade.py 的设计思路：将 A 股特有的交易规则抽象为配置，
撮合和持仓管理器据此执行 T+1 锁定、最小交易单位、税费计算。

规则覆盖：
- T+1 锁定：买入当日不可卖出，需在下一交易日才可卖
- 最小交易单位：买入须为 100 股整数倍，卖出可含零股（清仓时）
- 印花税：卖出 0.05%（2023 年起减半后的税率）
- 佣金：双边万 2.5，最低 5 元
- 过户费：沪市双边 0.001%（深市无）
"""

from __future__ import annotations

from dataclasses import dataclass, field


# A 股默认市场规则（2024 年标准）
DEFAULT_STAMP_DUTY_RATE = 0.0005      # 印花税：卖出 0.05%
DEFAULT_COMMISSION_RATE = 0.00025     # 佣金：双边万 2.5
DEFAULT_MIN_COMMISSION = 5.0          # 最低佣金 5 元
DEFAULT_TRANSFER_FEE_RATE = 0.00001   # 过户费：沪市双边 0.001%
DEFAULT_LOT_SIZE = 100                # 最小交易单位 100 股


@dataclass(frozen=True)
class MarketRules:
    """A 股市场规则配置

    Attributes:
        lot_size: 最小交易单位（A 股为 100 股）
        stamp_duty_rate: 印花税率（仅卖出，2024 年为 0.0005）
        commission_rate: 佣金率（双边，默认万 2.5）
        min_commission: 单笔最低佣金（默认 5 元）
        transfer_fee_rate: 过户费率（仅沪市，双边 0.001%）
        enable_t_plus_1: 是否启用 T+1 锁定
        enable_lot_size: 是否启用最小交易单位检查
        enable_stamp_duty: 是否启用印花税
        enable_commission: 是否启用佣金
        enable_transfer_fee: 是否启用过户费
        sh_symbols: 沪市股票代码前缀（用于判断过户费）
    """
    lot_size: int = DEFAULT_LOT_SIZE
    stamp_duty_rate: float = DEFAULT_STAMP_DUTY_RATE
    commission_rate: float = DEFAULT_COMMISSION_RATE
    min_commission: float = DEFAULT_MIN_COMMISSION
    transfer_fee_rate: float = DEFAULT_TRANSFER_FEE_RATE
    enable_t_plus_1: bool = True
    enable_lot_size: bool = True
    enable_stamp_duty: bool = True
    enable_commission: bool = True
    enable_transfer_fee: bool = True
    sh_symbols: tuple[str, ...] = ("60", "68", "90", "11", "13", "50", "51", "56", "58")

    def is_sh_symbol(self, symbol: str) -> bool:
        """判断是否为沪市标的（需收过户费）"""
        return any(symbol.startswith(prefix) for prefix in self.sh_symbols)

    def round_to_lot(self, quantity: float, is_sell: bool = False) -> float:
        """将数量取整为最小交易单位的整数倍

        买入：必须为 lot_size 整数倍
        卖出：允许零股（清仓场景），但建议取整
        """
        if not self.enable_lot_size:
            return quantity
        if is_sell:
            # 卖出允许零股，但向下取整到 lot_size 倍数（除非全部卖出）
            return int(quantity)
        lots = int(quantity // self.lot_size)
        return lots * self.lot_size

    def calc_commission(self, amount: float) -> float:
        """计算佣金（双边）"""
        if not self.enable_commission:
            return 0.0
        commission = amount * self.commission_rate
        return max(commission, self.min_commission)

    def calc_stamp_duty(self, amount: float, is_sell: bool) -> float:
        """计算印花税（仅卖出）"""
        if not self.enable_stamp_duty or not is_sell:
            return 0.0
        return amount * self.stamp_duty_rate

    def calc_transfer_fee(self, amount: float, symbol: str) -> float:
        """计算过户费（仅沪市，双边）"""
        if not self.enable_transfer_fee or not self.is_sh_symbol(symbol):
            return 0.0
        return amount * self.transfer_fee_rate

    def calc_total_cost(self, amount: float, symbol: str, is_sell: bool) -> float:
        """计算单笔交易的全部成本（佣金 + 印花税 + 过户费）"""
        commission = self.calc_commission(amount)
        stamp_duty = self.calc_stamp_duty(amount, is_sell)
        transfer_fee = amount * self.transfer_fee_rate if (self.enable_transfer_fee and self.is_sh_symbol(symbol)) else 0.0
        return commission + stamp_duty + transfer_fee


# 默认 A 股规则（全开）
ASHARE_RULES = MarketRules()

# 无规则（用于纯研究场景，与旧行为兼容）
NO_RULES = MarketRules(
    enable_t_plus_1=False,
    enable_lot_size=False,
    enable_stamp_duty=False,
    enable_commission=False,
    enable_transfer_fee=False,
)
