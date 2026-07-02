import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  BaostockExtra,
} from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Baostock 适配器 — 通过 Python 子进程调用 Baostock 库
 *
 * Baostock 是免费证券数据平台，无需注册即用。
 * 提供日K线、复权因子、财报、股东人数、估值等数据。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 baostock（pip install baostock）
 * - 可通过 extra.pythonPath 指定 Python 路径
 *
 * 注意：Baostock login/logout 会输出到 stdout，脚本中已重定向到 devnull。
 */
export class BaostockAdapter implements DataSourceAdapter {
  name = 'baostock';
  supportedDomains = ['market', 'reference', 'fundamental'];
  supportedDataTypes = [
    'bar',
    'instrument',
    'adjustment_factor',
    'financial_report',
    'shareholder_metrics',
    'valuation',
  ];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as BaostockExtra | undefined;
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
    if (domain === 'reference' && dataType === 'adjustment_factor') {
      return this.buildAdjustmentFactorScript(symbol, startDate, endDate);
    }
    if (domain === 'fundamental' && dataType === 'financial_report') {
      return this.buildFinancialReportScript(symbol, startDate, endDate);
    }
    if (domain === 'fundamental' && dataType === 'shareholder_metrics') {
      return this.buildShareholderMetricsScript(symbol, startDate, endDate);
    }
    if (domain === 'fundamental' && dataType === 'valuation') {
      return this.buildValuationScript(symbol, startDate, endDate);
    }

    return 'import json; print(json.dumps([]))';
  }

  /** Baostock 前缀：sh. / sz. */
  private toBsCode(symbol: string): string {
    if (symbol.startsWith('6') || symbol.startsWith('9')) return `sh.${symbol}`;
    return `sz.${symbol}`;
  }

  private formatDate(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Python 脚本头部：重定向 baostock login/logout 的 stdout */
  private get scriptHeader(): string {
    return `import json, sys, os
_real_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')
import baostock as bs
from datetime import datetime
lg = bs.login()
sys.stdout = _real_stdout`;
  }

  /** Python 脚本尾部：logout 并恢复 stdout（在 try 块内，2 空格缩进） */
  private get scriptFooter(): string {
    return `  sys.stdout = open(os.devnull, 'w')
  bs.logout()
  sys.stdout = _real_stdout
  print(json.dumps(rows, default=str))`;
  }

  /** 异常处理尾部 */
  private get scriptExcept(): string {
    return `except Exception as e:
  sys.stdout = _real_stdout
  print(json.dumps([]), file=sys.stderr)
  print(json.dumps([]))`;
  }

  private buildBarScript(symbol: string, startDate: string, endDate: string): string {
    const bsCode = this.toBsCode(symbol);
    return `
${this.scriptHeader}
try:
  rs = bs.query_history_k_data_plus("${bsCode}",
    "date,open,high,low,close,volume,amount",
    start_date="${startDate}", end_date="${endDate}",
    frequency="d", adjustflag="2")
  rows = []
  while rs.next():
    d = rs.get_row_data()
    if d[0] is None: continue
    ts = int(datetime.strptime(d[0], "%Y-%m-%d").timestamp() * 1000)
    rows.append({
      "symbol": "${symbol}", "timeframe": "1d",
      "timestamp": ts, "open": float(d[1]), "high": float(d[2]),
      "low": float(d[3]), "close": float(d[4]),
      "volume": float(d[5]), "turnover": float(d[6])
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }

  private buildInstrumentScript(): string {
    return `
${this.scriptHeader}
try:
  rs = bs.query_stock_basic()
  rows = []
  while rs.next():
    d = rs.get_row_data()
    rows.append({
      "symbol": d[1], "name": d[2],
      "exchange": "SSE" if d[1].startswith("6") else "SZSE",
      "lotSize": 100, "priceTick": 0.01,
      "industry": "", "sector": "",
      "listDate": 0, "status": d[4]
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }

  private buildAdjustmentFactorScript(symbol: string, startDate: string, endDate: string): string {
    const bsCode = this.toBsCode(symbol);
    return `
${this.scriptHeader}
try:
  rs = bs.query_adjust_factor("${bsCode}", start_date="${startDate}", end_date="${endDate}")
  rows = []
  while rs.next():
    d = rs.get_row_data()
    ts = int(datetime.strptime(d[0], "%Y-%m-%d").timestamp() * 1000)
    rows.append({
      "symbol": "${symbol}", "date": ts,
      "factor": float(d[1]), "type": "forward"
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }

  private buildFinancialReportScript(symbol: string, _startDate: string, _endDate: string): string {
    const bsCode = this.toBsCode(symbol);
    return `
${this.scriptHeader}
try:
  rs = bs.query_stock_income("${bsCode}", year=2024, quarter=4)
  rows = []
  while rs.next():
    d = rs.get_row_data()
    rows.append({
      "symbol": "${symbol}",
      "reportDate": int(datetime.strptime(d[3], "%Y-%m-%d").timestamp() * 1000) if d[3] else 0,
      "announceDate": int(datetime.strptime(d[4], "%Y-%m-%d").timestamp() * 1000) if d[4] else 0,
      "reportType": "annual",
      "revenue": float(d[5]) if d[5] else 0,
      "costOfRevenue": 0, "operatingIncome": float(d[6]) if d[6] else 0,
      "totalRevenue": float(d[7]) if d[7] else 0,
      "netIncome": float(d[8]) if d[8] else 0,
      "totalAssets": 0, "totalLiabilities": 0, "totalEquity": 0,
      "currentAssets": 0, "currentLiabilities": 0,
      "operatingCashFlow": 0, "investingCashFlow": 0,
      "financingCashFlow": 0, "freeCashFlow": 0,
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }

  private buildShareholderMetricsScript(
    symbol: string,
    startDate: string,
    endDate: string
  ): string {
    const bsCode = this.toBsCode(symbol);
    return `
${this.scriptHeader}
try:
  rs = bs.query_holdernumber("${bsCode}", start_date="${startDate}", end_date="${endDate}")
  rows = []
  while rs.next():
    d = rs.get_row_data()
    rows.append({
      "symbol": "${symbol}",
      "announceDate": int(datetime.strptime(d[1], "%Y-%m-%d").timestamp() * 1000),
      "endDate": int(datetime.strptime(d[2], "%Y-%m-%d").timestamp() * 1000),
      "totalHolders": float(d[3]),
      "avgHoldingShares": float(d[4]),
      "avgHoldingAmount": float(d[5]),
      "changeRatio": float(d[6]) if d[6] else None,
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }

  private buildValuationScript(symbol: string, startDate: string, endDate: string): string {
    const bsCode = this.toBsCode(symbol);
    return `
${this.scriptHeader}
try:
  rs = bs.query_stock_valuation("${bsCode}", start_date="${startDate}", end_date="${endDate}")
  rows = []
  while rs.next():
    d = rs.get_row_data()
    ts = int(datetime.strptime(d[1], "%Y-%m-%d").timestamp() * 1000)
    rows.append({
      "symbol": "${symbol}",
      "timestamp": ts,
      "pe": float(d[2]) if d[2] else None,
      "peTtm": float(d[3]) if d[3] else None,
      "pb": float(d[4]) if d[4] else None,
      "ps": float(d[5]) if d[5] else None,
      "psTtm": float(d[6]) if d[6] else None,
      "marketCap": float(d[7]) if d[7] else 0,
    })
  ${this.scriptFooter}
${this.scriptExcept}
`;
  }
}
