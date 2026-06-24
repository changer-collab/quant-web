import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions, AkshareExtra } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * AKShare 适配器 — 通过 Python 子进程调用 AKShare 库
 *
 * AKShare 是 Python 库，Node.js 通过 python 桥接脚本调用。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 akshare（pip install akshare）
 * - 可通过 extra.pythonPath 指定 Python 路径，默认 python
 */
export class AkshareAdapter implements DataSourceAdapter {
  name = 'akshare';
  supportedDomains = ['market', 'event', 'fundamental'];
  supportedDataTypes = ['bar', 'tick', 'instrument', 'news', 'financial_report', 'shareholder_metrics'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as AkshareExtra | undefined;
    const pythonPath = extra?.pythonPath ?? 'python';
    const script = this.buildScript(options);

    const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
      maxBuffer: 50 * 1024 * 1024, // 50MB，大结果集场景
      timeout: 120_000, // 2 分钟超时
    });

    if (!stdout.trim()) return;

    const records: RawDataRecord[] = JSON.parse(stdout);
    for (const record of records) {
      yield record;
    }
  }

  /**
   * 构建 Python 桥接脚本
   *
   * 策略：按 domain/dataType 组合调用对应的 AKShare 接口，
   * 统一输出 JSON 数组到 stdout。
   */
  private buildScript(options: AdapterFetchOptions): string {
    const { domain, dataType, symbol, timeframe, start, end } = options;
    const startDate = start ? new Date(start).toISOString().slice(0, 10) : '';
    const endDate = end ? new Date(end).toISOString().slice(0, 10) : '';

    if (domain === 'market' && dataType === 'bar') {
      return this.buildBarScript(symbol, timeframe ?? '1d', startDate, endDate);
    }
    if (domain === 'market' && dataType === 'instrument') {
      return this.buildInstrumentScript();
    }
    if (domain === 'event' && dataType === 'news') {
      return this.buildNewsScript(symbol);
    }
    if (domain === 'fundamental' && dataType === 'financial_report') {
      return this.buildFinancialReportScript(symbol, startDate, endDate);
    }
    if (domain === 'fundamental' && dataType === 'shareholder_metrics') {
      return this.buildShareholderMetricsScript(symbol);
    }

    // 未实现的 domain/dataType 组合返回空数组
    return 'import json; print(json.dumps([]))';
  }

  /** K 线数据脚本 */
  private buildBarScript(symbol: string, timeframe: string, startDate: string, endDate: string): string {
    // AKShare 的 period 映射
    const periodMap: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '1h': '60', '1d': 'daily',
    };
    const period = periodMap[timeframe] ?? 'daily';
    const adjust = 'qfq'; // 前复权

    return `
import json, sys, datetime
import akshare as ak
if "${period}" == "daily":
  df = ak.stock_zh_a_hist(symbol="${symbol}", period="daily", start_date="${startDate}", end_date="${endDate}", adjust="${adjust}")
else:
  df = ak.stock_zh_a_hist_min_em(symbol="${symbol}", period="${period}", start_date="${startDate} 09:30:00", end_date="${endDate} 15:00:00", adjust="${adjust}")
df.columns = [c.strip() for c in df.columns]
col_map = {"日期":"date","开盘":"open","收盘":"close","最高":"high","最低":"low","成交量":"volume","成交额":"turnover","时间":"datetime"}
df = df.rename(columns=col_map)
if "date" in df.columns:
  df["timestamp"] = df["date"].apply(lambda x: int(datetime.datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
elif "datetime" in df.columns:
  df["timestamp"] = df["datetime"].apply(lambda x: int(datetime.datetime.strptime(str(x)[:19],"%Y-%m-%d %H:%M:%S").timestamp()*1000))
df["symbol"] = "${symbol}"
df["timeframe"] = "${timeframe}"
records = df[["symbol","timeframe","timestamp","open","high","low","close","volume","turnover"]].to_dict("records")
print(json.dumps(records, default=str))
`;
  }

  /** 标的列表脚本 */
  private buildInstrumentScript(): string {
    return `
import json, sys
import akshare as ak
df = ak.stock_info_a_code_name()
df.columns = ["symbol", "name"]
df["exchange"] = df["symbol"].apply(lambda x: "SSE" if x.startswith("6") else "SZSE")
df["lotSize"] = 100
df["priceTick"] = 0.01
df["industry"] = ""
df["sector"] = ""
df["listDate"] = 0
df["status"] = "active"
records = df.to_dict("records")
print(json.dumps(records, default=str))
`;
  }

  /** 新闻数据脚本 */
  private buildNewsScript(symbol: string): string {
    return `
import json, sys
import akshare as ak
df = ak.stock_news_em(symbol="${symbol}")
df.columns = [c.strip() for c in df.columns]
col_map = {"新闻标题":"title","新闻内容":"content","发布时间":"publishTime","文章来源":"source","新闻链接":"url"}
df = df.rename(columns=col_map)
df["id"] = df.index.astype(str)
df["symbols"] = "${symbol}"
df["tags"] = ""
df["timestamp"] = 0
records = df[["id","publishTime","title","source","symbols","tags"]].to_dict("records")
print(json.dumps(records, default=str))
`;
  }

  /** 财务报告脚本 */
  private buildFinancialReportScript(symbol: string, _startDate: string, _endDate: string): string {
    return `
import json, sys
import akshare as ak
df = ak.stock_financial_report_sina(stock="${symbol}", symbol="利润表")
df.columns = [c.strip() for c in df.columns]
col_map = {"报告日":"reportDate","营业收入":"revenue","营业成本":"costOfRevenue","营业利润":"operatingIncome","利润总额":"totalRevenue","净利润":"netIncome"}
df = df.rename(columns=col_map)
df["symbol"] = "${symbol}"
df["announceDate"] = df["reportDate"]
df["reportType"] = "annual"
df["totalAssets"] = 0
df["totalLiabilities"] = 0
df["totalEquity"] = 0
df["currentAssets"] = 0
df["currentLiabilities"] = 0
df["operatingCashFlow"] = 0
df["investingCashFlow"] = 0
df["financingCashFlow"] = 0
df["freeCashFlow"] = 0
records = df.to_dict("records")
print(json.dumps(records, default=str))
`;
  }

  /** 股东人数脚本 */
  private buildShareholderMetricsScript(symbol: string): string {
    return `
import json, sys, datetime
import akshare as ak
df = ak.stock_zh_a_stk_holdernumber(symbol="${symbol}")
if df is None or df.empty:
  print(json.dumps([]))
else:
  df.columns = [c.strip() for c in df.columns]
  col_map = {"公告日期":"announceDate","截止日期":"endDate","股东人数":"totalHolders","户均持股数":"avgHoldingShares","户均持股市值":"avgHoldingAmount","较上期变化":"changeRatio"}
  df = df.rename(columns=col_map)
  df["symbol"] = "${symbol}"
  df["announceDate"] = df["announceDate"].apply(lambda x: int(datetime.datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
  df["endDate"] = df["endDate"].apply(lambda x: int(datetime.datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
  records = df[["symbol","announceDate","endDate","totalHolders","avgHoldingShares","avgHoldingAmount","changeRatio"]].to_dict("records")
  print(json.dumps(records, default=str))
`;
  }
}
