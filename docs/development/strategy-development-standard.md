# 策略开发标准

本文档定义 QuantForge 策略开发的规范、接口约束和最佳实践。所有策略必须遵循此标准，以确保与回测引擎、Worker 调度链路的兼容性。

---

## 1. 目录与文件结构

策略代码位于 `packages/strategies/quantforge_strategies/`，**按类型分子目录组织**：

```
packages/strategies/
  quantforge_strategies/
    __init__.py          ← 统一导出 + 注册所有策略
    registry.py          ← 注册表（register / get / list_all）
    combined/            ← 传统单标的策略（继承 Strategy）
      __init__.py
      dual_ma.py
      rsi.py
      bollinger_band.py
    selectors/           ← 选股策略（继承 SelectorStrategy）
      __init__.py
      momentum.py
    timers/              ← 择时策略（继承 TimingStrategy）
      __init__.py
      ma_crossover.py
    sizers/              ← 仓位管理策略（继承 PositionStrategy）
      __init__.py
      equal_weight.py
      fixed_fraction.py
  tests/
    test_your_strategy.py ← 策略单元测试
```

### 1.1 策略类型分类

| 类型 | 基类 | 目录 | 用途 |
|------|------|------|------|
| 传统单标的 | `Strategy` | `combined/` | 完整的单标的策略（选股+择时+仓位一体） |
| 选股 | `SelectorStrategy` | `selectors/` | 从候选池选出目标股票列表 |
| 择时 | `TimingStrategy` | `timers/` | 对单标的输出 Buy/Sell/Hold 信号 |
| 仓位管理 | `PositionStrategy` | `sizers/` | 根据信号计算目标持仓数量 |
| 组合 | `CompositeStrategy` | — | 编排选股+择时+仓位（由回测引擎实现） |

---

## 2. 策略基类接口

QuantForge 支持两种开发模式：

- **传统模式**：继承 `Strategy`，单标的完整策略（选股+择时+仓位一体）
- **分层模式**：分别继承 `SelectorStrategy` / `TimingStrategy` / `PositionStrategy`，由 `CompositeStrategy` 编排

### 2.1 传统单标的策略（Strategy）

所有传统策略必须继承 `quantforge_strategy.Strategy` 抽象基类：

```python
from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, StrategyContext, StrategyParamDef,
)

class YourStrategy(Strategy):
    @property
    def meta(self) -> StrategyMeta: ...      # 必须：策略元信息
    @property
    def state(self) -> StrategyState: ...    # 必须：当前状态
    def init(self, context: StrategyContext) -> None: ...    # 必须：初始化
    def on_bar(self, bar: Bar, context: StrategyContext) -> None: ...  # 必须：K线回调
    def finish(self) -> StrategyResult: ...  # 必须：结束并返回结果
```

可选覆写：

```python
def on_tick(self, tick: Tick, context: StrategyContext) -> None: ...   # Tick 回调
def on_order(self, order: Order, context: StrategyContext) -> None: ... # 订单状态回调
```

### 2.2 选股策略（SelectorStrategy）

选股策略在每个调仓点从候选股票池中选出目标股票列表，**不直接下单**：

```python
from quantforge_strategy import (
    SelectorStrategy, StrategyMeta, StrategyResult,
    Bar, StrategyContext,
)

class YourSelector(SelectorStrategy):
    @property
    def meta(self) -> StrategyMeta: ...
    def init(self, context: StrategyContext) -> None: ...
    def select(self, bars: dict[str, Bar], context: StrategyContext) -> list[str]: ...
    def finish(self) -> StrategyResult: ...
```

- `select(bars, context)`：接收多标的行情字典，返回选中的 symbol 列表
- 子策略自行维护历史数据（在 `select` 中累积）

### 2.3 择时策略（TimingStrategy）

择时策略对给定标的的 Bar 输出买卖信号，**不直接下单**：

