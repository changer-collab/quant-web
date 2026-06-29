# 策略开发标准

## 1. 目录结构

```
packages/strategies/
  quantforge_strategies/
    __init__.py          ← 统一导出 + 注册
    registry.py          ← 注册表（register / get / list_all）
    combined/            ← 传统单标的策略（继承 Strategy）
    selectors/           ← 选股策略（继承 SelectorStrategy）
    timers/              ← 择时策略（继承 TimingStrategy）
    sizers/              ← 仓位管理策略（继承 PositionStrategy）
  tests/
```

## 2. 策略基类接口

### 2.1 传统单标的（Strategy）

```python
class YourStrategy(Strategy):
    @property
    def meta(self) -> StrategyMeta: ...
    @property
    def state(self) -> StrategyState: ...
    def init(self, context: StrategyContext) -> None: ...
    def on_bar(self, bar: Bar, context: StrategyContext) -> None: ...
    def finish(self) -> StrategyResult: ...
```

### 2.2 选股策略（SelectorStrategy）

```python
class YourSelector(SelectorStrategy):
    def select(self, bars: dict[str, Bar], context) -> list[str]: ...
```

### 2.3 择时策略（TimingStrategy）

```python
class YourTimer(TimingStrategy):
    def signal(self, bar: Bar, context) -> Signal: ...  # Buy/Sell/Hold
```

### 2.4 仓位管理策略（PositionStrategy）

```python
class YourSizer(PositionStrategy):
    def size(self, symbol: str, signal: Signal, price: float, context) -> float: ...
```

**仓位约定**：Buy 时返回目标总持仓量，Sell 时返回剩余量（0=清仓）。

### 2.5 组合策略

由 `DefaultComposite` 编排，开发者通常不需要继承 `CompositeStrategy`：

```python
from quantforge_backtest import DefaultComposite

composite = DefaultComposite(selector=..., timer=..., sizer=...)
```

## 3. StrategyMeta 规范

```python
StrategyMeta(
    name="your_strategy",              # snake_case，与注册名一致
    description="策略描述",
    modes=[ResearchMode.Traditional],  # Traditional / HighFrequency / AI
    params=[
        StrategyParamDef(key="period", label="周期", type=ParamType.Number, default=14, min=2, max=200),
    ],
    version="0.1.0",
    kind=StrategyKind.Combined,        # Combined/Select/Timing/Position/Composite
    category=StrategyCategory.NON_FACTOR,           # 三级分类：FACTOR_BASED/NON_FACTOR/TRANSITIONAL
    subcategory=StrategySubcategory.TREND_CTA,      # 子分类，见下表
    required_factors=None,             # 仅因子型策略填写依赖的因子 id 列表
)
```

`category`/`subcategory` 默认 `NON_FACTOR`/`None`，存量策略向后兼容。`meta.factor_based` 属性按 `category == FACTOR_BASED` 自动派生。

### category / subcategory 对照

> 子分类值在 Python / API / 前端三层严格一致（共 10 个）。

| category | subcategory |
|----------|-------------|
| `FACTOR_BASED` 因子型 | `linear_multi_factor` / `nonlinear_ml` |
| `NON_FACTOR` 非因子型 | `trend_cta` / `mean_reversion` / `arbitrage` / `high_frequency` / `macro_quant` / `event_driven` / `e2e_ai_timeseries` / `tail_risk_hedging` |
| `TRANSITIONAL` 过渡形态 | 无子分类（前端 `CATEGORY_SUBCATEGORIES.transitional` 为空） |

### StrategyParamDef 扩展字段

供策略配置页动态表单与 K 线预览使用：

| 字段 | 说明 |
|------|------|
| `chart_relevant` | 该参数变动是否触发 K 线预览重新请求（默认 `False`） |
| `ui_constraints` | 前端表单联动规则列表（`UIConstraint`，kind 取 `disable_when`/`require_when`/`set_default_when`/`range_when`） |

## 4. 生命周期

### 传统策略

```
init() → on_bar() × N → finish()
```

### 分层策略

```
[Selector.init + Timer.init + Sizer.init]
  → on_bars × N
    ├─ Selector.select(bars) → list[symbol]
    ├─ Timer.signal(bar) → Signal
    └─ Sizer.size(symbol, signal, price) → target_qty
  → [Selector.finish + Timer.finish + Sizer.finish]
```

**注意**：Timer.signal 只对被选中的标的调用，历史数据可能不连续。

## 5. 下单规范

```python
from quantforge_strategy import OrderRequest, OrderSide, OrderType

# 买入
account = context.get_account()
qty = int(account.cash / bar.close)
if qty > 0:
    context.submit_order(OrderRequest(symbol=bar.symbol, side=OrderSide.Buy, type=OrderType.Market, quantity=qty))

# 卖出
pos = context.get_position(bar.symbol)
if pos and pos.quantity > 0:
    context.submit_order(OrderRequest(symbol=bar.symbol, side=OrderSide.Sell, type=OrderType.Market, quantity=pos.quantity))
```

**禁止**：在 init() 中下单、假设订单立即成交（下一个 bar 撮合）、直接修改 Position/Account。

## 6. 注册与发现

```python
from quantforge_strategies import register, get, list_all

register("dual_ma", DualMAStrategy)
cls = get("dual_ma")
all_strategies = list_all()
```

## 7. 依赖规则

允许：`quantforge_strategy`（唯一依赖）、`numpy`/`pandas`、标准库

禁止：`quantforge_data`、`quantforge_backtest`、`services/data-center`、网络库

## 8. CLI 调用

```json
{
  "command": "backtest",
  "strategy": "dual_ma",
  "config": {"initialCash": 100000, "slippage": 0.001},
  "dataRange": {"dbPath": "data/quant.db", "symbol": "600519", "timeframe": "1d"}
}
```

组合策略：

```json
{
  "command": "backtest",
  "strategy": "composite",
  "config": {
    "initialCash": 100000,
    "components": {
      "selector": {"name": "momentum_selector", "params": {"lookback": 5, "top_k": 2}},
      "timer": {"name": "ma_crossover", "params": {"short_period": 5, "long_period": 20}},
      "sizer": {"name": "equal_weight", "params": {"max_positions": 2}}
    }
  },
  "dataRange": {"dbPath": "data/quant.db", "symbols": ["600519", "000001"], "timeframe": "1d"}
}
```

### 错误码

| 错误码 | 触发条件 |
|--------|----------|
| `NO_SYMBOLS` | 组合策略未提供 symbols |
| `NO_DATA` | 标的无数据 |
| `UNSUPPORTED` | 传统策略不支持多标的 |
| `INTERNAL_ERROR` | 策略名不存在或参数错误 |

## 9. 测试要求

```python
def test_meta():
    s = YourStrategy()
    assert s.meta.name == "your_strategy"
    assert s.meta.kind == StrategyKind.Combined

def test_init_resets_state():
    s = YourStrategy()
    s.init(None)

def test_no_trade_when_insufficient_data():
    # 数据不足时不下单
    ...
```
