# 外部爬虫数据格式规范

> 本文档用于约束**项目外部**独立运行的爬虫脚本产出的数据格式。
> 爬虫脚本和产出数据**均不放在本仓库内**，避免项目代码库和数据体积膨胀。
> 产出的数据文件必须能被 `services/data-collector` 的 CSV 适配器消费，并最终写入 `services/data-center` 的既有 schema。
>
> 本规范只定义"产出文件的格式"，不规定爬虫实现语言、爬取频率和存储介质。

## 1. 目的与边界

### 1.1 适用范围
- 独立部署的爬虫脚本（Python / Node / Go 均可），**代码放在本仓库之外**
- 产出物为本地文件（CSV / Parquet），**存放在本仓库之外的外部目录**
- 数据来源包括但不限于：百度网盘归档数据、Tushare、AKShare、东方财富、同花顺等

### 1.2 不做的事
- 爬虫代码不进入本仓库（不放在 `services/data-collector` 或任何子目录下）
- 爬虫产出数据不进入本仓库（不放在 `d:\quant-web` 下任何位置）
- 爬虫不直接连接 data-center 数据库
- 爬虫不感知因子、策略、回测等业务逻辑
- 爬虫不做数据清洗（如去停牌、补缺失日），只做格式标准化
- 爬虫不实现水位机制，水位由 data-collector 维护

### 1.3 与本仓库的衔接
```
[外部] 爬虫代码仓库  →  [外部] 产出数据目录  →  [本仓库] data-collector/csv-adapter  →  [本仓库] data-center
```

爬虫代码和产出数据都在本仓库之外，data-collector 通过**环境变量配置的外部路径**读取产出文件。爬虫只需保证文件格式符合本规范，并把文件放到约定的外部目录。

### 1.4 推荐的目录布局（均在项目外部）

```
D:\quant-crawler\                    # 爬虫代码仓库（独立 Git 仓库，与 quant-web 平级）
├── crawlers/                        # 爬虫实现
│   ├── baidu_netdisk_downloader.py  # 网盘归档下载器
│   ├── tushare_crawler.py
│   └── ...
├── transformers/                    # 原始数据 → 标准格式转换器
│   ├── netdisk_to_csv.py
│   └── ...
├── config/
│   └── sources.yaml                 # 数据源配置
└── README.md

D:\quant-data\                       # 数据产出目录（外部，不进 Git）
├── crawler-output\                  # 爬虫产出（符合本规范的标准格式）
│   ├── reference\
│   ├── market\
│   ├── l2\
│   ├── fundamental\
│   ├── event\
│   └── _manifest\
├── raw\                             # 原始数据缓存（网盘下载的 zip 等，可选）
│   ├── netdisk\
│   └── tushare\
└── archive\                         # 归档数据（按日期打包，可选）
```

### 1.5 路径对接方式

data-collector 通过环境变量读取外部数据目录，**不在本仓库内硬编码路径**：

```bash
# .env 文件（本仓库根目录，已 gitignore）
CRAWLER_OUTPUT_DIR=D:\quant-data\crawler-output
CRAWLER_RAW_DIR=D:\quant-data\raw
```

data-collector 的 CSV 适配器调用时，`extra.filePath` 传入外部目录下的绝对路径即可。批量导入脚本通过扫描 `CRAWLER_OUTPUT_DIR` 获取文件清单。

## 2. 通用文件规范

### 2.1 编码与格式
| 项 | 规范 |
|----|------|
| 文件格式 | CSV（逗号分隔）或 Parquet（推荐大文件） |
| 编码 | UTF-8 with BOM（兼容 Excel 直接打开） |
| 换行符 | `\n`（LF） |
| 引号 | 双引号 `"`，含逗号或换行的字段必须加引号 |
| 数值小数点 | `.`（点号），不使用千分位逗号 |
| 空值 | 留空（不写 `null` / `NaN` / `-`） |
| 布尔值 | `true` / `false`（小写字符串） |
| 日期格式 | `YYYY-MM-DD`（如 `2026-06-17`） |
| 时间格式 | `YYYY-MM-DD HH:mm:ss`（如 `2026-06-17 14:30:00`） |
| 毫秒时间戳 | 13 位整数（如 `1750153800000`），仅用于 timestamp 字段 |