```python
from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, StrategyContext,
)

class YourTimer(TimingStrategy):
    @property
    def meta(self) -> StrategyMeta: ...
    def init(self, context: StrategyContext) -> None: ...
    def signal(self, bar: Bar, context: StrategyContext) -> Signal: ...
    def finish(self) -> StrategyResult: ...
```

- `signal(bar, context)`：返回 `Signal.Buy` / `Signal.Sell` / `Signal.Hold`

### 2.4 仓位管理策略（PositionStrategy）

仓位管理策略根据交易信号、当前价格和账户状态，输出目标持仓数量，**不直接下单**：

```python
from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, StrategyContext,
)

class YourSizer(PositionStrategy):
    @property
    def meta(self) -> StrategyMeta: ...
    def init(self, context: StrategyContext) -> None: ...
    def size(self, symbol: str, signal: Signal, price: float,
             context: StrategyContext) -> float: ...
    def finish(self) -> StrategyResult: ...
```

**仓位约定（必须遵守）：**
- `Signal.Buy` 时：`size` 返回"买入后应持有的目标总数量"
- `Signal.Sell` 时：`size` 返回"卖出后应剩余的目标数量"（0 表示清仓）

### 2.5 组合策略（CompositeStrategy）

组合策略由回测引擎实现（`DefaultComposite`），接收多标的行情，编排选股、择时和仓位管理。**开发者通常不需要继承此类**，直接使用 `DefaultComposite` 组装即可：

```python
from quantforge_backtest import DefaultComposite

composite = DefaultComposite(
    selector=YourSelector(...),
    timer=YourTimer(...),
    sizer=YourSizer(...),
)
```

---

## 3. StrategyMeta 规范

每个策略必须通过 `meta` 属性声明完整的元信息：

```python
from quantforge_strategy import StrategyMeta, StrategyParamDef, ParamType, ResearchMode, StrategyKind

@property
def meta(self) -> StrategyMeta:
    return StrategyMeta(
        name="your_strategy",           # 必须：唯一标识，与注册名一致
        description="策略描述",           # 必须：一句话说明策略逻辑
        modes=[ResearchMode.Traditional], # 必须：支持的研究模式
        params=[                         # 必须：可调参数定义
            StrategyParamDef(
                key="period",            # 参数键名
                label="周期",             # 前端展示名
                type=ParamType.Number,   # 类型：Number / String / Boolean / Select
                default=14,              # 默认值
                min=2,                   # 可选：最小值（Number 类型）
                max=200,                 # 可选：最大值（Number 类型）
            ),
        ],
        version="0.1.0",                # 必须：语义化版本号
        required_factors=None,           # 可选：依赖的因子列表
        kind=StrategyKind.Combined,      # 可选：策略类型（默认 Combined）
    )
```

### 3.1 name 命名规则

- 使用 `snake_case`
- 与文件名一致（如 `dual_ma.py` → name=`"dual_ma"`）
- 与注册名一致（`register("dual_ma", DualMAStrategy)`）

### 3.2 StrategyKind 策略类型

| 类型 | 值 | 适用基类 |
|------|------|----------|
| 传统单标的 | `Combined` | `Strategy`（默认） |
| 选股 | `Select` | `SelectorStrategy` |
| 择时 | `Timing` | `TimingStrategy` |
| 仓位管理 | `Position` | `PositionStrategy` |
| 组合 | `Composite` | `CompositeStrategy` |

### 3.3 ResearchMode

| 模式 | 值 | 适用场景 |
|------|------|----------|
| 传统量化 | `Traditional` | 技术指标、均线、动量等 |
| 高频 | `HighFrequency` | Tick 级别策略 |
| AI | `AI` | 机器学习预测驱动 |

### 3.4 ParamType

| 类型 | 值 | 约束字段 |
|------|------|----------|
| 数字 | `Number` | min / max |
| 字符串 | `String` | — |
| 布尔 | `Boolean` | — |
| 下拉选择 | `Select` | options: list[str] |

---

## 4. 策略生命周期

### 4.1 传统策略

```
init() → on_bar() × N → finish()
```

