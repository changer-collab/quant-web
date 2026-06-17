# 数据调用手册

本文档说明如何从数据中心读取数据，以及策略、因子如何与数据嫁接。

## 1. 数据概况

### 1.1 数据库

| 项 | 值 |
|----|-----|
| 文件路径 | `data/quant.db`（SQLite） |
| 标的数量 | 5191（全 A 股，沪市 + 深市） |
| 时间范围 | 1990-12-19 ~ 2026-04-24（35 年） |
| bars 行数 | 16,622,127 |
| valuations 行数 | 16,622,127 |
| 数据库大小 | ~3.8 GB |
| 数据来源 | `F:\data\Ashare_data`（Wind 导出的 xlsx） |

### 1.2 时区约定

**日线时间戳统一用 UTC 0:00**（即 `timestamp % 86400000 == 0`）。

```python
from datetime import datetime, timezone

# 正确：用 UTC 0:00 生成时间戳
ts = int(datetime(2024, 6, 3, tzinfo=timezone.utc).timestamp() * 1000)

# 错误：用本地时间会偏移 8 小时
ts = int(datetime(2024, 6, 3).timestamp() * 1000)  # ❌ 得到的是前一天 16:00 UTC
```

### 1.3 数据表结构

#### bars 表（K 线）

```sql
CREATE TABLE bars (
  symbol TEXT NOT NULL,          -- 标的代码，如 "600519"
  timeframe TEXT NOT NULL,       -- 周期，如 "1d"
  timestamp INTEGER NOT NULL,    -- 毫秒时间戳（UTC 0:00）
  open REAL NOT NULL,            -- 开盘价（元）
  high REAL NOT NULL,            -- 最高价（元）
  low REAL NOT NULL,             -- 最低价（元）
  close REAL NOT NULL,           -- 收盘价（元）
  volume REAL NOT NULL,          -- 成交量（股）
  turnover REAL NOT NULL DEFAULT 0,  -- 成交金额（元）
  open_interest REAL,            -- 持仓量（A股不用，NULL）
  num_trades INTEGER,            -- 成交笔数（A股不用，NULL）
  PRIMARY KEY (symbol, timeframe, timestamp)
);
CREATE INDEX idx_bars_symbol_tf ON bars(symbol, timeframe);
CREATE INDEX idx_bars_ts ON bars(timestamp);
```

#### valuations 表（估值）

```sql
CREATE TABLE valuations (
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,    -- 与 bars 同时间戳
  market_cap REAL,               -- A股流通市值（元）
  pe_ttm REAL,                   -- 市盈率
  pb REAL,                       -- 市净率（xlsx 未提供，NULL）
  ps_ttm REAL,                   -- 市销率（xlsx 未提供，NULL）
  dividend_yield REAL,           -- 股息率（xlsx 未提供，NULL）
  turnover_rate REAL,            -- 换手率（%）
  float_shares REAL,             -- A股流通股本（股）
  PRIMARY KEY (symbol, timestamp)
);
CREATE INDEX idx_val_symbol ON valuations(symbol);
```

### 1.4 字段覆盖率

| 字段 | 覆盖率 | 说明 |
|------|--------|------|
| bars.OHLCV | 100% | 完整 |
| valuations.market_cap | 100% | 流通市值 |
| valuations.pe_ttm | 100% | 市盈率 |
| valuations.turnover_rate | 97.4% | 换手率（早期部分缺失） |
| valuations.float_shares | 100% | 流通股本 |
| valuations.pb/ps_ttm/dividend_yield | 0% | xlsx 未提供，需其他数据源补充 |

---

## 2. DataClient 接口

`DataClient` 是 Python 侧的轻量数据客户端，直接读取 SQLite 文件。

**位置**：[packages/data-client/quantforge_data/client.py](../../packages/data-client/quantforge_data/client.py)

**依赖关系**：
```
packages/strategy-runtime → packages/data-client
packages/factor-lab       → packages/data-client
packages/ai-engine        → packages/data-client
```

### 2.1 初始化

```python
from quantforge_data import DataClient

client = DataClient("data/quant.db")
```

### 2.2 查询 K 线（返回 list[Bar]）

```python
from datetime import datetime, timezone
from quantforge_strategy import TimeFrame

# 查询全部历史
bars = client.query_bars("600519", TimeFrame.D1)

# 查询指定时间范围
start_ts = int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
end_ts = int(datetime(2024, 12, 31, tzinfo=timezone.utc).timestamp() * 1000)
bars = client.query_bars("600519", TimeFrame.D1, start_ts=start_ts, end_ts=end_ts)

for bar in bars:
    print(f"{bar.symbol} {bar.timestamp} O:{bar.open} H:{bar.high} L:{bar.low} C:{bar.close} V:{bar.volume}")
```

