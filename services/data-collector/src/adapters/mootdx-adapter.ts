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
 * 提供日K线、周K线、月K线、分钟K线、逐笔成交、五档盘口、F10 财务摘要等数据。
 *
 * 支持的数据类型（dataType）：
 * - bar：K 线（client.bars）
 * - trade_record：逐笔成交（client.transaction）
 * - l2_snapshot：五档盘口快照（client.quotes）
 * - f10：F10 财务摘要（client.finance）
 *
 * 依赖：
 * - Python 3.8+ 且已安装 mootdx（pip install mootdx）
 * - 可通过 extra.pythonPath 指定 Python 路径
 *
 * BESTIP 兼容：mootdx 0.11.x 全新安装时 BESTIP.HQ 为空串，裸调
 * `Quotes.factory()` 会抛 `ValueError: not enough values to unpack`。
 * buildScript 内嵌 `tdx_client()` 三级 fallback：
 *   1. 显式 server 参数（extra.server 传入，绕过 BESTIP）
 *   2. 内置可用 IP 列表 TCP 探测（7709 端口）
 *   3. 裸 factory() 兜底（依赖 BESTIP，老用户 config 已填 IP 可用）
 *   4. 全部失败抛明确错误
 */
export class MootdxAdapter implements DataSourceAdapter {
  name = 'mootdx';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar', 'trade_record', 'l2_snapshot', 'f10'];

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
    const { symbol, timeframe, dataType } = options;
    const extra = options.extra as MootdxExtra | undefined;

    // timeframe → mootdx category 映射
    // 注意：'1mo'（月线）用全小写，与 TimeFrame.Mo1='1mo' 对齐，避免与 '1m'（1分钟）大小写歧义
    const categoryMap: Record<string, number> = {
      '1d': 4,
      '1w': 5,
      '1mo': 6,
      '1m': 7,
      '5m': 8,
      '15m': 9,
      '30m': 10,
      '60m': 11,
    };
    const category = categoryMap[timeframe ?? '1d'] ?? 4;

    // mootdx symbol 不带前缀，纯 6 位
    const code = symbol.replace(/^(sh|sz|SH|SZ)/, '');

    // 计算需要拉取的数量（约 2 年日K ≈ 500 条）
    const offset = 500;

    // 显式 server 优先；否则走 tdx_client() 三级 fallback
    const explicitServer = extra?.server
      ? `("${extra.server}", ${extra.port ?? 7709})`
      : 'None';

    // 根据 dataType 选择数据拉取逻辑
    const fetchDataBlock = this.buildFetchDataBlock(dataType, symbol, code, timeframe, category, offset);