#### init(context)

- 重置所有内部状态（价格缓存、标志位等）
- 不要在此下单
- context 在 init 和后续回调中是同一个实例

#### on_bar(bar, context)

- 核心逻辑入口
- 通过 `context.submit_order()` 下单
- 通过 `context.get_account()` / `context.get_position()` 查询账户和持仓
- 通过 `context.log()` 记录日志

#### finish()

- 返回 `StrategyResult(meta=self.meta)`
- 可附带 `orders`、`trades`、`custom_output`

### 4.2 分层策略

分层策略由 `DefaultComposite` 编排，生命周期如下：

```
[Selector.init + Timer.init + Sizer.init]
  → on_bars(bars, context) × N
    ├─ Selector.select(bars, context) → list[symbol]
    ├─ for symbol in universe:
    │    ├─ Timer.signal(bar, context) → Signal
    │    └─ Sizer.size(symbol, signal, price, context) → target_qty
    └─ Composite 计算持仓差额并 submit_order
  → [Selector.finish + Timer.finish + Sizer.finish]
```

**关键约定：**

- `Selector.select` 在每个 bar 都会被调用，需要自行维护历史数据
- `Timer.signal` 只对被选中的标的调用，因此 Timer 的历史数据可能不连续（详见 4.3）
- `Sizer.size` 返回的是"目标总持仓数量"，Composite 负责计算差额下单

### 4.3 分层策略的注意事项

**Timer 历史数据连续性：** 由于 `Timer.signal` 只在被选中的标的上调用，若 `Selector` 在某些时间点未选到该标的，Timer 会错过那些 bar 的数据。建议：

- Selector 使用较小的 `lookback`（如 1），确保从第一个 bar 就选股
- 或在 Timer 内部对数据不足的情况返回 `Signal.Hold`

---

## 5. 下单规范

### 5.1 OrderRequest

```python
from quantforge_strategy import OrderRequest, OrderSide, OrderType

context.submit_order(OrderRequest(
    symbol=bar.symbol,        # 标的代码，与 Bar.symbol 一致
    side=OrderSide.Buy,       # Buy / Sell
    type=OrderType.Market,    # Market / Limit
    quantity=100,             # 数量（正整数）
    price=None,               # Market 单不需要，Limit 单需要
))
```

### 5.2 仓位检查

下单前必须检查：

```python
# 买入前：检查资金
account = context.get_account()
qty = int(account.cash / bar.close)
if qty > 0:
    context.submit_order(...)

# 卖出前：检查持仓
pos = context.get_position(bar.symbol)
if pos and pos.quantity > 0:
    context.submit_order(...)
```

### 5.3 禁止事项

- 不要在 `init()` 中下单
- 不要假设订单立即成交（回测引擎在下一个 bar 撮合）
- 不要直接修改 Position / Account 对象（通过 context 操作）

---

## 6. 数据访问

### 6.1 可用数据

| 数据 | 来源 | 访问方式 |
|------|------|----------|
| K线 | `on_bar(bar)` 回调 | `bar.open / high / low / close / volume` |
| Tick | `on_tick(tick)` 回调 | `tick.price / volume / bid / ask` |
| 账户 | `context.get_account()` | `Account.cash / equity / positions` |
| 持仓 | `context.get_position(symbol)` | `Position.quantity / avg_price / unrealized_pnl` |

### 6.2 Bar 字段

```python
@dataclass(frozen=True)
class Bar:
    symbol: str       # 标的代码，如 "600519"
    timeframe: TimeFrame  # K线周期
    timestamp: int    # 毫秒时间戳
    open: float       # 开盘价
    high: float       # 最高价
    low: float        # 最低价
    close: float      # 收盘价
    volume: float     # 成交量
```

### 6.3 TimeFrame 枚举

| 值 | 含义 |
|------|------|
| `M1` | 1分钟 |
| `M5` | 5分钟 |
| `M15` | 15分钟 |
| `H1` | 1小时 |
| `D1` | 日线 |