**Bar 字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| symbol | str | 标的代码 |
| timeframe | TimeFrame | 周期 |
| timestamp | int | 毫秒时间戳（UTC 0:00） |
| open | float | 开盘价 |
| high | float | 最高价 |
| low | float | 最低价 |
| close | float | 收盘价 |
| volume | float | 成交量 |

### 2.3 查询 K 线（返回 DataFrame）

```python
df = client.query_bars_df("600519", TimeFrame.D1, start_ts=start_ts, end_ts=end_ts)
print(df.head())
#    symbol timeframe      timestamp    open    high  ...  volume  turnover  open_interest  num_trades
# 0  600519        1d  1672531200000  1735.0  1740.0  ...  25000   4.3e8           None        None
```

DataFrame 适合因子计算（pandas/numpy 向量化）。

### 2.4 列出所有标的

```python
symbols = client.list_symbols()
print(f"共 {len(symbols)} 只股票")
# ['000001', '000002', ..., '688999']
```

### 2.5 查询估值数据（需直接 SQL）

> 当前 DataClient 未封装 valuations 查询，用 sqlite3 直接查：

```python
import sqlite3
import pandas as pd

conn = sqlite3.connect("data/quant.db")
df_val = pd.read_sql_query(
    "SELECT * FROM valuations WHERE symbol=? ORDER BY timestamp",
    conn, params=["600519"]
)
conn.close()

print(df_val[["timestamp", "market_cap", "pe_ttm", "turnover_rate"]].tail())
#        timestamp    market_cap  pe_ttm  turnover_rate
# 5976  1714060800000  2.15e11    21.5          0.45
```

---

## 3. 策略如何调用数据

### 3.1 单标的策略

策略不直接调用 DataClient，数据由回测引擎注入。策略通过 `on_bar(bar, context)` 接收每根 K 线。

```python
# packages/strategies/quantforge_strategies/combined/dual_ma.py
from quantforge_strategy import Strategy, Bar, StrategyContext

class DualMaStrategy(Strategy):
    def init(self, context: StrategyContext):
        self.short_ma = []
        self.long_ma = []

    def on_bar(self, bar: Bar, context: StrategyContext):
        self.short_ma.append(bar.close)
        self.long_ma.append(bar.close)
        if len(self.short_ma) > 5:
            self.short_ma.pop(0)
        if len(self.long_ma) > 20:
            self.long_ma.pop(0)

        if len(self.short_ma) == 5 and len(self.long_ma) == 20:
            if sum(self.short_ma)/5 > sum(self.long_ma)/20:
                context.submit_order(bar.symbol, 100, bar.close)  # 买入100股
```

**数据流**：
```
DataClient.query_bars() → BacktestRunner → Strategy.on_bar(bar)
```

### 3.2 组合策略（多标的）

组合策略通过 `DefaultComposite` 编排选股/择时/仓位子策略，数据由 `MultiSymbolRunner` 注入。

```python
# 选股策略：从全市场 bars 中选标的
class MomentumSelector(SelectorStrategy):
    def select(self, bars: dict[str, list[Bar]], context) -> list[str]:
        # bars 是 {symbol: [Bar, ...]}，包含所有候选标的
        returns = {}
        for symbol, symbol_bars in bars.items():
            if len(symbol_bars) >= self.lookback:
                ret = symbol_bars[-1].close / symbol_bars[-self.lookback].close - 1
                returns[symbol] = ret
        # 选涨幅前 top_k
        sorted_syms = sorted(returns, key=returns.get, reverse=True)
        return sorted_syms[:self.top_k]
```

**数据流**：
```
DataClient.query_bars(每个symbol) → MultiSymbolRunner →
  SelectorStrategy.select(bars_dict) →
  TimingStrategy.signal(symbol, bars) →
  PositionStrategy.size(symbol, equity) →
  DefaultComposite → submit_order
```

### 3.3 CLI 调用回测

```bash
# 单标的
echo '{
  "command": "backtest",
  "strategy": "dual_ma",
  "config": {"initialCash": 100000},
  "dataRange": {
    "dbPath": "data/quant.db",
    "symbol": "600519",
    "timeframe": "1d",
    "startTs": 1672531200000,
    "endTs": 1735689600000
  }
}' | python -m quantforge_strategy.cli

# 组合策略（多标的）
echo '{
  "command": "backtest",
  "strategy": "composite",
  "config": {
    "initialCash": 100000,
    "components": {
      "selector": {"name": "momentum_selector", "params": {"lookback": 20, "top_k": 5}},
      "timer": {"name": "ma_crossover", "params": {"short_period": 5, "long_period": 20}},
      "sizer": {"name": "equal_weight", "params": {"max_positions": 5}}
    }
  },
  "dataRange": {
    "dbPath": "data/quant.db",
    "symbols": ["600519", "000001", "600036", "000858", "601318"],
    "timeframe": "1d"
  }
}' | python -m quantforge_strategy.cli
```