### 2.2 文件命名规范

```
<domain>_<dataType>_<symbol>_<date>[_<suffix>].csv
```

| 字段 | 说明 | 示例 |
|------|------|------|
| domain | 数据子域 | `reference` / `market` / `l2` / `fundamental` / `event` |
| dataType | 数据类型 | `instrument` / `bar` / `tick` / `trade` / `large_order` |
| symbol | 标的编码 | `sh600000` / `sz000001` / `hk00700` |
| date | 数据日期 | `2026-06-17` |
| suffix | 可选后缀 | `qfq`(前复权) / `hfq`(后复权) / `1d` / `1w` |

**示例**：
- `market_bar_sh600000_2026-06-17_1d_qfq.csv`
- `l2_tick_sh600000_2026-06-17.csv`
- `reference_instrument_all_2026-06-17.csv`

### 2.3 标的编码规范（symbol）

统一小写，市场前缀 + 代码，不加分隔符：

| 市场 | 前缀 | 示例 |
|------|------|------|
| 上海证券交易所 | `sh` | `sh600000` / `sh000300` |
| 深圳证券交易所 | `sz` | `sz000001` / `sz399001` |
| 北京证券交易所 | `bj` | `bj920000` |
| 港股 | `hk` | `hk00700` |
| ETF/LOF | 按上市市场 | `sh513310` / `sz159915` |
| 可转债 | 按上市市场 | `sh113001` |
| 指数 | 按发布市场 | `sh000300` / `sz399006` |

### 2.4 目录结构建议

爬虫产出文件按以下结构组织在**外部目录**（`$CRAWLER_OUTPUT_DIR`）下，便于 data-collector 批量扫描：

```
$CRAWLER_OUTPUT_DIR/                   # 如 D:\quant-data\crawler-output
├── reference/                          # 参考数据（全市场，低频更新）
│   ├── instrument/
│   │   └── reference_instrument_all_2026-06-17.csv
│   ├── trading_calendar/
│   │   └── reference_trading-calendar_sh_2026.csv
│   └── index_constituent/
│       └── reference_index-constituent_sh000300_2026-06-17.csv
├── market/                             # L1 行情（按日期分目录）
│   ├── bar_1d/
│   │   └── 2026-06-17/
│   │       ├── market_bar_sh600000_2026-06-17_1d.csv
│   │       ├── market_bar_sh600000_2026-06-17_1d_qfq.csv
│   │       └── market_bar_sh600000_2026-06-17_1d_hfq.csv
│   ├── bar_1w/  bar_1m/  bar_1q/  bar_1y/
│   └── adjustment_factor/
│       └── market_adjustment-factor_sh600000_2026-06-17.csv
├── l2/                                 # L2 行情（按月份分目录，数据量大）
│   ├── tick/
│   │   └── 2026-06/
│   │       └── l2_tick_sh600000_2026-06-17.csv
│   ├── trade/
│   │   └── 2026-06/
│   │       └── l2_trade_sh600000_2026-06-17.csv
│   └── large_order/
│       └── 2026-06/
│           └── l2_large-order_sh600000_2026-06-17.csv
├── fundamental/                        # 基本面（按报告期分目录）
│   ├── financial_report/
│   │   └── 2026-Q1/
│   │       └── fundamental_financial-report_sh600000_2026-03-31.csv
│   └── valuation/
│       └── 2026-06-17/
│           └── fundamental_valuation_sh600000_2026-06-17.csv
├── event/                              # 资讯事件
│   ├── announcement/
│   │   └── event_announcement_sh600000_2026-06-17.csv
│   └── news/
│       └── event_news_all_2026-06-17.csv
└── _manifest/                          # 清单文件（必产）
    ├── crawl-manifest-2026-06-17.csv   # 当日爬取清单
    └── raw-source-manifest.csv         # 原始来源记录
```

## 3. 各数据类型字段规范

> 字段名严格对齐 `services/data-center/src/storage/schema.ts` 的列名，便于直接导入。
> **必填**字段不可为空，**可空**字段留空即可。

### 3.1 参考数据（reference）

