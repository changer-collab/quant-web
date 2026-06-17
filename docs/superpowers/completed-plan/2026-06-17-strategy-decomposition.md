# 策略分层解耦实现方案（选股 / 择时 / 仓位管理）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将策略拆分为选股（Selector）、择时（Timer）、仓位管理（Sizer）三种独立可开发的子策略，并提供组合编排能力，使三者可以分开开发再组合回测。

**Architecture:** 在 `strategy-runtime` 中新增三种子策略 ABC 和 `CompositeStrategy` ABC；在 `backtest-engine` 中新增 `DefaultComposite`（编排三者）和 `MultiSymbolRunner`（多标的回测）；在 `strategies` 中新增示例实现。现有 `Strategy` 和 `BacktestRunner` 完全不变，保证向后兼容。

**Tech Stack:** Python 3.11+, ABC/dataclass, pytest, hatchling

---

## 设计说明

### 为什么不继承现有 `Strategy`？

现有 `Strategy.on_bar(bar, context)` 是单标的接口，而选股策略需要同时看多标的行情。强行继承会破坏 Liskov 替换。因此三种子策略定义为独立 ABC，通过 `CompositeStrategy` 编排，由 `MultiSymbolRunner` 驱动。

### 数据流

```
MultiSymbolRunner
  └─ 按时间戳合并多标的 bars → 每个时间点 {symbol: Bar}
  └─ CompositeStrategy.on_bars(bars_dict, context)
       ├─ SelectorStrategy.select(bars_dict, context) → list[str]（股票池）
       ├─ TimingStrategy.signal(bar, context) → Signal（买卖信号）
       └─ PositionStrategy.size(symbol, signal, price, context) → float（目标数量）
       └─ 根据 目标数量 vs 当前持仓 → submit_order
```

### 类型归属（遵循 AGENTS.md）

| 类型 | 所有者 |
|------|--------|
| `StrategyKind`, `Signal` | strategy-runtime |
| `SelectorStrategy`, `TimingStrategy`, `PositionStrategy`, `CompositeStrategy` | strategy-runtime |
| `DefaultComposite`, `MultiSymbolRunner` | backtest-engine |
| `MomentumSelector`, `MACrossoverTiming`, `EqualWeightSizer`, `FixedFractionSizer` | strategies |

---

## 文件结构

### strategy-runtime（接口层）

| 文件 | 职责 | 动作 |
|------|------|------|
| `quantforge_strategy/types.py` | 增加 `StrategyKind`、`Signal` 枚举 | 修改 |
| `quantforge_strategy/meta.py` | `StrategyMeta` 增加 `kind` 字段 | 修改 |
| `quantforge_strategy/selectors.py` | `SelectorStrategy` ABC | 新建 |
| `quantforge_strategy/timers.py` | `TimingStrategy` ABC | 新建 |
| `quantforge_strategy/sizers.py` | `PositionStrategy` ABC | 新建 |
| `quantforge_strategy/composite.py` | `CompositeStrategy` ABC | 新建 |
| `quantforge_strategy/__init__.py` | 导出新类型 | 修改 |
| `tests/test_selectors.py` | 选股基类测试 | 新建 |
| `tests/test_timers.py` | 择时基类测试 | 新建 |
| `tests/test_sizers.py` | 仓位基类测试 | 新建 |
| `tests/test_composite.py` | 组合基类测试 | 新建 |

### backtest-engine（组合层）

| 文件 | 职责 | 动作 |
|------|------|------|
| `quantforge_backtest/composite_impl.py` | `DefaultComposite` 实现 | 新建 |
| `quantforge_backtest/multi_runner.py` | `MultiSymbolRunner` 多标的回测 | 新建 |
| `quantforge_backtest/__init__.py` | 导出新类型 | 修改 |
| `tests/test_composite_impl.py` | DefaultComposite 测试 | 新建 |
| `tests/test_multi_runner.py` | MultiSymbolRunner 测试 | 新建 |

### strategies（实现层）

| 文件 | 职责 | 动作 |
|------|------|------|
| `quantforge_strategies/momentum_selector.py` | 动量选股策略 | 新建 |
| `quantforge_strategies/ma_crossover_timing.py` | 均线交叉择时策略 | 新建 |
| `quantforge_strategies/equal_weight_sizer.py` | 等权仓位策略 | 新建 |
| `quantforge_strategies/fixed_fraction_sizer.py` | 固定比例仓位策略 | 新建 |
| `quantforge_strategies/__init__.py` | 注册新策略 | 修改 |
| `tests/test_momentum_selector.py` | 动量选股测试 | 新建 |
| `tests/test_ma_crossover_timing.py` | 均线交叉择时测试 | 新建 |
| `tests/test_equal_weight_sizer.py` | 等权仓位测试 | 新建 |
| `tests/test_fixed_fraction_sizer.py` | 固定比例仓位测试 | 新建 |

---

## Task 1: 增加 StrategyKind 和 Signal 枚举

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/types.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/meta.py`
- Test: `packages/strategy-runtime/tests/test_types.py`

- [ ] **Step 1: 在 types.py 末尾增加 StrategyKind 和 Signal 枚举**

在 `packages/strategy-runtime/quantforge_strategy/types.py` 末尾追加：

```python
class StrategyKind(str, Enum):
    """策略类型 — 区分选股、择时、仓位管理和组合策略"""
    Combined = "combined"      # 传统单策略（现有 Strategy 的默认类型）
    Select = "select"          # 选股策略
    Timing = "timing"          # 择时策略
    Position = "position"      # 仓位管理策略
    Composite = "composite"    # 组合策略


class Signal(str, Enum):
    """交易信号"""
    Buy = "buy"
    Sell = "sell"
    Hold = "hold"
```

- [ ] **Step 2: 在 meta.py 的 StrategyMeta 中增加 kind 字段**

将 `packages/strategy-runtime/quantforge_strategy/meta.py` 中的 import 行修改为：

```python
from .types import ParamType, ResearchMode, StrategyKind
```

将 `StrategyMeta` dataclass 修改为（在 `required_factors` 后增加 `kind` 字段）：

```python
@dataclass(frozen=True)
class StrategyMeta:
    name: str
    description: str
    modes: list[ResearchMode]
    params: list[StrategyParamDef]
    version: str
    required_factors: list[str] | None = None
    kind: StrategyKind = StrategyKind.Combined
```

- [ ] **Step 3: 在 test_types.py 中增加枚举测试**

在 `packages/strategy-runtime/tests/test_types.py` 末尾追加：

```python
from quantforge_strategy.types import StrategyKind, Signal


def test_strategy_kind():
    assert StrategyKind.Combined == "combined"
    assert StrategyKind.Select == "select"
    assert StrategyKind.Timing == "timing"
    assert StrategyKind.Position == "position"
    assert StrategyKind.Composite == "composite"


def test_signal():
    assert Signal.Buy == "buy"
    assert Signal.Sell == "sell"
    assert Signal.Hold == "hold"
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_types.py -v`
Expected: PASS

- [ ] **Step 5: 验证现有 meta 测试仍通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_strategy.py -v`
Expected: PASS（kind 有默认值，不破坏现有代码）

- [ ] **Step 6: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/types.py packages/strategy-runtime/quantforge_strategy/meta.py packages/strategy-runtime/tests/test_types.py
git commit -m "feat(strategy-runtime): 增加 StrategyKind 和 Signal 枚举，StrategyMeta 增加 kind 字段"
```

---

## Task 2: 定义 SelectorStrategy 基类

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/selectors.py`
- Test: `packages/strategy-runtime/tests/test_selectors.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategy-runtime/tests/test_selectors.py`：

```python
"""选股策略基类测试"""

from quantforge_strategy.selectors import SelectorStrategy
from quantforge_strategy.meta import StrategyMeta, StrategyParamDef
from quantforge_strategy.types import ResearchMode, StrategyKind
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummySelector(SelectorStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_selector",
            description="测试选股策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return list(bars.keys())

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_selector_is_abstract():
    """SelectorStrategy 不能直接实例化"""
    try:
        SelectorStrategy()
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_selector_meta_kind():
    s = DummySelector()
    assert s.meta.kind == StrategyKind.Select


def test_selector_select_returns_symbols():
    s = DummySelector()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    result = s.select({"600000": bar}, None)
    assert result == ["600000"]
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_selectors.py -v`
Expected: FAIL with "No module named 'quantforge_strategy.selectors'"