---

## 7. 注册与发现

### 7.1 注册策略

在对应类型子目录的 `__init__.py` 中导出策略类，然后在顶层 `quantforge_strategies/__init__.py` 中注册：

```python
# quantforge_strategies/selectors/__init__.py
from .momentum import MomentumSelector

__all__ = ["MomentumSelector"]
```

```python
# quantforge_strategies/__init__.py
from .combined import DualMAStrategy, RSIStrategy, BollingerBandStrategy
from .selectors import MomentumSelector
from .timers import MACrossoverTiming
from .sizers import EqualWeightSizer, FixedFractionSizer
from .registry import register

# 传统策略
register("dual_ma", DualMAStrategy)
register("rsi", RSIStrategy)
register("bollinger_band", BollingerBandStrategy)

# 分层策略
register("momentum_selector", MomentumSelector)
register("ma_crossover_timing", MACrossoverTiming)
register("equal_weight_sizer", EqualWeightSizer)
register("fixed_fraction_sizer", FixedFractionSizer)
```

### 7.2 发现策略

```python
from quantforge_strategies import get, list_all

cls = get("dual_ma")        # 获取策略类
all_strategies = list_all()  # 获取所有已注册策略
```

### 7.3 组装分层组合

分层策略需要通过 `DefaultComposite` 组装后才能回测：

```python
from quantforge_strategies import MomentumSelector, MACrossoverTiming, EqualWeightSizer
from quantforge_backtest import DefaultComposite, MultiSymbolRunner

composite = DefaultComposite(
    selector=MomentumSelector(lookback=5, top_k=3),
    timer=MACrossoverTiming(short_period=5, long_period=20),
    sizer=EqualWeightSizer(max_positions=3),
)

runner = MultiSymbolRunner(
    strategy=composite,
    bars={"600000": [...], "600519": [...]},
    initial_cash=1_000_000,
)
result = runner.run()
```

### 7.4 多策略组合（Portfolio）

多个独立策略可按权重组合，由 `MultiStrategyRunner` 分配资金：

```python
from quantforge_backtest import MultiStrategyRunner

runner = MultiStrategyRunner(
    strategies=[
        (composite_a, 0.4),  # 权重 40%
        (composite_b, 0.3),  # 权重 30%
        (composite_c, 0.3),  # 权重 30%
    ],
    bars=bars,
    initial_cash=1_000_000,
)
result = runner.run()
```

### 7.5 CLI 调用

Worker 通过 Python CLI 调用策略，支持三种模式：

#### 7.5.1 单标的传统策略

```json
{
  "command": "backtest",
  "strategy": "dual_ma",
  "config": { "initialCash": 1000000, "slippage": 0.001 },
  "dataRange": { "dbPath": "data/quant.db", "symbol": "600519", "timeframe": "1d" }
}
```

#### 7.5.2 组合策略（多标的）

```json
{
  "command": "backtest",
  "strategy": "composite",
  "config": {
    "initialCash": 100000,
    "slippage": 0.001,
    "components": {
      "selector": { "name": "momentum_selector", "params": { "lookback": 5, "top_k": 2 } },
      "timer":    { "name": "ma_crossover",     "params": { "short_period": 5, "long_period": 20 } },
      "sizer":    { "name": "equal_weight",     "params": { "max_positions": 2 } }
    }
  },
  "dataRange": {
    "dbPath": "data/quant.db",
    "symbols": ["600519", "000001", "600036"],
    "timeframe": "1d"
  }
}
```

**字段说明：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `strategy` | 是 | `"composite"` 表示组合策略 |
| `config.components.selector` | 是 | 选股策略配置（`name` + `params`） |
| `config.components.timer` | 是 | 择时策略配置 |
| `config.components.sizer` | 是 | 仓位管理策略配置 |
| `dataRange.symbols` | 是 | 标的代码数组（至少 1 个） |

**params 参数名** 使用 Python 构造函数的 snake_case 命名（如 `short_period`、`top_k`、`max_positions`），与策略类的 `__init__` 参数一致。