#### 3.1.1 标的基础信息 `instrument`

文件名：`reference_instrument_all_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 统一编码，如 `sh600000` |
| name | string | 是 | 证券名称 |
| exchange | string | 是 | 交易所：`sh` / `sz` / `bj` / `hk` |
| lotSize | int | 是 | 每手股数（A 股 100，港股 1） |
| priceTick | decimal | 是 | 最小变动价位 |
| industry | string | 是 | 行业分类（空值填 `Unknown`） |
| sector | string | 是 | 板块分类（空值填 `Unknown`） |
| listDate | date | 是 | 上市日期 `YYYY-MM-DD` |
| delistDate | date | 否 | 退市日期 |
| status | enum | 是 | `active` / `suspended` / `delisted` |
| attributes | json | 否 | 扩展属性 JSON 字符串，如 `{"type":"etf","underlying":"sh000300"}` |

**证券类型**通过 `attributes.type` 字段表达，取值：`stock` / `etf` / `lof` / `bond` / `convertible` / `index` / `board`。

#### 3.1.2 交易日历 `trading_calendar`

文件名：`reference_trading-calendar_<exchange>_<year>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| exchange | string | 是 | `sh` / `sz` / `bj` / `hk` |
| year | int | 是 | 年份 |
| tradingDays | json | 是 | 交易日数组 JSON，如 `["2026-01-02","2026-01-03"]` |
| holidays | json | 是 | 节假日数组 JSON |
| sessionType | string | 否 | 交易时段类型 |

#### 3.1.3 指数成分 `index_constituent`

文件名：`reference_index-constituent_<indexSymbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| indexSymbol | string | 是 | 指数代码，如 `sh000300` |
| asOfDate | date | 是 | 成分快照日期 |
| symbol | string | 是 | 成分股代码 |
| weight | decimal | 是 | 权重（0-1） |

#### 3.1.4 复权因子 `adjustment_factor`

文件名：`market_adjustment-factor_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| date | date | 是 | 除权除息日 |
| factor | decimal | 是 | 复权因子 |
| type | enum | 是 | `forward`(前复权) / `backward`(后复权) |

### 3.2 L1 行情（market）

#### 3.2.1 K 线 `bar`

文件名：`market_bar_<symbol>_<date>_<timeframe>[_<suffix>].csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timeframe | string | 是 | `1d` / `1w` / `1m` / `1q` / `1y` |
| timestamp | datetime | 是 | K 线结束时间 `YYYY-MM-DD HH:mm:ss`（日线用 `YYYY-MM-DD 15:00:00`） |
| open | decimal | 是 | 开盘价 |
| high | decimal | 是 | 最高价 |
| low | decimal | 是 | 最低价 |
| close | decimal | 是 | 收盘价 |
| volume | decimal | 是 | 成交量（股） |
| turnover | decimal | 否 | 成交额（元），默认 0 |
| openInterest | decimal | 否 | 持仓量（期货） |
| numTrades | int | 否 | 成交笔数 |

**复权数据**：不复权数据直接写入 `bar` 表；前复权/后复权数据**单独成文件**，文件名带 `_qfq` / `_hfq` 后缀，由 data-collector 写入时标记。**不要覆盖不复权数据**。

**多频率**：周/月/季/年 K 线的 `timestamp` 取周期最后一个交易日的收盘时间。

### 3.3 L2 行情（l2）

#### 3.3.1 逐笔成交 `trade`

文件名：`l2_trade_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | datetime | 是 | 成交时间，精确到秒（或毫秒） |
| price | decimal | 是 | 成交价 |
| volume | decimal | 是 | 成交量（股） |
| side | enum | 是 | `buy` / `sell` / `unknown`（主动方） |
| tradeType | enum | 是 | `normal` / `block`(大宗) / `auction`(集合竞价) |

#### 3.3.2 逐笔委托 `order`（如有）

