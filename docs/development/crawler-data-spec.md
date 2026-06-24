# 外部爬虫数据格式规范

> 约束项目外部爬虫脚本产出的数据格式，确保能被 `data-collector` 的 CSV 适配器消费。

## 1. 边界

- 爬虫代码和产出数据**均不在本仓库内**
- 爬虫不直接连接 data-center 数据库，不感知业务逻辑
- 爬虫不做数据清洗（去停牌、补缺失日等），只做格式标准化
- 水位机制由 data-collector 维护，爬虫不实现

衔接路径：
```
[外部] 爬虫 → [外部] 产出数据 → [本仓库] data-collector/csv-adapter → data-center
```

## 2. 通用规范

| 项 | 规范 |
|----|------|
| 文件格式 | CSV（逗号分隔）或 Parquet |
| 编码 | UTF-8 with BOM |
| 换行符 | `\n`（LF） |
| 空值 | 留空（不写 null/NaN/-） |
| 日期 | `YYYY-MM-DD` |
| 时间 | `YYYY-MM-DD HH:mm:ss` |
| 毫秒时间戳 | 13 位整数 |

### 文件命名

```
<domain>_<dataType>_<symbol>_<date>[_<suffix>].csv
```

- domain: `reference` / `market` / `l2` / `fundamental` / `event`
- suffix: `qfq`(前复权) / `hfq`(后复权) / `1d` / `1w`

示例：`market_bar_sh600000_2026-06-17_1d_qfq.csv`

### 标的编码

统一小写，市场前缀 + 代码：`sh600000` / `sz000001` / `bj920000` / `hk00700`

### 目录结构

```
$CRAWLER_OUTPUT_DIR/
├── reference/          # 参考数据
├── market/             # L1 行情（按日期分目录）
├── l2/                 # L2 行情（按月份分目录）
├── fundamental/        # 基本面（按报告期分目录）
├── event/              # 资讯事件
└── _manifest/          # 清单文件（必产）
```

路径通过环境变量注入：`CRAWLER_OUTPUT_DIR`

## 3. 字段规范

### 3.1 参考数据

**instrument**: `reference_instrument_all_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 统一编码 |
| name | string | 是 | 证券名称 |
| exchange | string | 是 | `sh`/`sz`/`bj`/`hk` |
| lotSize | int | 是 | 每手股数 |
| priceTick | decimal | 是 | 最小变动价位 |
| industry | string | 是 | 行业分类 |
| sector | string | 是 | 板块分类 |
| listDate | date | 是 | 上市日期 |
| delistDate | date | 否 | 退市日期 |
| status | enum | 是 | `active`/`suspended`/`delisted` |
| attributes | json | 否 | 扩展属性，`type` 取值：`stock`/`etf`/`lof`/`bond`/`convertible`/`index`/`board` |

**trading_calendar**: `reference_trading-calendar_<exchange>_<year>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| exchange | string | 是 |
| year | int | 是 |
| tradingDays | json | 是 |
| holidays | json | 是 |

**index_constituent**: `reference_index-constituent_<indexSymbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| indexSymbol | string | 是 |
| asOfDate | date | 是 |
| symbol | string | 是 |
| weight | decimal | 是 |

### 3.2 L1 行情

**bar**: `market_bar_<symbol>_<date>_<timeframe>[_<suffix>].csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | |
| timeframe | string | 是 | `1d`/`1w`/`1m`/`1q`/`1y` |
| timestamp | datetime | 是 | K 线结束时间 |
| open/high/low/close | decimal | 是 | |
| volume | decimal | 是 | 成交量（股） |
| turnover | decimal | 否 | 成交额 |
| openInterest | decimal | 否 | 持仓量（期货） |
| numTrades | int | 否 | 成交笔数 |

**adjustment_factor**: `market_adjustment-factor_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| date | date | 是 |
| factor | decimal | 是 |
| type | enum | 是 (`forward`/`backward`) |

### 3.3 L2 行情

**tick**: `l2_tick_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| timestamp | datetime | 是 |
| price | decimal | 是 |
| volume | decimal | 是 |
| bid | decimal | 是 |
| ask | decimal | 是 |

**trade**: `l2_trade_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| timestamp | datetime | 是 |
| price | decimal | 是 |
| volume | decimal | 是 |
| side | enum | 是 (`buy`/`sell`/`unknown`) |
| tradeType | enum | 是 (`normal`/`block`/`auction`) |

**large_order**: `l2_large-order_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| timestamp | datetime | 是 |
| price | decimal | 是 |
| volume | decimal | 是 |
| side | enum | 是 |
| amount | decimal | 否 |

### 3.4 基本面

**financial_report**: `fundamental_financial-report_<symbol>_<reportDate>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| reportDate | date | 是 |
| announceDate | date | 是 |
| reportType | enum | 是 (`q1`/`q2`/`q3`/`annual`) |
| revenue / netIncome / totalAssets / totalLiabilities / totalEquity / operatingCashFlow | decimal | 是 |

**valuation**: `fundamental_valuation_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| symbol | string | 是 |
| timestamp | date | 是 |
| marketCap / peTTM / pb / psTTM / dividendYield / turnoverRate / floatShares | decimal | 否 |

### 3.5 资讯事件

**announcement**: `event_announcement_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| id | string | 是 |
| symbol | string | 是 |
| eventTime | datetime | 是 |
| eventType | enum | 是 (`st`/`suspended`/`dividend`/`restructure`/`ipo`/`delist`/`rightsIssue`) |
| title | string | 是 |
| impact | enum | 是 (`positive`/`neutral`/`negative`/`unknown`) |

**news**: `event_news_all_<date>.csv`

| 字段 | 类型 | 必填 |
|------|------|------|
| id | string | 是 |
| publishTime | datetime | 是 |
| title | string | 是 |
| source | string | 是 |
| symbols | json | 是 |
| tags | json | 是 |

## 4. 清单文件（必产）

每次爬取必须产出 `crawl-manifest-<date>.csv`：

| 字段 | 说明 |
|------|------|
| fileName | 产出文件名（含相对路径） |
| domain / dataType / symbol / date | 数据维度 |
| rowCount / fileSize / md5 | 校验信息 |
| crawledAt | 爬取完成时间 |
| source | 数据来源 |

## 5. 数据质量

必须保证：编码正确（GBK→UTF-8）、必填字段非空、主键唯一、时间单调、OHLC 满足 `low <= open,close <= high`。

不需要保证（由 data-collector 处理）：跨文件去重、缺失日补齐、停牌日处理、复权因子计算。
