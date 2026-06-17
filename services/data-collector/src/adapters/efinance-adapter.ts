import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions, EfinanceExtra } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * efinance 适配器 — 通过 Python 子进程调用 efinance 库
 *
 * efinance 基于东方财富接口，提供日K线、标的列表、股东人数等数据。
 * 免费使用，无需注册。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 efinance（pip install efinance）
 * - 可通过 extra.pythonPath 指定 Python 路径
 */
export class EfinanceAdapter implements DataSourceAdapter {
  name = 'efinance';
  supportedDomains = ['market', 'reference', 'fundamental'];
  supportedDataTypes = ['bar', 'instrument', 'shareholder_metrics'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as EfinanceExtra | undefined;
    const pythonPath = extra?.pythonPath ?? 'python';
    const script = this.buildScript(options);

    const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
    });

    if (!stdout.trim()) return;

    const records: RawDataRecord[] = JSON.parse(stdout);
    for (const record of records) {
      yield record;
    }
  }

  private buildScript(options: AdapterFetchOptions): string {
    const { domain, dataType, symbol } = options;
    const startDate = options.start ? this.formatDate(options.start) : '';
    const endDate = options.end ? this.formatDate(options.end) : '';

    if (domain === 'market' && dataType === 'bar') {
      return this.buildBarScript(symbol, startDate, endDate);
    }
    if (domain === 'reference' && dataType === 'instrument') {
      return this.buildInstrumentScript();
    }
    if (domain === 'fundamental' && dataType === 'shareholder_metrics') {
      return this.buildShareholderMetricsScript(symbol);
    }

    return 'import json; print(json.dumps([]))';
  }

  private formatDate(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  private buildBarScript(symbol: string, startDate: string, endDate: string): string {
    return `
import json, sys
try:
  import efinance as ef
  df = ef.stock.get_quote_history("${symbol}", beg="${startDate}", end="${endDate}", klt=101)
  if df is None or df.empty:
    print(json.dumps([]))
  else:
    df.columns = [c.strip() for c in df.columns]
    col_map = {"日期":"date","开盘":"open","收盘":"close","最高":"high","最低":"low","成交量":"volume","成交额":"turnover"}
    df = df.rename(columns=col_map)
    df["timestamp"] = df["date"].apply(lambda x: int(__import__("datetime").datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
    df["symbol"] = "${symbol}"
    df["timeframe"] = "1d"
    records = df[["symbol","timeframe","timestamp","open","high","low","close","volume","turnover"]].to_dict("records")
    print(json.dumps(records, default=str))
except Exception as e:
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))
`;
  }

  private buildInstrumentScript(): string {
    return `
import json, sys
try:
  import efinance as ef
  df = ef.stock.get_all_code_names()
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
except Exception as e:
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))
`;
  }

  private buildShareholderMetricsScript(symbol: string): string {
    return `
import json, sys
try:
  import efinance as ef
  df = ef.stock.get_holdernumber("${symbol}")
  if df is None or df.empty:
    print(json.dumps([]))
  else:
    df.columns = [c.strip() for c in df.columns]
    # 东方财富字段：公告日期、截止日期、股东人数、户均持股、户均市值、较上期变化
    col_map = {"公告日期":"announceDate","截止日期":"endDate","股东人数":"totalHolders","户均持股":"avgHoldingShares","户均持股金额":"avgHoldingAmount","较上期变化":"changeRatio"}
    df = df.rename(columns=col_map)
    df["symbol"] = "${symbol}"
    df["announceDate"] = df["announceDate"].apply(lambda x: int(__import__("datetime").datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
    df["endDate"] = df["endDate"].apply(lambda x: int(__import__("datetime").datetime.strptime(str(x)[:10],"%Y-%m-%d").timestamp()*1000))
    records = df[["symbol","announceDate","endDate","totalHolders","avgHoldingShares","avgHoldingAmount","changeRatio"]].to_dict("records")
    print(json.dumps(records, default=str))
except Exception as e:
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))
`;
  }
}