文件名：`l2_order_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | datetime | 是 | 委托时间 |
| price | decimal | 是 | 委托价 |
| volume | decimal | 是 | 委托量 |
| action | enum | 是 | `add`(新增) / `cancel`(撤单) / `trade`(成交) |
| orderType | enum | 是 | `limit` / `market` |

#### 3.3.3 盘口快照 `l2_snapshot`（如有）

文件名：`l2_snapshot_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | datetime | 是 | 快照时间 |
| bids | json | 是 | 买盘 JSON 数组，如 `[{"price":10.01,"volume":100,"orders":3},...]` |
| asks | json | 是 | 卖盘 JSON 数组 |

#### 3.3.4 分笔成交（Tick） `tick`

> 对应网盘"分笔成交"数据，字段较简，与 `trade` 不同表存储。

文件名：`l2_tick_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | datetime | 是 | 成交时间 |
| price | decimal | 是 | 成交价 |
| volume | decimal | 是 | 成交量 |
| bid | decimal | 是 | 买一价（无则填 0） |
| ask | decimal | 是 | 卖一价（无则填 0） |
| bidVolume | decimal | 否 | 买一量（默认 0） |
| askVolume | decimal | 否 | 卖一量（默认 0） |
| bidOrders | int | 否 | 买委托笔数 |
| askOrders | int | 否 | 卖委托笔数 |

#### 3.3.5 大单统计 `large_order`

> 对应网盘"分笔成交_大单统计"，单独成表，不混入 tick。

文件名：`l2_large-order_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | datetime | 是 | 大单时间 |
| price | decimal | 是 | 成交价 |
| volume | decimal | 是 | 成交量 |
| side | enum | 是 | `buy` / `sell` |
| amount | decimal | 否 | 成交额 |

### 3.4 基本面（fundamental）

#### 3.4.1 财务报表 `financial_report`

文件名：`fundamental_financial-report_<symbol>_<reportDate>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| reportDate | date | 是 | 报告期 `YYYY-MM-DD` |
| announceDate | date | 是 | 公告日期 |
| reportType | enum | 是 | `q1` / `q2` / `q3` / `annual` |
| revenue | decimal | 是 | 营业收入 |
| costOfRevenue | decimal | 是 | 营业成本 |
| operatingIncome | decimal | 是 | 营业利润 |
| totalRevenue | decimal | 是 | 营业总收入 |
| netIncome | decimal | 是 | 净利润 |
| totalAssets | decimal | 是 | 总资产 |
| totalLiabilities | decimal | 是 | 总负债 |
| totalEquity | decimal | 是 | 股东权益 |
| currentAssets | decimal | 是 | 流动资产 |
| currentLiabilities | decimal | 是 | 流动负债 |
| operatingCashFlow | decimal | 是 | 经营现金流 |
| investingCashFlow | decimal | 是 | 投资现金流 |
| financingCashFlow | decimal | 是 | 筹资现金流 |
| freeCashFlow | decimal | 是 | 自由现金流 |

#### 3.4.2 估值 `valuation`

文件名：`fundamental_valuation_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| timestamp | date | 是 | 日期 |
| marketCap | decimal | 否 | 总市值 |
| peTTM | decimal | 否 | 滚动市盈率 |
| pb | decimal | 否 | 市净率 |
| psTTM | decimal | 否 | 滚动市销率 |
| dividendYield | decimal | 否 | 股息率 |
| turnoverRate | decimal | 否 | 换手率 |
| floatShares | decimal | 否 | 流通股本 |

#### 3.4.3 股东人数 `shareholder_metric`

文件名：`fundamental_shareholder-metric_<symbol>_<announceDate>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| symbol | string | 是 | 标的代码 |
| announceDate | date | 是 | 公告日期 |
| endDate | date | 是 | 截止日期 |
| totalHolders | decimal | 是 | 股东总户数 |
| avgHoldingShares | decimal | 是 | 户均持股 |
| avgHoldingAmount | decimal | 是 | 户均持股市值 |
| changeRatio | decimal | 否 | 环比变化 |

### 3.5 资讯事件（event）

#### 3.5.1 公告事件 `announcement`

文件名：`event_announcement_<symbol>_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 事件唯一 ID（建议 `symbol_eventTime_eventType` 哈希） |
| symbol | string | 是 | 标的代码 |
| eventTime | datetime | 是 | 事件时间 |
| eventType | enum | 是 | `st` / `suspended` / `dividend` / `restructure` / `ipo` / `delist` / `rightsIssue` |
| title | string | 是 | 标题 |
| description | string | 否 | 描述 |
| impact | enum | 是 | `positive` / `neutral` / `negative` / `unknown` |