**时间戳生成**：
```python
from datetime import datetime, timezone
start_ts = int(datetime(2023, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)  # 1672531200000
end_ts = int(datetime(2024, 12, 31, tzinfo=timezone.utc).timestamp() * 1000)   # 1735689600000
```

---

## 4. 因子如何调用数据

### 4.1 因子接口

因子通过 `Factor.compute(df)` 接收 DataFrame，返回 pd.Series。

```python
# packages/factor-lab/quantforge_factor/factor.py
class Factor(ABC):
    @property
    @abstractmethod
    def definition(self) -> FactorDefinition: ...

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.Series: ...
```

### 4.2 因子计算示例

```python
import pandas as pd
from quantforge_factor import Factor, FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode

class MomentumFactor(Factor):
    @property
    def definition(self):
        return FactorDefinition(
            id="momentum_20d",
            name="20日动量",
            formula="close / close.shift(20) - 1",
            category="momentum",
            modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1,
            status=FactorStatus.Active,
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        return df["close"].pct_change(20)
```

### 4.3 因子与数据嫁接

因子计算需要 DataFrame，由 DataClient 提供：

```python
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame

client = DataClient("data/quant.db")
df = client.query_bars_df("600519", TimeFrame.D1)

factor = MomentumFactor()
factor_values = factor.compute(df)  # pd.Series，索引与 df 相同
```

### 4.4 因子评估（CLI）

```bash
echo '{
  "command": "factor_eval",
  "factor": {
    "id": "momentum_20d",
    "name": "20日动量",
    "formula": "close.pct_change(20)"
  },
  "dataRange": {
    "dbPath": "data/quant.db",
    "symbol": "600519",
    "timeframe": "1d"
  }
}' | python -m quantforge_strategy.cli
```

**数据流**：
```
DataClient.query_bars_df() → Factor.compute(df) → pd.Series →
  FactorEvaluator.evaluate(factor, df, forward_returns) → IC/分组收益
```

### 4.5 多标的因子计算

选股策略本质就是多标的因子计算。用 DataClient 循环查询：

```python
client = DataClient("data/quant.db")
symbols = client.list_symbols()  # 5191 只股票

factor_values = {}
for symbol in symbols:
    df = client.query_bars_df(symbol, TimeFrame.D1)
    if len(df) >= 20:
        factor_values[symbol] = MomentumFactor().compute(df).iloc[-1]

# 按因子值排序选股
sorted_symbols = sorted(factor_values, key=factor_values.get, reverse=True)
selected = sorted_symbols[:10]  # 选因子值最大的 10 只
```

---

## 5. AI 引擎如何调用数据

```python
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame

client = DataClient("data/quant.db")
df = client.query_bars_df("600519", TimeFrame.D1)

# 特征工程
df["return_1d"] = df["close"].pct_change(1)
df["return_5d"] = df["close"].pct_change(5)
df["ma_5"] = df["close"].rolling(5).mean()
df["volatility_20"] = df["return_1d"].rolling(20).std()

# 标签：未来5日收益
df["label"] = df["close"].shift(-5) / df["close"] - 1

# 训练集
features = ["return_1d", "return_5d", "ma_5", "volatility_20"]
train_df = df.dropna(subset=features + ["label"])
X = train_df[features].values
y = train_df["label"].values
```

---

## 6. 性能参考

1662 万行数据下的查询性能（SQLite 单表）：

| 场景 | 数据量 | 耗时 |
|------|--------|------|
| 单标的全量（35年） | 5981 行 | 12ms |
| 单标的指定范围（2年） | 484 行 | 1ms |
| 多标的查询（5只，2年） | 2420 行 | 5ms |
| 单日全市场快照 | 5029 只股票 | 25ms |
| 全市场2年涨幅排名 | 5191 只股票 | 0.3ms |

**结论**：单表 + 索引完全够用，无需分表。

---

## 7. 数据补充

### 7.1 添加新标的

```bash
python scripts/import-xlsx.py 600519.SH 000001.SZ
```

### 7.2 全量重新导入

```bash
python scripts/import-xlsx.py --all
```

### 7.3 补充缺失字段（PB/PS/股息率）

需扩展 `scripts/import-xlsx.py` 或新增数据源适配器（如 tushare/akshare），写入 valuations 表的 `pb`/`ps_ttm`/`dividend_yield` 字段。

### 7.4 添加分钟线数据

需扩展 data-collector 采集分钟线，写入 bars 表时 `timeframe='1m'`。当前只有日K（`timeframe='1d'`）。