#### 7.5.3 错误码

| 错误码 | 触发条件 |
|--------|----------|
| `NO_SYMBOLS` | 组合策略未提供 `dataRange.symbols` |
| `NO_DATA` | 指定标的在数据库中无数据 |
| `UNSUPPORTED` | 传统策略不支持多标的（`symbols` 数组长度 > 1） |
| `INTERNAL_ERROR` | 策略名不存在或参数错误 |
```

---

## 8. 测试要求

每个策略必须包含单元测试，放在 `packages/strategies/tests/` 下：

### 8.1 传统策略必测项

```python
# test_your_strategy.py
from quantforge_strategies.combined.your_strategy import YourStrategy

def test_meta():
    """验证元信息完整性"""
    s = YourStrategy()
    assert s.meta.name == "your_strategy"
    assert len(s.meta.params) > 0
    assert s.meta.version
    assert s.meta.kind == StrategyKind.Combined

def test_init():
    """验证初始化重置状态"""
    s = YourStrategy()
    s.init(None)  # type: ignore
    # 检查内部状态已重置

def test_on_bar_no_trade():
    """验证数据不足时不下单"""
    s = YourStrategy()
    # 构造不足的 bar 数据，验证不下单
```

### 8.2 分层策略必测项

```python
# test_your_selector.py
from quantforge_strategies.selectors.your_selector import YourSelector

def test_meta():
    s = YourSelector()
    assert s.meta.kind == StrategyKind.Select

def test_select_insufficient_history():
    """历史数据不足时应返回空列表"""
    s = YourSelector()
    s.init(None)  # type: ignore
    bars = {"600000": _make_bar(...)}
    assert s.select(bars, None) == []  # type: ignore[arg-type]

def test_select_top_k():
    """应选出 top_k 个标的"""
    ...

# test_your_timer.py
def test_signal_hold_when_insufficient_data():
    """数据不足时应返回 Hold"""
    ...

def test_buy_on_golden_cross():
    """金叉时应返回 Buy"""
    ...

# test_your_sizer.py
def test_size_buy():
    """Buy 信号应返回正数目标持仓"""
    ...

def test_size_sell():
    """Sell 信号应返回 0（清仓）"""
    ...