#### 3.5.2 新闻 `news`

文件名：`event_news_all_<date>.csv`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 新闻唯一 ID |
| publishTime | datetime | 是 | 发布时间 |
| title | string | 是 | 标题 |
| source | string | 是 | 来源 |
| symbols | json | 是 | 关联标的 JSON 数组，如 `["sh600000","sz000001"]` |
| sentimentScore | decimal | 否 | 情感分（-1 到 1） |
| tags | json | 是 | 标签 JSON 数组 |

## 4. 清单文件规范（必产）

每次爬取**必须**产出清单文件，用于 data-collector 追踪和 data-center 质量校验。

### 4.1 爬取清单 `crawl-manifest-<date>.csv`

放在 `_manifest/` 目录，记录当日产出的所有数据文件：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fileName | string | 是 | 产出文件名（含相对路径） |
| domain | string | 是 | 数据子域 |
| dataType | string | 是 | 数据类型 |
| symbol | string | 是 | 标的代码（全市场文件填 `all`） |
| date | date | 是 | 数据日期 |
| rowCount | int | 是 | 文件行数（不含表头） |
| fileSize | int | 是 | 文件字节数 |
| md5 | string | 是 | 文件 MD5 |
| crawledAt | datetime | 是 | 爬取完成时间 |
| source | string | 是 | 数据来源（如 `baidu-netdisk` / `tushare` / `akshare`） |

### 4.2 原始来源记录 `raw-source-manifest.csv`

追加写入，记录每个原始文件的来源信息：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rawPath | string | 是 | 原始文件路径（如网盘路径） |
| rawMd5 | string | 是 | 原始文件 MD5 |
| outputFile | string | 是 | 转换后产出文件名 |
| source | string | 是 | 数据来源 |
| fetchedAt | datetime | 是 | 获取时间 |

## 5. 数据质量要求

### 5.1 必须保证
- **编码正确**：UTF-8，中文证券名不乱码（网盘数据多为 GBK，必须转换）
- **字段完整**：必填字段不可为空
- **主键唯一**：同一文件内主键不重复
- **时间单调**：同一 symbol 的数据按时间升序排列
- **数值合理**：OHLC 满足 `low <= open,close <= high`，`high >= low`，价格为正

### 5.2 不需要保证（由 data-collector 处理）
- 跨文件去重
- 缺失日补齐
- 停牌日处理
- 复权因子计算
- 跨数据源对齐

### 5.3 异常处理
爬虫遇到异常数据时**不要跳过**，按以下规则写入：
- 数值异常（如价格为 0）：保留原值，在 `crawl-manifest` 的 `notes` 字段标注
- 字段缺失：可空字段留空，必填字段无法填充则**整行跳过**并记录到清单
- 编码失败：丢弃该行，记录到清单

## 6. 增量爬取约定

### 6.1 水位线
爬虫**不维护水位线**，但产出文件名必须包含明确的日期，便于 data-collector 按日期扫描增量：
- 全量文件：文件名带 `_all_` 和日期，每次全量覆盖
- 增量文件：文件名带具体日期，按日期目录组织

### 6.2 重复数据
同一日期的同一数据类型重复爬取时：
- 覆盖旧文件（文件名相同）
- 在 `crawl-manifest` 中追加一条记录，标注 `isReCrawl=true`

## 7. 与 data-collector 的对接

### 7.1 外部路径配置

data-collector 不在本仓库内硬编码爬虫产出路径，通过环境变量注入：

```bash
# .env（本仓库根目录，已 gitignore，不会提交）
CRAWLER_OUTPUT_DIR=D:\quant-data\crawler-output
CRAWLER_RAW_DIR=D:\quant-data\raw
```

批量导入脚本（后续按需在 `scripts/` 下创建）读取 `CRAWLER_OUTPUT_DIR` 扫描文件，逐个调用 CSV 适配器。本仓库**不存放任何爬虫产出数据**。