- [ ] **Step 3: 实现 SelectorStrategy**

创建 `packages/strategy-runtime/quantforge_strategy/selectors.py`：

```python
"""选股策略基类 — 从候选池中选出目标股票"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult


class SelectorStrategy(ABC):
    """选股策略基类。

    在每个调仓点从候选股票池中选出目标股票列表。
    不直接下单，只输出选股结果。
    子策略自行维护历史数据（在 select 中累积）。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def select(self, bars: dict[str, Bar], context: StrategyContext) -> list[str]:
        """根据当前多标的行情选出股票池。

        Args:
            bars: 当前时刻各标的的最新 Bar，key 为 symbol
            context: 策略上下文
        Returns:
            选中的 symbol 列表
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_selectors.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/selectors.py packages/strategy-runtime/tests/test_selectors.py
git commit -m "feat(strategy-runtime): 定义 SelectorStrategy 选股策略基类"
```

---

## Task 3: 定义 TimingStrategy 基类

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/timers.py`
- Test: `packages/strategy-runtime/tests/test_timers.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategy-runtime/tests/test_timers.py`：

```python
"""择时策略基类测试"""

from quantforge_strategy.timers import TimingStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, Signal
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummyTimer(TimingStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_timer",
            description="测试择时策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        pass

    def signal(self, bar: Bar, context) -> Signal:
        return Signal.Hold

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_timer_is_abstract():
    try:
        TimingStrategy()
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_timer_meta_kind():
    s = DummyTimer()
    assert s.meta.kind == StrategyKind.Timing


def test_timer_signal():
    s = DummyTimer()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    assert s.signal(bar, None) == Signal.Hold
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_timers.py -v`
Expected: FAIL with "No module named 'quantforge_strategy.timers'"

- [ ] **Step 3: 实现 TimingStrategy**

创建 `packages/strategy-runtime/quantforge_strategy/timers.py`：

```python
"""择时策略基类 — 对单只股票输出买卖信号"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult
from .types import Signal


class TimingStrategy(ABC):
    """择时策略基类。

    对给定标的的 Bar 输出买卖信号（Buy/Sell/Hold）。
    不直接下单，只输出信号。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def signal(self, bar: Bar, context: StrategyContext) -> Signal:
        """对单根 bar 输出交易信号。

        Args:
            bar: 当前标的的行情
            context: 策略上下文
        Returns:
            Signal.Buy / Signal.Sell / Signal.Hold
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_timers.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/timers.py packages/strategy-runtime/tests/test_timers.py
git commit -m "feat(strategy-runtime): 定义 TimingStrategy 择时策略基类"
```

---

## Task 4: 定义 PositionStrategy 基类

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/sizers.py`
- Test: `packages/strategy-runtime/tests/test_sizers.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategy-runtime/tests/test_sizers.py`：

```python
"""仓位管理策略基类测试"""

from quantforge_strategy.sizers import PositionStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, Signal
from quantforge_strategy.result import StrategyResult


class DummySizer(PositionStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_sizer",
            description="测试仓位策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        return 100.0

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_sizer_is_abstract():
    try:
        PositionStrategy()
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_sizer_meta_kind():
    s = DummySizer()
    assert s.meta.kind == StrategyKind.Position


def test_sizer_size():
    s = DummySizer()
    qty = s.size("600000", Signal.Buy, 10.0, None)
    assert qty == 100.0
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_sizers.py -v`
Expected: FAIL with "No module named 'quantforge_strategy.sizers'"

- [ ] **Step 3: 实现 PositionStrategy**

创建 `packages/strategy-runtime/quantforge_strategy/sizers.py`：

```python
"""仓位管理策略基类 — 根据信号和账户状态输出目标持仓数量"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .meta import StrategyMeta
from .result import StrategyResult
from .types import Signal


class PositionStrategy(ABC):
    """仓位管理策略基类。

    根据交易信号、当前价格和账户状态，输出目标持仓数量。
    不直接下单，只输出数量建议。

    约定：
    - Buy 信号时，size 返回"买入后应持有的目标总数量"
    - Sell 信号时，size 返回"卖出后应剩余的目标数量"（0 表示清仓）
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def size(
        self,
        symbol: str,
        signal: Signal,
        price: float,
        context: StrategyContext,
    ) -> float:
        """计算目标持仓数量。

        Args:
            symbol: 标的代码
            signal: 交易信号（Buy/Sell）
            price: 当前价格
            context: 策略上下文
        Returns:
            目标持仓数量（正数）
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_sizers.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/sizers.py packages/strategy-runtime/tests/test_sizers.py
git commit -m "feat(strategy-runtime): 定义 PositionStrategy 仓位管理策略基类"
```

---

## Task 5: 定义 CompositeStrategy 基类

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/composite.py`
- Test: `packages/strategy-runtime/tests/test_composite.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategy-runtime/tests/test_composite.py`：

```python
"""组合策略基类测试"""

from quantforge_strategy.composite import CompositeStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, StrategyState
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummyComposite(CompositeStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_composite",
            description="测试组合策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        pass

    def on_bars(self, bars: dict, context) -> None:
        pass

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_composite_is_abstract():
    try:
        CompositeStrategy()
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_composite_meta_kind():
    s = DummyComposite()
    assert s.meta.kind == StrategyKind.Composite


def test_composite_on_bars():
    s = DummyComposite()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    s.on_bars({"600000": bar}, None)  # 不应抛异常
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_composite.py -v`
Expected: FAIL with "No module named 'quantforge_strategy.composite'"

- [ ] **Step 3: 实现 CompositeStrategy**

创建 `packages/strategy-runtime/quantforge_strategy/composite.py`：

```python
"""组合策略基类 — 编排选股 + 择时 + 仓位管理"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult
from .types import StrategyState


class CompositeStrategy(ABC):
    """组合策略基类。

    接收多标的行情（dict[symbol, Bar]），编排选股、择时和仓位管理。
    由 MultiSymbolRunner 驱动，不继承单标的 Strategy。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @property
    @abstractmethod
    def state(self) -> StrategyState: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def on_bars(self, bars: dict[str, Bar], context: StrategyContext) -> None:
        """处理当前时间点的多标的行情。

        Args:
            bars: 当前时间点各标的的 Bar，key 为 symbol
            context: 策略上下文
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/test_composite.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/composite.py packages/strategy-runtime/tests/test_composite.py
git commit -m "feat(strategy-runtime): 定义 CompositeStrategy 组合策略基类"
```

---

## Task 6: 更新 strategy-runtime __init__.py 导出

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/__init__.py`
- Test: `packages/strategy-runtime/tests/test_strategy.py`（现有，验证不破坏）

- [ ] **Step 1: 修改 __init__.py 增加导出**

在 `packages/strategy-runtime/quantforge_strategy/__init__.py` 中，在 `from .strategy import Strategy` 行之后追加：

```python
# 分层策略基类
from .types import StrategyKind, Signal
from .selectors import SelectorStrategy
from .timers import TimingStrategy
from .sizers import PositionStrategy
from .composite import CompositeStrategy
```

在 `__all__` 列表中，在 `"Strategy",` 之后追加：

```python
    # 分层策略
    "StrategyKind", "Signal",
    "SelectorStrategy", "TimingStrategy", "PositionStrategy", "CompositeStrategy",
```

- [ ] **Step 2: 运行全部测试验证不破坏**

Run: `cd packages/strategy-runtime && python -m pytest tests/ -v`
Expected: PASS（所有测试通过）

- [ ] **Step 3: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/__init__.py
git commit -m "feat(strategy-runtime): 导出分层策略类型"
```

---

## Task 7: 实现 DefaultComposite

**Files:**
- Create: `packages/backtest-engine/quantforge_backtest/composite_impl.py`
- Test: `packages/backtest-engine/tests/test_composite_impl.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/backtest-engine/tests/test_composite_impl.py`：

```python
"""DefaultComposite 组合策略实现测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, StrategyState,
    Bar, TimeFrame, Signal, OrderSide, OrderType, OrderRequest,
    ResearchMode, StrategyKind,
)
from quantforge_strategy.portfolio import Account, Position
from quantforge_backtest.composite_impl import DefaultComposite


class FixedSelector(SelectorStrategy):
    """固定选股：总是返回预设股票池"""

    def __init__(self, symbols: list[str]):
        self._symbols = symbols

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_selector", description="固定选股",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return [s for s in self._symbols if s in bars]

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class AlwaysBuyTimer(TimingStrategy):
    """总是输出 Buy 信号"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="always_buy", description="总是买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        pass

    def signal(self, bar: Bar, context) -> Signal:
        return Signal.Buy

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FixedQtySizer(PositionStrategy):
    """固定数量：买入返回 100，卖出返回 0"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_qty", description="固定数量",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Buy:
            return 100.0
        return 0.0  # 卖出时清仓

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FakeContext:
    """模拟上下文，记录提交的订单"""

    def __init__(self, cash: float = 100000.0):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)
        self._positions: dict[str, Position] = {}
        self.submitted_orders: list[OrderRequest] = []

    def submit_order(self, request: OrderRequest) -> None:
        self.submitted_orders.append(request)

    def get_position(self, symbol: str):
        return self._positions.get(symbol)

    def get_all_positions(self):
        return list(self._positions.values())

    def get_account(self):
        return self._account

    def log(self, level: str, message: str, data: object = None) -> None:
        pass


def _make_bar(symbol: str, close: float = 10.0, ts: int = 0) -> Bar:
    return Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close * 1.01, low=close * 0.99,
               close=close, volume=1000)


def test_default_composite_meta():
    selector = FixedSelector(["600000"])
    timer = AlwaysBuyTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    assert composite.meta.kind == StrategyKind.Composite
    assert "fixed_selector" in composite.meta.name


def test_default_composite_buy_signal():
    selector = FixedSelector(["600000"])
    timer = AlwaysBuyTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext(cash=100000)
    composite.init(ctx)

    bar = _make_bar("600000", close=10.0)
    composite.on_bars({"600000": bar}, ctx)

    # 应提交一个买单，数量 100
    assert len(ctx.submitted_orders) == 1
    order = ctx.submitted_orders[0]
    assert order.side == OrderSide.Buy
    assert order.quantity == 100
    assert order.symbol == "600000"


def test_default_composite_hold_no_order():
    """Hold 信号不应下单"""

    class HoldTimer(TimingStrategy):
        @property
        def meta(self) -> StrategyMeta:
            return StrategyMeta(
                name="hold", description="持有",
                modes=[ResearchMode.Traditional], params=[], version="0.1.0",
                kind=StrategyKind.Timing,
            )

        def init(self, context) -> None:
            pass

        def signal(self, bar: Bar, context) -> Signal:
            return Signal.Hold

        def finish(self) -> StrategyResult:
            return StrategyResult(meta=self.meta)

    selector = FixedSelector(["600000"])
    timer = HoldTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext()
    composite.init(ctx)
    composite.on_bars({"600000": _make_bar("600000")}, ctx)

    assert len(ctx.submitted_orders) == 0


def test_default_composite_sell_reduces_position():
    """Sell 信号应清仓（sizer 返回 0）"""

    class SellTimer(TimingStrategy):
        @property
        def meta(self) -> StrategyMeta:
            return StrategyMeta(
                name="sell", description="卖出",
                modes=[ResearchMode.Traditional], params=[], version="0.1.0",
                kind=StrategyKind.Timing,
            )

        def init(self, context) -> None:
            pass

        def signal(self, bar: Bar, context) -> Signal:
            return Signal.Sell

        def finish(self) -> StrategyResult:
            return StrategyResult(meta=self.meta)

    selector = FixedSelector(["600000"])
    timer = SellTimer()
    sizer = FixedQtySizer()  # Sell 时返回 0
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext()
    # 预设持仓 100 股
    ctx._positions["600000"] = Position(
        symbol="600000", quantity=100, avg_price=10.0,
        market_value=1000, unrealized_pnl=0,
    )
    composite.init(ctx)
    composite.on_bars({"600000": _make_bar("600000")}, ctx)

    assert len(ctx.submitted_orders) == 1
    order = ctx.submitted_orders[0]
    assert order.side == OrderSide.Sell
    assert order.quantity == 100
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/backtest-engine && python -m pytest tests/test_composite_impl.py -v`
Expected: FAIL with "No module named 'quantforge_backtest.composite_impl'"

- [ ] **Step 3: 实现 DefaultComposite**

创建 `packages/backtest-engine/quantforge_backtest/composite_impl.py`：

```python
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
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/backtest-engine && python -m pytest tests/test_composite_impl.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/backtest-engine/quantforge_backtest/composite_impl.py packages/backtest-engine/tests/test_composite_impl.py
git commit -m "feat(backtest-engine): 实现 DefaultComposite 默认组合策略"
```

---

## Task 8: 实现 MultiSymbolRunner

**Files:**
- Create: `packages/backtest-engine/quantforge_backtest/multi_runner.py`
- Modify: `packages/backtest-engine/quantforge_backtest/__init__.py`
- Test: `packages/backtest-engine/tests/test_multi_runner.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/backtest-engine/tests/test_multi_runner.py`：

```python
"""MultiSymbolRunner 多标的回测测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, Bar, TimeFrame, Signal,
    ResearchMode, StrategyKind,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner
from quantforge_backtest.types import BacktestResult


class BuyAllSelector(SelectorStrategy):
    """选所有有行情的股票"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_all", description="全选",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return list(bars.keys())

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FirstBarBuyTimer(TimingStrategy):
    """第一根 bar 买入，之后 Hold"""

    def __init__(self):
        self._bought: set[str] = set()

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="first_buy", description="首日买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._bought.clear()

    def signal(self, bar: Bar, context) -> Signal:
        if bar.symbol not in self._bought:
            self._bought.add(bar.symbol)
            return Signal.Buy
        return Signal.Hold

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class SmallQtySizer(PositionStrategy):
    """买入返回 10，卖出返回 0"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="small_qty", description="小数量",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Buy:
            return 10.0
        return 0.0

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def _make_bars(symbol: str, n: int, start_price: float = 10.0) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=start_price + i * 0.1,
            high=start_price + i * 0.1 + 0.05,
            low=start_price + i * 0.1 - 0.05,
            close=start_price + i * 0.1,
            volume=1000)
        for i in range(n)
    ]


def test_multi_runner_basic():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    bars = {
        "600000": _make_bars("600000", 5, 10.0),
        "600001": _make_bars("600001", 5, 20.0),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert result.metrics.total_trades == 2  # 两只股票各买一次
    assert len(result.equity_curve) == 5


def test_multi_runner_empty_bars():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    runner = MultiSymbolRunner(
        strategy=composite, bars={}, initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 0
    assert len(result.equity_curve) == 0


def test_multi_runner_single_symbol():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 1
    assert len(result.equity_curve) == 3
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/backtest-engine && python -m pytest tests/test_multi_runner.py -v`
Expected: FAIL with "ImportError" or "No module named 'quantforge_backtest.multi_runner'"

- [ ] **Step 3: 实现 MultiSymbolRunner**

创建 `packages/backtest-engine/quantforge_backtest/multi_runner.py`：

```python
"""多标的回测运行器 — 支持组合策略"""

from __future__ import annotations

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
from .metrics import calc_metrics


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

    def run(self) -> BacktestResult:
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
        timeline = self._merge_bars()

        # 逐时间点回放
        for bars_at_ts in timeline:
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
        )

        return BacktestResult(
            config=config,
            trades=all_trades,
            equity_curve=equity_curve,
            metrics=calc_metrics(equity_curve, self.initial_cash, len(all_trades)),
        )
```

- [ ] **Step 4: 修改 backtest-engine __init__.py 导出**

在 `packages/backtest-engine/quantforge_backtest/__init__.py` 中，在 `from .runner import BacktestRunner` 之后追加：

```python
from .composite_impl import DefaultComposite
from .multi_runner import MultiSymbolRunner
```

在 `__all__` 列表末尾追加：

```python
    "DefaultComposite", "MultiSymbolRunner",
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd packages/backtest-engine && python -m pytest tests/test_multi_runner.py -v`
Expected: PASS

- [ ] **Step 6: 运行全部回测引擎测试验证不破坏**

Run: `cd packages/backtest-engine && python -m pytest tests/ -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backtest-engine/quantforge_backtest/multi_runner.py packages/backtest-engine/quantforge_backtest/__init__.py packages/backtest-engine/tests/test_multi_runner.py
git commit -m "feat(backtest-engine): 实现 MultiSymbolRunner 多标的回测运行器"
```

---

## Task 9: 实现 MomentumSelector 动量选股策略

**Files:**
- Create: `packages/strategies/quantforge_strategies/momentum_selector.py`
- Test: `packages/strategies/tests/test_momentum_selector.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategies/tests/test_momentum_selector.py`：

```python
"""动量选股策略测试"""

from quantforge_strategies.momentum_selector import MomentumSelector
from quantforge_strategy import Bar, TimeFrame, StrategyKind


def _make_bar(symbol: str, close: float, ts: int) -> Bar:
    return Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close, low=close, close=close, volume=1000)


def test_meta():
    s = MomentumSelector(lookback=5, top_k=3)
    assert s.meta.name == "momentum_selector"
    assert s.meta.kind == StrategyKind.Select
    assert len(s.meta.params) == 2


def test_init():
    s = MomentumSelector(lookback=10, top_k=2)
    s.init(None)
    assert s._lookback == 10
    assert s._top_k == 2


def test_select_insufficient_history():
    """历史不足时返回空列表"""
    s = MomentumSelector(lookback=5, top_k=3)
    s.init(None)

    bars = {"600000": _make_bar("600000", 10.0, 0)}
    result = s.select(bars, None)
    assert result == []


def test_select_top_k():
    """选出动量最高的 top_k 只股票"""
    s = MomentumSelector(lookback=3, top_k=2)
    s.init(None)

    # 构造 3 只股票，各 3 根 bar
    # 600000: 10 -> 12 -> 15  (涨幅 50%)
    # 600001: 20 -> 21 -> 22  (涨幅 10%)
    # 600002: 30 -> 28 -> 25  (跌幅 -17%)
    for ts in range(3):
        bars = {
            "600000": _make_bar("600000", [10, 12, 15][ts], ts),
            "600001": _make_bar("600001", [20, 21, 22][ts], ts),
            "600002": _make_bar("600002", [30, 28, 25][ts], ts),
        }
        result = s.select(bars, None)

    # 动量排名: 600000 (50%) > 600001 (10%) > 600002 (-17%)
    # top_k=2 → 600000, 600001
    assert result == ["600000", "600001"]


def test_select_fewer_than_top_k():
    """候选股票少于 top_k 时返回全部"""
    s = MomentumSelector(lookback=2, top_k=5)
    s.init(None)

    for ts in range(2):
        bars = {
            "600000": _make_bar("600000", 10 + ts, ts),
        }
        result = s.select(bars, None)

    assert result == ["600000"]
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategies && python -m pytest tests/test_momentum_selector.py -v`
Expected: FAIL with "No module named 'quantforge_strategies.momentum_selector'"

- [ ] **Step 3: 实现 MomentumSelector**

创建 `packages/strategies/quantforge_strategies/momentum_selector.py`：

```python
"""动量选股策略 — 选过去 N 日涨幅最大的 K 只股票"""

from __future__ import annotations

from quantforge_strategy import (
    SelectorStrategy, StrategyMeta, StrategyResult,
    Bar, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class MomentumSelector(SelectorStrategy):
    """动量选股策略。

    在每个调仓点，计算各标的过去 lookback 根 bar 的涨幅，
    选出涨幅最高的 top_k 只股票。
    """

    def __init__(self, lookback: int = 20, top_k: int = 5) -> None:
        self._lookback = lookback
        self._top_k = top_k
        self._history: dict[str, list[Bar]] = {}

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="momentum_selector",
            description="动量选股策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="lookback", label="回看周期",
                                 type=ParamType.Number, default=self._lookback,
                                 min=2, max=100),
                StrategyParamDef(key="top_k", label="选股数量",
                                 type=ParamType.Number, default=self._top_k,
                                 min=1, max=50),
            ],
            version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        self._history.clear()

    def select(self, bars: dict[str, Bar], context) -> list[str]:
        # 累积历史
        for symbol, bar in bars.items():
            if symbol not in self._history:
                self._history[symbol] = []
            self._history[symbol].append(bar)

        # 计算动量（过去 lookback 根 bar 的涨幅）
        momentum: dict[str, float] = {}
        for symbol, history in self._history.items():
            if len(history) >= self._lookback:
                start_price = history[-self._lookback].close
                current_price = history[-1].close
                if start_price > 0:
                    momentum[symbol] = (current_price - start_price) / start_price

        if not momentum:
            return []

        # 按动量降序排列，取 top_k
        sorted_symbols = sorted(momentum.items(), key=lambda x: x[1], reverse=True)
        return [s for s, _ in sorted_symbols[:self._top_k]]

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategies && python -m pytest tests/test_momentum_selector.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategies/quantforge_strategies/momentum_selector.py packages/strategies/tests/test_momentum_selector.py
git commit -m "feat(strategies): 实现 MomentumSelector 动量选股策略"
```

---

## Task 10: 实现 MACrossoverTiming 均线交叉择时策略

**Files:**
- Create: `packages/strategies/quantforge_strategies/ma_crossover_timing.py`
- Test: `packages/strategies/tests/test_ma_crossover_timing.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategies/tests/test_ma_crossover_timing.py`：

```python
"""均线交叉择时策略测试"""

from quantforge_strategies.ma_crossover_timing import MACrossoverTiming
from quantforge_strategy import Bar, TimeFrame, Signal, StrategyKind


def _make_bar(close: float, ts: int) -> Bar:
    return Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close, low=close, close=close, volume=1000)


def test_meta():
    t = MACrossoverTiming(short_period=5, long_period=20)
    assert t.meta.name == "ma_crossover"
    assert t.meta.kind == StrategyKind.Timing
    assert len(t.meta.params) == 2


def test_init():
    t = MACrossoverTiming(short_period=3, long_period=5)
    t.init(None)
    assert t._short_period == 3
    assert t._long_period == 5


def test_hold_when_insufficient_data():
    """数据不足时返回 Hold"""
    t = MACrossoverTiming(short_period=3, long_period=5)
    t.init(None)

    bar = _make_bar(10.0, 0)
    assert t.signal(bar, None) == Signal.Hold


def test_buy_on_golden_cross():
    """金叉买入"""
    t = MACrossoverTiming(short_period=2, long_period=4)
    t.init(None)

    # 价格序列: 10, 10, 10, 10, 15（第 5 根时短均线上穿长均线）
    prices = [10.0, 10.0, 10.0, 10.0, 15.0]
    result = None
    for i, p in enumerate(prices):
        result = t.signal(_make_bar(p, i), None)

    assert result == Signal.Buy


def test_hold_when_no_cross():
    """无新交叉时 Hold"""
    t = MACrossoverTiming(short_period=2, long_period=4)
    t.init(None)

    # 持续上涨，第一次金叉后无新交叉
    prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    last_signal = None
    for i, p in enumerate(prices):
        last_signal = t.signal(_make_bar(p, i), None)

    # 第一次满足条件时是 Buy（金叉），之后持续 Hold
    assert last_signal == Signal.Hold
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategies && python -m pytest tests/test_ma_crossover_timing.py -v`
Expected: FAIL with "No module named 'quantforge_strategies.ma_crossover_timing'"

- [ ] **Step 3: 实现 MACrossoverTiming**

创建 `packages/strategies/quantforge_strategies/ma_crossover_timing.py`：

```python
"""均线交叉择时策略 — 短均线上穿长均线买入，下穿卖出"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class MACrossoverTiming(TimingStrategy):
    """均线交叉择时策略。

    短均线上穿长均线（金叉）输出 Buy，
    短均线下穿长均线（死叉）输出 Sell，
    其他情况输出 Hold。
    """

    def __init__(self, short_period: int = 5, long_period: int = 20) -> None:
        self._short_period = short_period
        self._long_period = long_period
        self._prices: deque[float] = deque(maxlen=long_period + 1)
        self._prev_short_above: bool | None = None

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="ma_crossover",
            description="均线交叉择时策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="short_period", label="短均线周期",
                                 type=ParamType.Number, default=self._short_period,
                                 min=2, max=50),
                StrategyParamDef(key="long_period", label="长均线周期",
                                 type=ParamType.Number, default=self._long_period,
                                 min=5, max=200),
            ],
            version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._prices.clear()
        self._prev_short_above = None

    def signal(self, bar: Bar, context) -> Signal:
        self._prices.append(bar.close)

        if len(self._prices) < self._long_period:
            return Signal.Hold

        prices = list(self._prices)
        short_ma = sum(prices[-self._short_period:]) / self._short_period
        long_ma = sum(prices[-self._long_period:]) / self._long_period
        short_above = short_ma > long_ma

        result = Signal.Hold

        if self._prev_short_above is not None:
            if short_above and not self._prev_short_above:
                result = Signal.Buy
            elif not short_above and self._prev_short_above:
                result = Signal.Sell

        self._prev_short_above = short_above
        return result

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategies && python -m pytest tests/test_ma_crossover_timing.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategies/quantforge_strategies/ma_crossover_timing.py packages/strategies/tests/test_ma_crossover_timing.py
git commit -m "feat(strategies): 实现 MACrossoverTiming 均线交叉择时策略"
```

---

## Task 11: 实现 EqualWeightSizer 等权仓位策略

**Files:**
- Create: `packages/strategies/quantforge_strategies/equal_weight_sizer.py`
- Test: `packages/strategies/tests/test_equal_weight_sizer.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategies/tests/test_equal_weight_sizer.py`：

```python
"""等权仓位策略测试"""

from quantforge_strategies.equal_weight_sizer import EqualWeightSizer
from quantforge_strategy import Signal, StrategyKind
from quantforge_strategy.portfolio import Account


class FakeContext:
    def __init__(self, cash: float):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)

    def get_account(self):
        return self._account


def test_meta():
    s = EqualWeightSizer(max_positions=5)
    assert s.meta.name == "equal_weight"
    assert s.meta.kind == StrategyKind.Position
    assert len(s.meta.params) == 1


def test_init():
    s = EqualWeightSizer(max_positions=10)
    s.init(None)
    assert s._max_positions == 10


def test_size_buy():
    """买入时按等权分配资金"""
    s = EqualWeightSizer(max_positions=5)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 / 5 = 20000 per stock, price=10 → 2000 shares
    qty = s.size("600000", Signal.Buy, 10.0, ctx)
    assert qty == 2000


def test_size_sell():
    """卖出时目标数量为 0（清仓）"""
    s = EqualWeightSizer(max_positions=5)
    s.init(None)

    ctx = FakeContext(cash=100000)
    qty = s.size("600000", Signal.Sell, 10.0, ctx)
    assert qty == 0.0


def test_size_with_different_max_positions():
    s = EqualWeightSizer(max_positions=2)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 / 2 = 50000 per stock, price=20 → 2500 shares
    qty = s.size("600000", Signal.Buy, 20.0, ctx)
    assert qty == 2500
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategies && python -m pytest tests/test_equal_weight_sizer.py -v`
Expected: FAIL with "No module named 'quantforge_strategies.equal_weight_sizer'"

- [ ] **Step 3: 实现 EqualWeightSizer**

创建 `packages/strategies/quantforge_strategies/equal_weight_sizer.py`：

```python
"""等权仓位策略 — 每只股票分配相等的资金"""

from __future__ import annotations

from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class EqualWeightSizer(PositionStrategy):
    """等权仓位策略。

    买入时：将总资金按 max_positions 等分，每只股票分配 1/max_positions 的资金。
    卖出时：目标数量为 0（清仓）。
    """

    def __init__(self, max_positions: int = 5) -> None:
        self._max_positions = max_positions

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="equal_weight",
            description="等权仓位策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="max_positions", label="最大持仓数",
                                 type=ParamType.Number, default=self._max_positions,
                                 min=1, max=50),
            ],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Sell:
            return 0.0

        account = context.get_account()
        per_stock_cash = account.equity / self._max_positions
        return int(per_stock_cash / price)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategies && python -m pytest tests/test_equal_weight_sizer.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategies/quantforge_strategies/equal_weight_sizer.py packages/strategies/tests/test_equal_weight_sizer.py
git commit -m "feat(strategies): 实现 EqualWeightSizer 等权仓位策略"
```

---

## Task 12: 实现 FixedFractionSizer 固定比例仓位策略

**Files:**
- Create: `packages/strategies/quantforge_strategies/fixed_fraction_sizer.py`
- Test: `packages/strategies/tests/test_fixed_fraction_sizer.py`

- [ ] **Step 1: 编写失败测试**

创建 `packages/strategies/tests/test_fixed_fraction_sizer.py`：

```python
"""固定比例仓位策略测试"""

from quantforge_strategies.fixed_fraction_sizer import FixedFractionSizer
from quantforge_strategy import Signal, StrategyKind
from quantforge_strategy.portfolio import Account


class FakeContext:
    def __init__(self, cash: float):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)

    def get_account(self):
        return self._account


def test_meta():
    s = FixedFractionSizer(fraction=0.1)
    assert s.meta.name == "fixed_fraction"
    assert s.meta.kind == StrategyKind.Position
    assert len(s.meta.params) == 1


def test_init():
    s = FixedFractionSizer(fraction=0.2)
    s.init(None)
    assert s._fraction == 0.2


def test_size_buy():
    """买入时按固定比例分配资金"""
    s = FixedFractionSizer(fraction=0.1)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 * 0.1 = 10000, price=10 → 1000 shares
    qty = s.size("600000", Signal.Buy, 10.0, ctx)
    assert qty == 1000


def test_size_sell():
    """卖出时目标数量为 0"""
    s = FixedFractionSizer(fraction=0.1)
    s.init(None)

    ctx = FakeContext(cash=100000)
    qty = s.size("600000", Signal.Sell, 10.0, ctx)
    assert qty == 0.0


def test_size_different_fraction():
    s = FixedFractionSizer(fraction=0.25)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 * 0.25 = 25000, price=20 → 1250 shares
    qty = s.size("600000", Signal.Buy, 20.0, ctx)
    assert qty == 1250
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/strategies && python -m pytest tests/test_fixed_fraction_sizer.py -v`
Expected: FAIL with "No module named 'quantforge_strategies.fixed_fraction_sizer'"

- [ ] **Step 3: 实现 FixedFractionSizer**

创建 `packages/strategies/quantforge_strategies/fixed_fraction_sizer.py`：

```python
"""固定比例仓位策略 — 每次买入使用总资金的固定比例"""

from __future__ import annotations

from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class FixedFractionSizer(PositionStrategy):
    """固定比例仓位策略。

    买入时：使用总资金的 fraction 比例买入。
    卖出时：目标数量为 0（清仓）。
    """

    def __init__(self, fraction: float = 0.1) -> None:
        self._fraction = fraction

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_fraction",
            description="固定比例仓位策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="fraction", label="资金比例",
                                 type=ParamType.Number, default=self._fraction,
                                 min=0.01, max=1.0),
            ],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Sell:
            return 0.0

        account = context.get_account()
        allocated = account.equity * self._fraction
        return int(allocated / price)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd packages/strategies && python -m pytest tests/test_fixed_fraction_sizer.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/strategies/quantforge_strategies/fixed_fraction_sizer.py packages/strategies/tests/test_fixed_fraction_sizer.py
git commit -m "feat(strategies): 实现 FixedFractionSizer 固定比例仓位策略"
```

---

## Task 13: 更新 strategies __init__.py 注册新策略

**Files:**
- Modify: `packages/strategies/quantforge_strategies/__init__.py`
- Test: `packages/strategies/tests/test_registry.py`（现有，验证不破坏）

- [ ] **Step 1: 修改 __init__.py 增加导出和注册**

将 `packages/strategies/quantforge_strategies/__init__.py` 修改为：

```python
"""QuantForge 策略库"""

__version__ = "0.1.0"

from .dual_ma import DualMAStrategy
from .rsi import RSIStrategy
from .bollinger_band import BollingerBandStrategy
from .momentum_selector import MomentumSelector
from .ma_crossover_timing import MACrossoverTiming
from .equal_weight_sizer import EqualWeightSizer
from .fixed_fraction_sizer import FixedFractionSizer
from .registry import register, get, list_all

# 自动注册内置策略
register("dual_ma", DualMAStrategy)
register("rsi", RSIStrategy)
register("bollinger_band", BollingerBandStrategy)
register("momentum_selector", MomentumSelector)
register("ma_crossover", MACrossoverTiming)
register("equal_weight", EqualWeightSizer)
register("fixed_fraction", FixedFractionSizer)

__all__ = [
    "DualMAStrategy", "RSIStrategy", "BollingerBandStrategy",
    "MomentumSelector", "MACrossoverTiming",
    "EqualWeightSizer", "FixedFractionSizer",
    "register", "get", "list_all",
]
```

- [ ] **Step 2: 运行全部策略库测试验证不破坏**

Run: `cd packages/strategies && python -m pytest tests/ -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/strategies/quantforge_strategies/__init__.py
git commit -m "feat(strategies): 注册分层策略到策略库"
```

---

## Task 14: 端到端集成测试

**Files:**
- Create: `packages/backtest-engine/tests/test_e2e_composite.py`

- [ ] **Step 1: 编写端到端测试**

创建 `packages/backtest-engine/tests/test_e2e_composite.py`：

```python
"""端到端集成测试：选股 + 择时 + 仓位管理 → 多标的回测"""

from quantforge_strategy import Bar, TimeFrame, Signal, StrategyKind
from quantforge_strategies import (
    MomentumSelector, MACrossoverTiming, EqualWeightSizer,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner
from quantforge_backtest.types import BacktestResult


def _make_bars(symbol: str, prices: list[float]) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


def test_e2e_momentum_ma_crossover_equal_weight():
    """动量选股 + 均线交叉择时 + 等权仓位 → 完整回测"""
    selector = MomentumSelector(lookback=3, top_k=2)
    timer = MACrossoverTiming(short_period=2, long_period=4)
    sizer = EqualWeightSizer(max_positions=2)
    composite = DefaultComposite(selector, timer, sizer)

    # 3 只股票，各 10 根 bar
    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
        "600001": _make_bars("600001", [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]),
        "600002": _make_bars("600002", [30, 30, 30, 30, 35, 36, 37, 38, 39, 40]),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 10
    # 应有交易产生
    assert result.metrics.total_trades > 0


def test_e2e_single_symbol_composite():
    """单标的组合策略回测"""
    selector = MomentumSelector(lookback=2, top_k=1)
    timer = MACrossoverTiming(short_period=2, long_period=3)
    sizer = EqualWeightSizer(max_positions=1)
    composite = DefaultComposite(selector, timer, sizer)

    bars = {
        "600000": _make_bars("600000", [10, 10, 10, 15, 16, 17, 18, 19]),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 8
```

- [ ] **Step 2: 运行端到端测试**

Run: `cd packages/backtest-engine && python -m pytest tests/test_e2e_composite.py -v`
Expected: PASS

- [ ] **Step 3: 运行所有包的测试验证整体不破坏**

Run:
```bash
cd packages/strategy-runtime && python -m pytest tests/ -v
cd ../backtest-engine && python -m pytest tests/ -v
cd ../strategies && python -m pytest tests/ -v
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backtest-engine/tests/test_e2e_composite.py
git commit -m "test(backtest-engine): 增加分层策略端到端集成测试"
```

---

## 方案自检

### 规格覆盖

| 需求 | 对应 Task |
|------|-----------|
| 选股策略独立开发 | Task 2（基类）, Task 9（实现） |
| 择时策略独立开发 | Task 3（基类）, Task 10（实现） |
| 仓位管理策略独立开发 | Task 4（基类）, Task 11-12（实现） |
| 三者组合编排 | Task 5（基类）, Task 7（DefaultComposite） |
| 多标的回测 | Task 8（MultiSymbolRunner） |
| 端到端验证 | Task 14 |
| 向后兼容 | 现有 Strategy/BacktestRunner 不变，kind 有默认值 |

### 类型一致性检查

- `Signal.Buy/Sell/Hold` — 在 types.py 定义，所有后续 Task 使用一致
- `StrategyKind.Select/Timing/Position/Composite` — 在 types.py 定义，所有 meta 使用一致
- `SelectorStrategy.select(bars, context) → list[str]` — Task 2 定义，Task 7/9 使用一致
- `TimingStrategy.signal(bar, context) → Signal` — Task 3 定义，Task 7/10 使用一致
- `PositionStrategy.size(symbol, signal, price, context) → float` — Task 4 定义，Task 7/11/12 使用一致
- `CompositeStrategy.on_bars(bars, context)` — Task 5 定义，Task 7/8 使用一致
- `DefaultComposite(selector, timer, sizer)` — Task 7 定义，Task 8/14 使用一致
- `MultiSymbolRunner(strategy, bars, initial_cash, slippage)` — Task 8 定义，Task 14 使用一致

### 仓位约定一致性

- Buy 信号：`sizer.size` 返回"目标总数量"，`DefaultComposite` 买入 `target - current` 的差额
- Sell 信号：`sizer.size` 返回"剩余目标数量"（0 = 清仓），`DefaultComposite` 卖出 `current - target` 的差额
- EqualWeightSizer 和 FixedFractionSizer 在 Sell 时返回 0（清仓），与约定一致

---

# 补充：多策略组合（Portfolio）与目录重构

## 补充设计说明

### 两种组合的区别

| 类型 | 说明 | 对应组件 |
|------|------|----------|
| **分层组合**（已覆盖） | 选股 + 择时 + 仓位管理 三层组装成一个完整策略 | `CompositeStrategy` / `DefaultComposite` |
| **多策略组合**（Portfolio，本次补充） | 多个独立策略各自运行，按资金权重分配，合并整体收益 | `PortfolioStrategy` / `MultiStrategyRunner` |

### 多策略组合数据流

```
MultiStrategyRunner
  ├─ 子策略A (weight=0.5) → initial_cash * 0.5 → 独立回测 → ResultA
  ├─ 子策略B (weight=0.3) → initial_cash * 0.3 → 独立回测 → ResultB
  └─ 子策略C (weight=0.2) → initial_cash * 0.2 → 独立回测 → ResultC
  └─ 按时间戳合并三条权益曲线 → 合并 Result
```

子策略可以是 `Strategy`（单标的，用 `BacktestRunner`）或 `CompositeStrategy`（多标的，用 `MultiSymbolRunner`），各自独立运行互不干扰。

### 目录重构方案

将 `packages/strategies/quantforge_strategies/` 从平铺改为按类型分子目录：

```
packages/strategies/quantforge_strategies/
  __init__.py          # 统一导出 + 注册
  registry.py          # 注册表（不变）
  combined/            # 传统单标的策略（现有三个迁移至此）
    __init__.py
    dual_ma.py
    rsi.py
    bollinger_band.py
  selectors/           # 选股策略
    __init__.py
    momentum.py
  timers/              # 择时策略
    __init__.py
    ma_crossover.py
  sizers/              # 仓位管理策略
    __init__.py
    equal_weight.py
    fixed_fraction.py
```

> 注意：`portfolios/` 目录暂不需要。多策略组合是回测引擎的编排能力（`MultiStrategyRunner`），不是策略库里的具体策略。若未来有预定义组合配置，再增加该目录。

### 补充类型归属

| 类型 | 所有者 |
|------|--------|
| `StrategyKind.Portfolio`, `PortfolioStrategy` | strategy-runtime |
| `MultiStrategyRunner` | backtest-engine |

---

## Task 15: 实现 MultiStrategyRunner（多策略资金分配组合）

**Files:**
- Create: `packages/backtest-engine/quantforge_backtest/multi_strategy_runner.py`
- Modify: `packages/backtest-engine/quantforge_backtest/__init__.py`
- Test: `packages/backtest-engine/tests/test_multi_strategy_runner.py`

**设计说明：** `MultiSymbolRunner` 接收多个 `(CompositeStrategy, weight)` 组合，为每个子策略分配 `initial_cash * weight` 的资金，各自独立运行（复用 `MultiSymbolRunner`），最后按时间戳合并权益曲线、合并成交、重新计算指标。不新增 ABC，组合逻辑完全在 Runner 层。

- [ ] **Step 1: 编写失败测试**

创建 `packages/backtest-engine/tests/test_multi_strategy_runner.py`：

```python
"""MultiStrategyRunner 多策略组合测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, Bar, TimeFrame, Signal,
    ResearchMode, StrategyKind,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner, MultiStrategyRunner
from quantforge_backtest.types import BacktestResult


class BuyAllSelector(SelectorStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_all", description="全选",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return list(bars.keys())

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FirstBarBuyTimer(TimingStrategy):
    def __init__(self):
        self._bought: set[str] = set()

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="first_buy", description="首日买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._bought.clear()

    def signal(self, bar: Bar, context) -> Signal:
        if bar.symbol not in self._bought:
            self._bought.add(bar.symbol)
            return Signal.Buy
        return Signal.Hold

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class SmallQtySizer(PositionStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="small_qty", description="小数量",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Buy:
            return 10.0
        return 0.0

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def _make_bars(symbol: str, n: int, start_price: float = 10.0) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=start_price + i * 0.1,
            high=start_price + i * 0.1 + 0.05,
            low=start_price + i * 0.1 - 0.05,
            close=start_price + i * 0.1,
            volume=1000)
        for i in range(n)
    ]


def _make_composite(name: str) -> DefaultComposite:
    return DefaultComposite(BuyAllSelector(), FirstBarBuyTimer(), SmallQtySizer())


def test_multi_strategy_runner_basic():
    """两个子策略按权重分配资金"""
    strategy_a = _make_composite("a")
    strategy_b = _make_composite("b")

    bars = {
        "600000": _make_bars("600000", 5, 10.0),
        "600001": _make_bars("600001", 5, 20.0),
    }

    runner = MultiStrategyRunner(
        strategies=[(strategy_a, 0.6), (strategy_b, 0.4)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    # 两个子策略各买 2 只股票 = 4 笔交易
    assert result.metrics.total_trades == 4
    assert len(result.equity_curve) == 5


def test_multi_strategy_runner_single():
    """单个子策略等价于直接运行"""
    strategy = _make_composite("only")

    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiStrategyRunner(
        strategies=[(strategy, 1.0)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 1
    assert len(result.equity_curve) == 3


def test_multi_strategy_runner_empty():
    """空策略列表"""
    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiStrategyRunner(
        strategies=[],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 0
    assert len(result.equity_curve) == 0
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd packages/backtest-engine && python -m pytest tests/test_multi_strategy_runner.py -v`
Expected: FAIL with "ImportError" or "No module named 'quantforge_backtest.multi_strategy_runner'"

- [ ] **Step 3: 实现 MultiStrategyRunner**

创建 `packages/backtest-engine/quantforge_backtest/multi_strategy_runner.py`：

```python
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
from .metrics import calc_metrics


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

        return BacktestResult(
            config=config,
            trades=all_trades,
            equity_curve=merged_equity,
            metrics=calc_metrics(merged_equity, self.initial_cash, len(all_trades)),
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
```

- [ ] **Step 4: 修改 backtest-engine __init__.py 导出**

在 `packages/backtest-engine/quantforge_backtest/__init__.py` 中，在 `from .multi_runner import MultiSymbolRunner` 之后追加：

```python
from .multi_strategy_runner import MultiStrategyRunner
```

在 `__all__` 列表中追加：

```python
    "MultiStrategyRunner",
```

- [ ] **Step 5: 运行测试验证通过**

Run: `cd packages/backtest-engine && python -m pytest tests/test_multi_strategy_runner.py -v`
Expected: PASS

- [ ] **Step 6: 运行全部回测引擎测试验证不破坏**

Run: `cd packages/backtest-engine && python -m pytest tests/ -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/backtest-engine/quantforge_backtest/multi_strategy_runner.py packages/backtest-engine/quantforge_backtest/__init__.py packages/backtest-engine/tests/test_multi_strategy_runner.py
git commit -m "feat(backtest-engine): 实现 MultiStrategyRunner 多策略资金分配组合"
```

---

## Task 16: 目录重构（按类型分子目录）

**Files:**
- Create: `packages/strategies/quantforge_strategies/combined/__init__.py`
- Move: `packages/strategies/quantforge_strategies/dual_ma.py` → `combined/dual_ma.py`
- Move: `packages/strategies/quantforge_strategies/rsi.py` → `combined/rsi.py`
- Move: `packages/strategies/quantforge_strategies/bollinger_band.py` → `combined/bollinger_band.py`
- Move: `packages/strategies/quantforge_strategies/momentum_selector.py` → `selectors/momentum.py`
- Move: `packages/strategies/quantforge_strategies/ma_crossover_timing.py` → `timers/ma_crossover.py`
- Move: `packages/strategies/quantforge_strategies/equal_weight_sizer.py` → `sizers/equal_weight.py`
- Move: `packages/strategies/quantforge_strategies/fixed_fraction_sizer.py` → `sizers/fixed_fraction.py`
- Create: `packages/strategies/quantforge_strategies/selectors/__init__.py`
- Create: `packages/strategies/quantforge_strategies/timers/__init__.py`
- Create: `packages/strategies/quantforge_strategies/sizers/__init__.py`
- Modify: `packages/strategies/quantforge_strategies/__init__.py`
- Modify: 各测试文件的 import 路径

**说明：** 此 Task 在 Task 9-12 完成后执行，将所有策略文件从平铺迁移到按类型分子目录。文件内容不变，只调整位置和 import 路径。

- [ ] **Step 1: 创建子目录和 __init__.py**

创建以下文件（内容均为空或仅含 docstring）：

`packages/strategies/quantforge_strategies/combined/__init__.py`:
```python
"""传统单标的策略"""
```

`packages/strategies/quantforge_strategies/selectors/__init__.py`:
```python
"""选股策略"""
```

`packages/strategies/quantforge_strategies/timers/__init__.py`:
```python
"""择时策略"""
```

`packages/strategies/quantforge_strategies/sizers/__init__.py`:
```python
"""仓位管理策略"""
```

- [ ] **Step 2: 迁移现有策略文件**

用 `git mv` 迁移文件（保留 git 历史）：

```bash
cd packages/strategies/quantforge_strategies
git mv dual_ma.py combined/dual_ma.py
git mv rsi.py combined/rsi.py
git mv bollinger_band.py combined/bollinger_band.py
git mv momentum_selector.py selectors/momentum.py
git mv ma_crossover_timing.py timers/ma_crossover.py
git mv equal_weight_sizer.py sizers/equal_weight.py
git mv fixed_fraction_sizer.py sizers/fixed_fraction.py
```

- [ ] **Step 3: 更新 __init__.py 导入路径**

将 `packages/strategies/quantforge_strategies/__init__.py` 修改为：

```python
"""QuantForge 策略库"""

__version__ = "0.1.0"

from .combined.dual_ma import DualMAStrategy
from .combined.rsi import RSIStrategy
from .combined.bollinger_band import BollingerBandStrategy
from .selectors.momentum import MomentumSelector
from .timers.ma_crossover import MACrossoverTiming
from .sizers.equal_weight import EqualWeightSizer
from .sizers.fixed_fraction import FixedFractionSizer
from .registry import register, get, list_all

# 自动注册内置策略
register("dual_ma", DualMAStrategy)
register("rsi", RSIStrategy)
register("bollinger_band", BollingerBandStrategy)
register("momentum_selector", MomentumSelector)
register("ma_crossover", MACrossoverTiming)
register("equal_weight", EqualWeightSizer)
register("fixed_fraction", FixedFractionSizer)

__all__ = [
    "DualMAStrategy", "RSIStrategy", "BollingerBandStrategy",
    "MomentumSelector", "MACrossoverTiming",
    "EqualWeightSizer", "FixedFractionSizer",
    "register", "get", "list_all",
]
```

- [ ] **Step 4: 更新测试文件的 import 路径**

修改以下测试文件中的 import：

`tests/test_dual_ma.py`:
```python
from quantforge_strategies.combined.dual_ma import DualMAStrategy
```

`tests/test_rsi.py`（如有）:
```python
from quantforge_strategies.combined.rsi import RSIStrategy
```

`tests/test_bollinger_band.py`:
```python
from quantforge_strategies.combined.bollinger_band import BollingerBandStrategy
```

`tests/test_momentum_selector.py`:
```python
from quantforge_strategies.selectors.momentum import MomentumSelector
```

`tests/test_ma_crossover_timing.py`:
```python
from quantforge_strategies.timers.ma_crossover import MACrossoverTiming
```

`tests/test_equal_weight_sizer.py`:
```python
from quantforge_strategies.sizers.equal_weight import EqualWeightSizer
```

`tests/test_fixed_fraction_sizer.py`:
```python
from quantforge_strategies.sizers.fixed_fraction import FixedFractionSizer
```

- [ ] **Step 5: 运行全部策略库测试验证**

Run: `cd packages/strategies && python -m pytest tests/ -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/strategies/quantforge_strategies/
git commit -m "refactor(strategies): 按类型分子目录组织策略文件"
```

---

## Task 17: 多策略组合端到端集成测试

**Files:**
- Create: `packages/backtest-engine/tests/test_e2e_portfolio.py`

- [ ] **Step 1: 编写端到端测试**

创建 `packages/backtest-engine/tests/test_e2e_portfolio.py`：

```python
"""端到端集成测试：多策略组合（Portfolio）资金分配"""

from quantforge_strategy import Bar, TimeFrame
from quantforge_strategies import (
    MomentumSelector, MACrossoverTiming, EqualWeightSizer, FixedFractionSizer,
)
from quantforge_backtest import DefaultComposite, MultiStrategyRunner
from quantforge_backtest.types import BacktestResult


def _make_bars(symbol: str, prices: list[float]) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


def test_e2e_portfolio_two_composites():
    """两个分层组合策略按 60/40 权重组合"""
    # 组合A：动量选股 + 均线择时 + 等权仓位
    composite_a = DefaultComposite(
        MomentumSelector(lookback=3, top_k=2),
        MACrossoverTiming(short_period=2, long_period=4),
        EqualWeightSizer(max_positions=2),
    )

    # 组合B：动量选股 + 均线择时 + 固定比例仓位
    composite_b = DefaultComposite(
        MomentumSelector(lookback=3, top_k=2),
        MACrossoverTiming(short_period=2, long_period=4),
        FixedFractionSizer(fraction=0.3, max_positions=2),
    )

    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
        "600001": _make_bars("600001", [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]),
        "600002": _make_bars("600002", [30, 30, 30, 30, 35, 36, 37, 38, 39, 40]),
    }

    runner = MultiStrategyRunner(
        strategies=[(composite_a, 0.6), (composite_b, 0.4)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 10
    # 两个子策略各自产生交易
    assert result.metrics.total_trades > 0
    # 合并权益应接近初始资金 + 浮动盈亏
    assert result.equity_curve[0].equity > 0


def test_e2e_portfolio_single_equivalent():
    """单策略权重 1.0 等价于直接运行"""
    composite = DefaultComposite(
        MomentumSelector(lookback=2, top_k=1),
        MACrossoverTiming(short_period=2, long_period=3),
        EqualWeightSizer(max_positions=1),
    )

    bars = {"600000": _make_bars("600000", [10, 11, 12, 13, 14])}

    runner = MultiStrategyRunner(
        strategies=[(composite, 1.0)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 5
    assert result.metrics.total_trades > 0


def test_e2e_portfolio_three_strategies():
    """三个分层组合策略按 40/30/30 权重组合"""
    configs = [
        (MomentumSelector(lookback=2, top_k=2), 0.4),
        (MomentumSelector(lookback=3, top_k=2), 0.3),
        (MomentumSelector(lookback=4, top_k=2), 0.3),
    ]

    composites = [
        DefaultComposite(
            sel, MACrossoverTiming(short_period=2, long_period=3),
            EqualWeightSizer(max_positions=2),
        )
        for sel, _ in configs
    ]

    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17]),
        "600001": _make_bars("600001", [20, 21, 22, 23, 24, 25, 26, 27]),
        "600002": _make_bars("600002", [30, 29, 28, 27, 26, 25, 24, 23]),
    }

    runner = MultiStrategyRunner(
        strategies=[(c, w) for c, (_, w) in zip(composites, configs)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 8
    assert result.metrics.total_trades > 0
```

- [ ] **Step 2: 运行端到端测试**

Run: `cd packages/backtest-engine && python -m pytest tests/test_e2e_portfolio.py -v`
Expected: PASS

- [ ] **Step 3: 运行所有包的测试验证整体不破坏**

Run:
```bash
cd packages/strategy-runtime && python -m pytest tests/ -v
cd ../backtest-engine && python -m pytest tests/ -v
cd ../strategies && python -m pytest tests/ -v
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/backtest-engine/tests/test_e2e_portfolio.py
git commit -m "test(backtest-engine): 增加多策略组合端到端集成测试"
```

---

## 补充方案自检

### 规格覆盖（更新）

| 需求 | 对应 Task |
|------|-----------|
| 选股策略独立开发 | Task 2（基类）, Task 9（实现） |
| 择时策略独立开发 | Task 3（基类）, Task 10（实现） |
| 仓位管理策略独立开发 | Task 4（基类）, Task 11-12（实现） |
| 三者分层组合编排 | Task 5（基类）, Task 7（DefaultComposite） |
| 多标的回测 | Task 8（MultiSymbolRunner） |
| **多策略资金分配组合** | **Task 15（MultiStrategyRunner）** |
| **策略按类型分子目录** | **Task 16（目录重构）** |
| 端到端验证（分层组合） | Task 14 |
| **端到端验证（多策略组合）** | **Task 17** |
| 向后兼容 | 现有 Strategy/BacktestRunner 不变，kind 有默认值 |

### 类型一致性检查（补充）

- `MultiStrategyRunner(strategies, bars, initial_cash, slippage)` — Task 15 定义，Task 17 使用一致
- `strategies: list[tuple[CompositeStrategy, float]]` — 权重为 float，总和应 ≤ 1.0
- 合并权益曲线按时间戳对齐相加 — Task 15 实现，Task 17 验证

### 目录结构最终状态

```
packages/strategies/quantforge_strategies/
  __init__.py          # 统一导出 + 注册
  registry.py
  combined/            # 传统单标的策略
    __init__.py
    dual_ma.py
    rsi.py
    bollinger_band.py
  selectors/           # 选股策略
    __init__.py
    momentum.py
  timers/              # 择时策略
    __init__.py
    ma_crossover.py
  sizers/              # 仓位管理策略
    __init__.py
    equal_weight.py
    fixed_fraction.py
```

### 两种组合的关系

```
分层组合（CompositeStrategy）        多策略组合（MultiStrategyRunner）
├─ 1 个 SelectorStrategy             ├─ N 个 CompositeStrategy
├─ 1 个 TimingStrategy               ├─ 各自独立运行
├─ 1 个 PositionStrategy             ├─ 按权重分配资金
└─ DefaultComposite 编排              └─ 合并权益曲线和成交

用途：组装一个完整策略              用途：多策略分散投资
```

> MultiStrategyRunner 的子策略必须是 CompositeStrategy（分层组合后的完整策略），不支持直接放入裸的 SelectorStrategy 或 TimingStrategy。若需单标的策略参与组合，先用 DefaultComposite 包装。