import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  MootdxExtra,
} from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Mootdx 适配器 — 通过 Python 子进程调用 mootdx（通达信行情）
 *
 * mootdx 走 TCP 直连通达信行情服务器（7709），不封 IP。
 * 提供日K线、周K线、月K线、分钟K线等数据。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 mootdx（pip install mootdx）
 * - 可通过 extra.pythonPath 指定 Python 路径
 */
export class MootdxAdapter implements DataSourceAdapter {
  name = 'mootdx';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as MootdxExtra | undefined;
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
    const { symbol, timeframe } = options;
    const extra = options.extra as MootdxExtra | undefined;

    // timeframe → mootdx category 映射
    const categoryMap: Record<string, number> = {
      '1d': 4,
      '1w': 5,
      '1M': 6,
      '1m': 7,
      '5m': 8,
      '15m': 9,
      '30m': 10,
      '60m': 11,
    };
    const category = categoryMap[timeframe ?? '1d'] ?? 4;

    // mootdx symbol 不带前缀，纯 6 位
    const code = symbol.replace(/^(sh|sz|SH|SZ)/, '');

    // 计算需要拉取的 K 线数量（约 2 年日K ≈ 500 条）
    const offset = 500;

    const serverConfig = extra?.server
      ? `client = Quotes.factory(market='std', server=("${extra.server}", ${extra.port ?? 7709}))`
      : `client = Quotes.factory(market='std')`;

    return `
import json, sys, os

_real_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')

try:
    from mootdx.quotes import Quotes
    ${serverConfig}
except Exception:
    sys.stdout = _real_stdout
    print(json.dumps([]))
    sys.exit(0)

sys.stdout = _real_stdout

try:
    klines = client.bars(symbol='${code}', category=${category}, offset=${offset})
    if klines is None or len(klines) == 0:
        print(json.dumps([]))
    else:
        rows = []
        for _, row in klines.iterrows():
            ts = int(str(row['datetime']).replace('-', '')[:8])
            from datetime import datetime
            dt = datetime.strptime(str(ts), '%Y%m%d')
            ms = int(dt.timestamp() * 1000)
            rows.append({
                'symbol': '${symbol}',
                'timeframe': '${timeframe ?? '1d'}',
                'timestamp': ms,
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['vol']),
                'turnover': float(row['amount']),
            })
        print(json.dumps(rows, default=str))
except Exception as e:
    sys.stdout = _real_stdout
    print(json.dumps([]), file=sys.stderr)
    print(json.dumps([]))
`;
  }
}
