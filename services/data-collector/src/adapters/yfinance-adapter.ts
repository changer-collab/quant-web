import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions, YfinanceExtra } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Yfinance 适配器 — 通过 Python 子进程调用 yfinance 库
 *
 * yfinance 提供全球市场（美股、港股等）的日K/分钟K数据，免费使用。
 * 对 A 股自动转换 symbol 格式（600519 → 600519.SS）。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 yfinance（pip install yfinance）
 * - 可通过 extra.pythonPath 指定 Python 路径
 */
export class YfinanceAdapter implements DataSourceAdapter {
  name = 'yfinance';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as YfinanceExtra | undefined;
    const pythonPath = extra?.pythonPath ?? 'python3';
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

  /** symbol 转 Yahoo Finance 格式 — A股加后缀 */
  private toYahooSymbol(symbol: string): string {
    if (symbol.includes('.')) return symbol;
    if (symbol.startsWith('6') || symbol.startsWith('9')) return `${symbol}.SS`;
    if (symbol.startsWith('0') || symbol.startsWith('3') || symbol.startsWith('2')) return `${symbol}.SZ`;
    return symbol;
  }

  private buildScript(options: AdapterFetchOptions): string {
    const { domain, dataType, symbol, timeframe } = options;
    const startDate = options.start ? this.formatDate(options.start) : '';
    const endDate = options.end ? this.formatDate(options.end) : '';
    const yahooSymbol = this.toYahooSymbol(symbol);

    if (domain === 'market' && dataType === 'bar') {
      if ((timeframe ?? '1d') === '1d') {
        return this.buildDailyBarScript(yahooSymbol, symbol, startDate, endDate);
      }
      return this.buildMinuteBarScript(yahooSymbol, symbol, timeframe ?? '1m', startDate, endDate);
    }

    return 'import json; print(json.dumps([]))';
  }

  private formatDate(ts: number): string {
    const d = new Date(ts);
    return d.toISOString().slice(0, 10);
  }

  private buildDailyBarScript(yahooSymbol: string, symbol: string, startDate: string, endDate: string): string {
    return `
import json, sys
try:
  import yfinance as yf
  ticker = yf.Ticker("${yahooSymbol}")
  df = ticker.history(start="${startDate}", end="${endDate}")
  if df is None or df.empty:
    print(json.dumps([]))
  else:
    df = df.reset_index()
    df.columns = [c.strip() for c in df.columns]
    df["timestamp"] = df["Date"].apply(lambda x: int(x.timestamp()*1000))
    df["symbol"] = "${symbol}"
    df["timeframe"] = "1d"
    col_map = {"Open":"open","High":"high","Low":"low","Close":"close","Volume":"volume"}
    df = df.rename(columns=col_map)
    # Yahoo 不直接提供成交额(turnover)，用 volume * close 近似
    df["turnover"] = df["volume"] * df["close"]
    records = df[["symbol","timeframe","timestamp","open","high","low","close","volume","turnover"]].to_dict("records")
    print(json.dumps(records, default=str))
except Exception as e:
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))
`;
  }

  private buildMinuteBarScript(yahooSymbol: string, symbol: string, timeframe: string, startDate: string, endDate: string): string {
    const interval = timeframe === '5m' ? '5m' : timeframe === '15m' ? '15m' : '1m';
    return `
import json, sys
try:
  import yfinance as yf
  ticker = yf.Ticker("${yahooSymbol}")
  df = ticker.history(start="${startDate}", end="${endDate}", interval="${interval}")
  if df is None or df.empty:
    print(json.dumps([]))
  else:
    df = df.reset_index()
    df.columns = [c.strip() for c in df.columns]
    df["timestamp"] = df["Datetime"].apply(lambda x: int(x.timestamp()*1000))
    df["symbol"] = "${symbol}"
    df["timeframe"] = "${timeframe}"
    col_map = {"Open":"open","High":"high","Low":"low","Close":"close","Volume":"volume"}
    df = df.rename(columns=col_map)
    df["turnover"] = df["volume"] * df["close"]
    records = df[["symbol","timeframe","timestamp","open","high","low","close","volume","turnover"]].to_dict("records")
    print(json.dumps(records, default=str))
except Exception as e:
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))
`;
  }
}