    return `
import json, sys, os, socket

_real_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')

# === tdx_client() 三级 fallback ===
# 修复 mootdx 0.11.x BESTIP.HQ 空串导致 Quotes.factory() 崩溃
# 参考：https://github.com/simonlin1212/a-stock-data Issue #26
TDX_SERVERS = [
    ("119.147.212.81", 7709),
    ("112.74.214.43", 7727),
    ("221.231.141.60", 7709),
    ("101.227.73.20", 7709),
    ("101.227.77.254", 7709),
    ("14.17.75.71", 7709),
    ("59.173.18.140", 7709),
    ("180.153.39.51", 7709),
]

def _probe_server(ip, port, timeout=2.0):
    """TCP 探测通达信服务器可用性"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        s.connect((ip, port))
        s.close()
        return True
    except Exception:
        return False

def tdx_client(explicit_server=None):
    """
    三级 fallback 创建 mootdx Quotes 客户端：
    1. 显式 server 参数（extra.server 传入）
    2. 内置 IP 列表 TCP 探测 + 显式 server= 绕过 BESTIP
    3. 裸 Quotes.factory() 兜底（老用户 config 已填 BESTIP）
    4. 全部失败抛明确错误
    """
    from mootdx.quotes import Quotes

    # Level 1: 显式 server
    if explicit_server is not None:
        try:
            return Quotes.factory(market='std', server=explicit_server)
        except Exception:
            pass

    # Level 2: 内置 IP 列表 TCP 探测
    for ip, port in TDX_SERVERS:
        if _probe_server(ip, port):
            try:
                return Quotes.factory(market='std', server=(ip, port))
            except Exception:
                continue

    # Level 3: 裸 factory 兜底（依赖 BESTIP）
    try:
        return Quotes.factory(market='std')
    except Exception as e:
        raise RuntimeError(
            "tdx_client 全部 fallback 失败：显式 server 失败、"
            "内置 IP 列表探测失败、裸 factory 失败。"
            "最后错误: " + str(e)
        )

try:
    client = tdx_client(explicit_server=${explicitServer})
except Exception:
    sys.stdout = _real_stdout
    print(json.dumps([]))
    sys.exit(0)

sys.stdout = _real_stdout

${fetchDataBlock}
`;
  }

  /** 根据 dataType 生成数据拉取代码块 */
  private buildFetchDataBlock(
    dataType: string,
    symbol: string,
    code: string,
    timeframe: string | undefined,
    category: number,
    offset: number
  ): string {
    const tf = timeframe ?? '1d';

    if (dataType === 'trade_record') {
      // 逐笔成交：client.transaction(symbol, offset)
      // mootdx 返回 DataFrame: datetime, price, vol, num, buyorsell
      // buyorsell: 0=买, 1=卖, 2=中性
      return `
try:
    trades = client.transaction(symbol='${code}', offset=${offset})
    if trades is None or len(trades) == 0:
        print(json.dumps([]))
    else:
        rows = []
        for _, row in trades.iterrows():
            # buyorsell: 0=buy, 1=sell, 2=unknown
            side_map = {0: 'buy', 1: 'sell', 2: 'unknown'}
            side = side_map.get(int(row['buyorsell']), 'unknown')
            # 解析时间：mootdx 返回 'YYYY-MM-DD HH:MM' 或类似格式
            dt_str = str(row['datetime'])
            try:
                from datetime import datetime
                if len(dt_str) >= 14:
                    dt = datetime.strptime(dt_str[:19], '%Y-%m-%d %H:%M:%S')
                elif len(dt_str) >= 10:
                    dt = datetime.strptime(dt_str[:10], '%Y-%m-%d')
                else:
                    continue
                ms = int(dt.timestamp() * 1000)
            except Exception:
                continue
            rows.append({
                'symbol': '${symbol}',
                'timestamp': ms,
                'price': float(row['price']),
                'volume': float(row['vol']),
                'side': side,
                'trade_type': 'normal',
            })
        print(json.dumps(rows, default=str))
except Exception as e:
    sys.stdout = _real_stdout
    print(json.dumps([]), file=sys.stderr)
    print(json.dumps([]))
`;
    }

    if (dataType === 'l2_snapshot') {
      // 五档盘口：client.quotes(symbol)
      // mootdx 返回包含 bids/asks 的结构
      return `
try:
    # quotes 返回五档行情，格式可能为 dict 或 DataFrame
    quotes_data = client.quotes(symbol='${code}')
    if quotes_data is None:
        print(json.dumps([]))
    else:
        from datetime import datetime
        now_ms = int(datetime.now().timestamp() * 1000)
        # 尝试解析五档盘口
        bids = []
        asks = []
        # mootdx quotes 返回格式：{'price1':..,'vol1':..,...,'price5':..,'vol5':..}
        # 或类似结构，按实际返回解析
        if isinstance(quotes_data, dict):
            for i in range(1, 6):
                bp = quotes_data.get(f'buy_price{i}') or quotes_data.get(f'bp{i}')
                bv = quotes_data.get(f'buy_vol{i}') or quotes_data.get(f'bv{i}')
                ap = quotes_data.get(f'sell_price{i}') or quotes_data.get(f'sp{i}')
                av = quotes_data.get(f'sell_vol{i}') or quotes_data.get(f'sv{i}')
                if bp is not None and bv is not None:
                    bids.append({'price': float(bp), 'volume': float(bv), 'orderCount': 0})
                if ap is not None and av is not None:
                    asks.append({'price': float(ap), 'volume': float(av), 'orderCount': 0})
        elif hasattr(quotes_data, 'to_dict'):
            d = quotes_data.to_dict()
            for i in range(1, 6):
                bp = d.get(f'buy_price{i}') or d.get(f'bp{i}')
                bv = d.get(f'buy_vol{i}') or d.get(f'bv{i}')
                ap = d.get(f'sell_price{i}') or d.get(f'sp{i}')
                av = d.get(f'sell_vol{i}') or d.get(f'sv{i}')
                if bp is not None and bv is not None:
                    bids.append({'price': float(bp), 'volume': float(bv), 'orderCount': 0})
                if ap is not None and av is not None:
                    asks.append({'price': float(ap), 'volume': float(av), 'orderCount': 0})
        rows = [{
            'symbol': '${symbol}',
            'timestamp': now_ms,
            'bids': bids,
            'asks': asks,
        }]
        print(json.dumps(rows, default=str))
except Exception as e:
    sys.stdout = _real_stdout
    print(json.dumps([]), file=sys.stderr)
    print(json.dumps([]))
`;
    }

    if (dataType === 'f10') {
      // F10 财务摘要：client.finance(symbol)
      // mootdx 返回财务数据 dict/Series
      return `
try:
    finance_data = client.finance(symbol='${code}')
    if finance_data is None:
        print(json.dumps([]))
    else:
        from datetime import datetime
        now_ms = int(datetime.now().timestamp() * 1000)
        # finance 返回 dict 或 Series，转为 dict 输出
        if hasattr(finance_data, 'to_dict'):
            data = finance_data.to_dict()
        elif isinstance(finance_data, dict):
            data = finance_data
        else:
            data = {'value': str(finance_data)}
        # 转换值为 JSON 可序列化类型
        clean_data = {}
        for k, v in data.items():
            try:
                if isinstance(v, (int, float, str, bool)):
                    clean_data[k] = v
                else:
                    clean_data[k] = str(v)
            except Exception:
                clean_data[k] = str(v)
        rows = [{
            'symbol': '${symbol}',
            'timestamp': now_ms,
            'data_type': 'f10',
            'payload': clean_data,
            'source': 'mootdx',
        }]
        print(json.dumps(rows, default=str))
except Exception as e:
    sys.stdout = _real_stdout
    print(json.dumps([]), file=sys.stderr)
    print(json.dumps([]))
`;
    }

    // 默认：bar（K 线）
    return `
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
                'timeframe': '${tf}',
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