### 7.2 CSV 适配器参数
data-collector 的 CSV 适配器（`services/data-collector/src/adapters/csv-adapter.ts`）支持以下参数：

```typescript
{
  filePath: string;      // CSV 文件路径（指向外部目录下的文件）
  delimiter?: string;    // 分隔符，默认逗号
  encoding?: string;     // 编码，默认 utf-8
}
```

`filePath` 传入 `$CRAWLER_OUTPUT_DIR` 下的绝对路径即可，爬虫产出文件默认即可被消费，无需额外配置。

### 7.3 导入顺序
data-collector 按以下顺序导入，爬虫产出文件应按此顺序准备（路径均在 `$CRAWLER_OUTPUT_DIR` 下）：

1. `reference/` → 标的、交易日历、指数成分
2. `market/adjustment_factor/` → 复权因子
3. `market/bar_1d/` → 日线（不复权 → 前复权 → 后复权）
4. `market/bar_1w/` 等 → 其他频率 K 线
5. `l2/` → 分笔、逐笔、大单（按月份批次）
6. `fundamental/` → 财报、估值
7. `event/` → 公告、新闻

### 7.4 字段映射
爬虫产出的字段名必须与 schema 列名**完全一致**（驼峰命名），data-collector 不做字段名转换。如需转换，在爬虫侧（外部仓库）完成。

## 8. 网盘归档数据特殊说明

针对百度网盘 `/量化数据/` 目录的归档数据，爬虫侧需注意：

| 网盘目录 | 对应 domain/dataType | 预处理要点 |
|---------|----------------------|-----------|
| `stock/k线/日线_*.zip` | market/bar_1d | 解压后每股一个 CSV，按文件名解析 symbol |
| `stock/k线/日线_前复权_*.zip` | market/bar_1d (qfq) | 文件名加 `_qfq` 后缀 |
| `stock/k线/日线_后复权_*.zip` | market/bar_1d (hfq) | 文件名加 `_hfq` 后缀 |
| `stock/指数/日线/*.csv` | market/bar_1d (index) | symbol 为指数代码，attributes.type=index |
| `A股数据_分笔数据/分笔成交_按月归档_*/` | l2/tick | 解 zip 后按日期组织，数据量大建议按月分批 |
| `A股数据_分笔数据/分笔成交_大单统计/*.zip` | l2/large_order | Excel 格式，需转为 CSV |
| `基金_分笔成交/ETF基础信息列表.csv` 等 | reference/instrument | 多张列表合并去重，type 通过 attributes 区分 |
| `可转债_分笔成交/可转债基础信息列表.csv` | reference/instrument | type=convertible |
| `港股_分笔成交/港股股票列表.csv` | reference/instrument | exchange=hk |
| `通达信板块_分笔成交/板块信息_通达信.csv` | reference/instrument | type=board |
| `*_交易日历.csv` | reference/trading_calendar | 按交易所拆分 |

**编码警告**：网盘 CSV 几乎都是 GBK 编码，爬虫必须转 UTF-8 with BOM 后再产出。

## 9. 校验清单（爬虫自检）

爬虫产出文件后，建议自检以下项：

- [ ] 文件编码为 UTF-8 with BOM
- [ ] 文件名符合 `<domain>_<dataType>_<symbol>_<date>[_<suffix>].csv` 规范
- [ ] 表头字段名与 schema 列名完全一致（驼峰）
- [ ] 必填字段无空值
- [ ] 日期格式为 `YYYY-MM-DD`
- [ ] 时间格式为 `YYYY-MM-DD HH:mm:ss`
- [ ] 数值字段无千分位逗号
- [ ] symbol 全小写，带市场前缀
- [ ] 同一文件内主键不重复
- [ ] 同一 symbol 数据按时间升序
- [ ] OHLC 满足 `low <= open,close <= high`
- [ ] 已产出 `crawl-manifest-<date>.csv` 清单文件
- [ ] 已记录原始来源到 `raw-source-manifest.csv`

## 10. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-06-17 | 初版，基于网盘归档数据结构和 data-center schema 制定 |
| 2026-06-17 | 明确爬虫代码和产出数据均在项目外部，通过环境变量 `CRAWLER_OUTPUT_DIR` 对接 |
