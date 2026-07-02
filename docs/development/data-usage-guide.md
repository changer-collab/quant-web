# 数据调用手册

## 1. 数据概况

| 项        | 值                        |
| --------- | ------------------------- |
| 文件路径  | `data/quant.db`（SQLite） |
| 标的数量  | 5191（全 A 股）           |
| 时间范围  | 1990-12-19 ~ 2026-04-24   |
| bars 行数 | 16,622,127                |

**时区约定**：日线时间戳统一用 UTC 0:00（`timestamp % 86400000 == 0`）。

```python
# 正确
ts = int(datetime(2024, 6, 3, tzinfo=timezone.utc).timestamp() * 1000)
# 错误：本地时间偏移 8 小时
ts = int(datetime(2024, 6, 3).timestamp() * 1000)
```

## 2. 表结构

### bars 表

```sql
CREATE TABLE bars (
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL,       -- "1d"
  timestamp INTEGER NOT NULL,    -- 毫秒时间戳（UTC 0:00）
  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
  volume REAL NOT NULL, turnover REAL NOT NULL DEFAULT 0,
  open_interest REAL, num_trades INTEGER,
  PRIMARY KEY (symbol, timeframe, timestamp)
);
```

### valuations 表

```sql
CREATE TABLE valuations (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  market_cap REAL, pe_ttm REAL, pb REAL, ps_ttm REAL,
  dividend_yield REAL, turnover_rate REAL, float_shares REAL,
  PRIMARY KEY (symbol, timestamp)
);
```

### 字段覆盖率

| 字段                                          | 覆盖率 | 说明             |
| --------------------------------------------- | ------ | ---------------- |
| bars.OHLCV                                    | 100%   | 完整             |
| valuations.market_cap / pe_ttm / float_shares | 100%   |                  |
| valuations.turnover_rate                      | 97.4%  | 早期部分缺失     |
| valuations.pb / ps_ttm / dividend_yield       | 0%     | 需其他数据源补充 |

## 3. DataClient 接口

位置：`packages/data-client/quantforge_data/client.py`

```python
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame

client = DataClient("data/quant.db")

# 查询 K 线（返回 list[Bar]）
bars = client.query_bars("600519", TimeFrame.D1, start_ts=start_ts, end_ts=end_ts)

# 查询 K 线（返回 DataFrame，适合因子计算）
df = client.query_bars_df("600519", TimeFrame.D1)

# 列出所有标的
symbols = client.list_symbols()  # 5191 只
```

## 4. 策略数据流

策略不直接调用 DataClient，数据由回测引擎注入：

```
DataClient.query_bars() → BacktestRunner → Strategy.on_bar(bar)
```

组合策略数据流：

```
DataClient.query_bars(每个symbol) → MultiSymbolRunner →
  SelectorStrategy.select(bars_dict) →
  TimingStrategy.signal(bar) →
  PositionStrategy.size(symbol, signal, price) →
  Composite → submit_order
```

## 5. 因子数据流

因子通过 `Factor.compute(df)` 接收 DataFrame，返回 pd.Series：

```python
from quantforge_data import DataClient
from quantforge_factor import Factor

client = DataClient("data/quant.db")
df = client.query_bars_df("600519", TimeFrame.D1)
factor_values = MyFactor().compute(df)
```

## 6. CLI 调用

```bash
# 单标的回测
echo '{"command":"backtest","strategy":"dual_ma","config":{"initialCash":100000},"dataRange":{"dbPath":"data/quant.db","symbol":"600519","timeframe":"1d"}}' | python -m quantforge_strategy.cli

# 组合策略回测
echo '{"command":"backtest","strategy":"composite","config":{"initialCash":100000,"components":{"selector":{"name":"momentum_selector","params":{"lookback":5,"top_k":2}},"timer":{"name":"ma_crossover","params":{"short_period":5,"long_period":20}},"sizer":{"name":"equal_weight","params":{"max_positions":2}}}},"dataRange":{"dbPath":"data/quant.db","symbols":["600519","000001"],"timeframe":"1d"}}' | python -m quantforge_strategy.cli
```

## 7. 性能参考

| 场景                  | 数据量  | 耗时 |
| --------------------- | ------- | ---- |
| 单标的全量（35年）    | 5981 行 | 12ms |
| 单标的指定范围（2年） | 484 行  | 1ms  |
| 单日全市场快照        | 5029 只 | 25ms |

## 8. 数据补充

```bash
python scripts/import-xlsx.py 600519.SH 000001.SZ  # 添加新标的
python scripts/import-xlsx.py --all                  # 全量重新导入
```

缺失字段（PB/PS/股息率）需扩展数据源适配器补充。分钟线需扩展 data-collector 采集。