```

### 8.3 建议测试项

- 参数边界值（如 period=2, period=200）
- 金叉/死叉信号准确性
- 空数据/单条数据处理
- 连续信号去重
- 分层组合端到端集成测试（参考 `tests/test_e2e_composite.py`）

---

## 9. 依赖规则

### 9.1 允许的依赖

```
packages/strategies → packages/strategy-runtime（唯一依赖）
```

策略只能 import `quantforge_strategy` 包，不能直接依赖：
- `quantforge_data`（数据客户端）
- `quantforge_backtest`（回测引擎）
- `services/data-center`
- 任何第三方库（pandas、numpy 等计算库除外）

### 9.2 计算库使用

- 允许使用 Python 标准库（`collections.deque`、`math` 等）
- 允许使用 `numpy`、`pandas`（如需复杂计算）
- 不允许使用需要网络连接的库

---

## 10. 完整示例

### 10.1 传统策略示例

以下是一个完整的传统策略模板：

```python
"""策略名称 — 一句话描述"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyParamDef,
)


class MyStrategy(Strategy):
    """策略描述：详细说明交易逻辑"""

    def __init__(self, period: int = 20, threshold: float = 2.0) -> None:
        self._period = period
        self._threshold = threshold
        self._prices: deque[float] = deque(maxlen=period + 1)
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="my_strategy",
            description="策略描述",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(
                    key="period", label="周期",
                    type=ParamType.Number, default=self._period,
                    min=2, max=200,
                ),
                StrategyParamDef(
                    key="threshold", label="阈值",
                    type=ParamType.Number, default=self._threshold,
                    min=0.5, max=5.0,
                ),
            ],
            version="0.1.0",
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._prices.clear()
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        if len(self._prices) < self._period:
            return

        # 计算指标
        prices = list(self._prices)
        ma = sum(prices[-self._period:]) / self._period

        # 交易逻辑
        if bar.close > ma * (1 + self._threshold / 100) and not self._bought:
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                ))
                self._bought = True
        elif bar.close < ma * (1 - self._threshold / 100) and self._bought:
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

### 10.2 分层策略示例（选股 + 择时 + 仓位）

分层模式将策略拆分为三个独立子策略，由 `DefaultComposite` 编排。以下是一个完整的分层策略组合示例：

```python
# selectors/momentum.py — 动量选股策略
"""动量选股 — 按过去 N 期涨幅选 Top-K"""

from __future__ import annotations
from collections import deque
from quantforge_strategy import (
    SelectorStrategy, StrategyMeta, StrategyResult,
    Bar, StrategyContext, StrategyParamDef, ParamType, ResearchMode, StrategyKind,
)


class MomentumSelector(SelectorStrategy):
    def __init__(self, lookback: int = 5, top_k: int = 3) -> None:
        self._lookback = lookback
        self._top_k = top_k
        self._history: dict[str, deque[float]] = {}

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="momentum_selector",
            description="按过去 N 期涨幅选 Top-K",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="lookback", label="回看期",
                                 type=ParamType.Number, default=self._lookback, min=1, max=50),
                StrategyParamDef(key="top_k", label="选股数",
                                 type=ParamType.Number, default=self._top_k, min=1, max=20),
            ],
            version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context: StrategyContext) -> None:
        self._history.clear()

    def select(self, bars: dict[str, Bar], context: StrategyContext) -> list[str]:
        for symbol, bar in bars.items():
            if symbol not in self._history:
                self._history[symbol] = deque(maxlen=self._lookback + 1)
            self._history[symbol].append(bar.close)

        scores: list[tuple[str, float]] = []
        for symbol, hist in self._history.items():
            if len(hist) < self._lookback + 1:
                continue
            ret = (hist[-1] - hist[0]) / hist[0]
            scores.append((symbol, ret))

        scores.sort(key=lambda x: x[1], reverse=True)
        return [s for s, _ in scores[: self._top_k]]

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

```python
# timers/ma_crossover.py — 均线交叉择时策略
"""均线交叉择时 — 短均线上穿长均线买入，下穿卖出"""

from __future__ import annotations
from collections import deque
from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, StrategyContext, StrategyParamDef, ParamType, ResearchMode, StrategyKind,
)


class MACrossoverTiming(TimingStrategy):
    def __init__(self, short_period: int = 5, long_period: int = 20) -> None:
        self._short = short_period
        self._long = long_period
        self._prices: deque[float] = deque(maxlen=long_period + 1)
        self._prev_short_above: bool | None = None

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="ma_crossover_timing",
            description="短均线上穿长均线买入，下穿卖出",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="short_period", label="短均线",
                                 type=ParamType.Number, default=self._short, min=2, max=50),
                StrategyParamDef(key="long_period", label="长均线",
                                 type=ParamType.Number, default=self._long, min=5, max=200),
            ],
            version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context: StrategyContext) -> None:
        self._prices.clear()
        self._prev_short_above = None

    def signal(self, bar: Bar, context: StrategyContext) -> Signal:
        self._prices.append(bar.close)
        if len(self._prices) < self._long:
            return Signal.Hold

        prices = list(self._prices)
        short_ma = sum(prices[-self._short:]) / self._short
        long_ma = sum(prices[-self._long:]) / self._long
        short_above = short_ma > long_ma

        if self._prev_short_above is None:
            self._prev_short_above = short_above
            return Signal.Hold

        sig = Signal.Hold
        if short_above and not self._prev_short_above:
            sig = Signal.Buy  # 金叉
        elif not short_above and self._prev_short_above:
            sig = Signal.Sell  # 死叉

        self._prev_short_above = short_above
        return sig

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

```python
# sizers/equal_weight.py — 等权仓位策略
"""等权仓位 — 每个标的分配等额资金"""

from __future__ import annotations
from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, StrategyContext, StrategyParamDef, ParamType, ResearchMode, StrategyKind,
)


class EqualWeightSizer(PositionStrategy):
    def __init__(self, max_positions: int = 5) -> None:
        self._max_positions = max_positions

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="equal_weight_sizer",
            description="每个标的分配等额资金",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="max_positions", label="最大持仓数",
                                 type=ParamType.Number, default=self._max_positions, min=1, max=20),
            ],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context: StrategyContext) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context: StrategyContext) -> float:
        if signal == Signal.Sell:
            return 0.0  # 清仓
        if signal != Signal.Buy or price <= 0:
            return 0.0

        account = context.get_account()
        per_symbol_cash = account.cash / self._max_positions
        return per_symbol_cash / price

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

```python
# 组装并回测
from quantforge_strategies import MomentumSelector, MACrossoverTiming, EqualWeightSizer
from quantforge_backtest import DefaultComposite, MultiSymbolRunner

composite = DefaultComposite(
    selector=MomentumSelector(lookback=5, top_k=3),
    timer=MACrossoverTiming(short_period=5, long_period=20),
    sizer=EqualWeightSizer(max_positions=3),
)

runner = MultiSymbolRunner(
    strategy=composite,
    bars={"600000": [...], "600519": [...]},
    initial_cash=1_000_000,
)
result = runner.run()
```

---

## 11. 回测验证

策略开发完成后，通过以下方式验证：

### 11.1 数据准备

```bash
npx tsx scripts/seed-data.ts
```

### 11.2 CLI 回测

```powershell
Get-Content scripts/test-backtest-input.json | python -m quantforge_strategy.cli
```

### 11.3 脚本回测

```bash
npx tsx scripts/run-backtest.ts
```

### 11.4 自动化测试

```bash
cd apps/worker && npx vitest run tests/e2e-pipeline.test.ts
```

---

## 12. 常见问题

### Q: 策略可以访问数据库吗？
不可以。策略通过 `on_bar` 回调接收行情数据，通过 `context` 查询账户和持仓。数据获取由回测引擎负责。

### Q: 策略可以同时交易多个标的吗？
可以。有两种方式：
1. **分层模式**：使用 `SelectorStrategy` + `DefaultComposite` + `MultiSymbolRunner`，支持多标的选股和组合回测。
2. **多策略组合**：使用 `MultiStrategyRunner` 将多个独立策略按权重组合，各自独立运行后合并权益曲线。

传统 `Strategy` 基类仍按单标的回放，多标的场景请使用分层模式。

### Q: 选股、择时、仓位管理策略可以分开开发吗？
可以。QuantForge 支持分层策略开发：
- `SelectorStrategy`：选股策略，输出目标股票列表
- `TimingStrategy`：择时策略，输出 Buy/Sell/Hold 信号
- `PositionStrategy`：仓位管理策略，输出目标持仓数量

三者通过 `DefaultComposite` 编排，详见第 2 节和第 10.2 节示例。

### Q: 如何使用因子？
在 `meta.required_factors` 中声明依赖的因子名，因子值将在 `on_bar` 中通过扩展接口传入（当前版本暂未实现）。

### Q: 策略参数如何传递？
通过构造函数参数传入。Worker CLI 的 `config` 字段会映射到构造函数参数。

### Q: 订单何时成交？
Market 单在下一个 bar 的开盘价撮合成交，受 slippage 影响。Limit 单在价格触及时成交。

### Q: 分层策略中 Timer 的历史数据为什么不连续？
因为 `Timer.signal` 只对被 `Selector` 选中的标的调用。若 Selector 在某些时间点未选到该标的，Timer 会错过那些 bar 的数据。建议 Selector 使用较小的 `lookback`（如 1），或在 Timer 内部对数据不足的情况返回 `Signal.Hold`。详见第 4.3 节。
