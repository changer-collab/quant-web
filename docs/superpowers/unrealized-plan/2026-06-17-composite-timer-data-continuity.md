# 设计注意点：DefaultComposite 中 Timer 历史数据连续性问题

> **状态：** 未实现改进，当前通过使用约定规避
> **关联模块：** `packages/backtest-engine/quantforge_backtest/composite_impl.py`
> **关联文档：** `docs/development/strategy-development-standard.md` 第 4.3 节

---

## 当前进度

> **最后更新：** 2026-06-17

### 整体进度：未开始改进（0%）

| 阶段 | 状态 | 说明 |
|------|------|------|
| 问题识别 | ✅ 已完成 | 已定位根因：Timer 只对选中标的调用，历史数据不连续 |
| 规避方案 | ✅ 已完成 | 使用 `lookback=1` 确保 Selector 从首个 bar 选股 |
| 改进方案设计 | ✅ 已完成 | 已设计 3 个方案（A: update/signal 分离 / B: 独立 Timer / C: Selector 保证选股） |
| 方案实现 | ❌ 未开始 | 推荐方案 A，待触发时机实施 |
| 测试验证 | ❌ 未开始 | 待方案实现后补充 |

### 当前规避方式

- 测试中使用 `MomentumSelector(lookback=1, top_k=1)` 规避（见 `tests/test_e2e_portfolio.py`）
- 开发标准文档第 4.3 节已记录使用约定

### 触发条件

当用户反馈"策略在初始阶段无信号"或"Selector 历史不足导致信号偏移"时实施改进。

---

## 问题描述

`DefaultComposite.on_bars` 的编排逻辑如下：

```python
def on_bars(self, bars, context):
    universe = self._selector.select(bars, context)  # 1. 选股
    for symbol in universe:                          # 2. 只遍历被选中的标的
        bar = bars[symbol]
        sig = self._timer.signal(bar, context)       # 3. 只对选中标的调用 timer
        ...
```

**问题：** `timer.signal(bar, context)` 只在被 `Selector` 选中的标的上调用。若 `Selector` 在某些时间点因历史数据不足未选到该标的，`Timer` 会错过那些 bar 的数据，导致：

- 均线计算窗口不连续
- 金叉/死叉信号可能误判
- 策略行为与预期不符

## 复现案例

```
价格序列: [10, 9, 8, 12, 14]
Selector: MomentumSelector(lookback=2, top_k=1)
Timer:    MACrossoverTiming(short_period=2, long_period=3)

ts=0: Selector 历史不足（需要 2 期），universe=[]，Timer 未被调用
ts=1: Selector 选出 600000，Timer 开始接收数据（_prices=[9]）
ts=2: Timer _prices=[9, 8]，数据不足返回 Hold
ts=3: Timer _prices=[9, 8, 12]，短均线=10, 长均线=9.67，short_above=True
      但 prev_short_above=None，首次设置状态返回 Hold（错过金叉）
ts=4: Timer _prices=[9, 8, 12, 14]，short_above=True，无交叉，返回 Hold

结果：全程无交易信号，但实际价格从 8 涨到 14 应该触发金叉。
```

**根因：** ts=0 时 Selector 未选股，Timer 错过了第一个价格 10，导致后续均线计算全部偏移。

## 当前规避方案

在 `docs/development/strategy-development-standard.md` 第 4.3 节已记录使用约定：

1. **Selector 使用较小的 `lookback`（如 1）**，确保从第一个 bar 就选股
2. **Timer 内部对数据不足的情况返回 `Signal.Hold`**，避免误判

测试中通过 `MomentumSelector(lookback=1, top_k=1)` 规避了此问题（见 `tests/test_e2e_portfolio.py`）。

## 为什么当前不解决

1. **KISS 原则**：当前规避方案简单有效，不影响核心功能
2. **影响范围小**：仅在 Selector 历史不足的初始阶段出现
3. **改进方案有架构成本**：需要为每个标的维护独立的 Timer 实例，增加复杂度

## 未来改进方案

### 方案 A：Timer 对所有 bars 更新状态（推荐）

在 `DefaultComposite.on_bars` 中，先对所有 bars 中的标的更新 Timer 状态，再对选中的标的生成信号：

```python
def on_bars(self, bars, context):
    universe = self._selector.select(bars, context)

    # 先对所有标的更新 Timer 状态（不生成信号）
    for symbol, bar in bars.items():
        self._timer.update(bar, context)  # 新增 update 方法，只更新内部状态

    # 再对选中的标的生成信号并下单
    for symbol in universe:
        bar = bars[symbol]
        sig = self._timer.signal(bar, context)  # signal 复用已更新的状态
        ...
```

**需要修改：**
- `TimingStrategy` 基类：拆分 `signal()` 为 `update()` + `signal()`，或新增 `update()` 方法
- `MACrossoverTiming`：实现 `update()` 只更新 `_prices` 和 `_prev_short_above`
- `DefaultComposite.on_bars`：增加对所有标的的 `update()` 调用

**优点：**
- Timer 历史数据完整连续
- 不改变现有 API（`signal()` 仍可用）
- 向后兼容

**缺点：**
- 每个标的都会调用 `update()`，有轻微性能开销
- 需要修改基类接口

### 方案 B：为每个标的维护独立 Timer 实例

```python
class DefaultComposite:
    def __init__(self, selector, timer_factory, sizer):
        self._selector = selector
        self._timer_factory = timer_factory  # 工厂函数，每次调用返回新实例
        self._timers: dict[str, TimingStrategy] = {}
        self._sizer = sizer

    def on_bars(self, bars, context):
        universe = self._selector.select(bars, context)
        for symbol in universe:
            if symbol not in self._timers:
                self._timers[symbol] = self._timer_factory()
                self._timers[symbol].init(context)
            sig = self._timers[symbol].signal(bars[symbol], context)
            ...
```

**优点：**
- 每个标的有独立的 Timer 状态，互不干扰
- 不需要修改基类接口

**缺点：**
- 需要传入 Timer 工厂而非实例
- 标的退出后 Timer 实例不会被清理（内存泄漏风险）
- API 变更较大

### 方案 C：Selector 保证从第一个 bar 就选股

在 `SelectorStrategy` 基类或 `DefaultComposite` 中强制要求 Selector 在数据不足时也返回所有标的（而非空列表），由 Timer 自行处理数据不足的情况。

**优点：**
- 改动最小
- 不需要修改 Timer 接口

**缺点：**
- 改变了 Selector 的语义（"选出目标" vs "返回所有"）
- 可能导致不必要的信号计算

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `packages/strategy-runtime/quantforge_strategy/timers.py` | 新增 `update()` 方法（方案 A） |
| `packages/backtest-engine/quantforge_backtest/composite_impl.py` | 修改 `on_bars` 逻辑 |
| `packages/strategies/quantforge_strategies/timers/ma_crossover.py` | 实现 `update()` |
| `packages/strategy-runtime/tests/test_timers.py` | 新增 `update()` 测试 |
| `packages/backtest-engine/tests/test_e2e_composite.py` | 验证修复 |
| `docs/development/strategy-development-standard.md` | 更新 4.3 节 |

## 决策建议

**推荐方案 A**，原因：
1. 向后兼容，不破坏现有 API
2. 改动集中在基类和 DefaultComposite，影响可控
3. 符合"状态更新与信号生成分离"的设计原则

**触发时机：** 当用户反馈"策略在初始阶段无信号"或"Selector 历史不足导致信号偏移"时实施。
