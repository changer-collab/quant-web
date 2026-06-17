"""从 F:\\data\\Ashare_data 导入 xlsx 数据到 data-center 的 bars + valuations 表

用法:
  python scripts/import-xlsx.py 000001.SZ          # 导入单个
  python scripts/import-xlsx.py 000001.SZ 600519.SH # 导入多个
  python scripts/import-xlsx.py --all               # 导入全部（5610 个文件）

字段映射:
  bars:
    代码 → symbol, 日期 → timestamp, 开盘价 → open, 最高价 → high,
    最低价 → low, 收盘价 → close, 成交量 → volume, 成交金额 → turnover
  valuations:
    A股流通市值 → market_cap, 市盈率 → pe_ttm,
    换手率 → turnover_rate, A股流通股本 → float_shares
    (pb/ps_ttm/dividend_yield 数据源未提供，留空)
"""
import sys
import sqlite3
import time
from pathlib import Path
import pandas as pd

DB_PATH = "data/quant.db"
XLSX_DIR = Path("F:/data/Ashare_data")
TIMEFRAME = "1d"
BATCH_SIZE = 500  # 每多少行提交一次事务


def parse_symbol_code(code: str) -> str:
    """000001.SZ → 000001（data-center 用纯数字代码）"""
    return code.split(".")[0]


def to_timestamp_ms(dt) -> int:
    """日期 → UTC 0:00 毫秒时间戳

    时区约定：日线数据统一用 UTC 0:00（timestamp % 86400000 == 0）。
    查询时也用 UTC 0:00，例如：
      datetime(2024, 6, 3, tzinfo=timezone.utc).timestamp() * 1000
    """
    ts = pd.Timestamp(dt)
    return int(pd.Timestamp(year=ts.year, month=ts.month, day=ts.day, tz='UTC').value // 1_000_000)


def safe_float(val) -> float | None:
    """处理 '--' 等缺失值，返回 None 让 SQLite 存 NULL"""
    if val is None or val == "--" or pd.isna(val):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def required_float(val) -> float:
    """OHLCV 等必填字段，缺失时返回 0.0（NOT NULL 约束）"""
    v = safe_float(val)
    return v if v is not None else 0.0


def import_one(conn: sqlite3.Connection, xlsx_path: Path) -> tuple[int, int]:
    """导入单个 xlsx 文件，返回 (bars行数, valuations行数)"""
    df = pd.read_excel(xlsx_path, engine="calamine")

    # 过滤垃圾行（代码为空或非正常代码）
    df = df[df["代码"].astype(str).str.match(r"^\d{6}\.(SZ|SH)$", na=False)]
    if df.empty:
        return (0, 0)

    bar_rows = []
    val_rows = []
    for _, r in df.iterrows():
        symbol = parse_symbol_code(r["代码"])
        ts = to_timestamp_ms(r["日期"])

        # bars 表（OHLCV 必填，用 required_float）
        bar_rows.append((
            symbol, TIMEFRAME, ts,
            required_float(r["开盘价(元)"]),
            required_float(r["最高价(元)"]),
            required_float(r["最低价(元)"]),
            required_float(r["收盘价(元)"]),
            required_float(r["成交量(股)"]),
            required_float(r["成交金额(元)"]),
            None,  # open_interest
            None,  # num_trades
        ))

        # valuations 表
        val_rows.append((
            symbol, ts,
            safe_float(r["A股流通市值(元)"]),  # market_cap
            safe_float(r["市盈率"]),            # pe_ttm
            None,                               # pb (数据源未提供)
            None,                               # ps_ttm (数据源未提供)
            None,                               # dividend_yield (数据源未提供)
            safe_float(r["换手率(%)"]),         # turnover_rate
            safe_float(r["A股流通股本(股)"]),   # float_shares
        ))

    # 批量 upsert bars
    conn.executemany(
        """INSERT OR REPLACE INTO bars
           (symbol, timeframe, timestamp, open, high, low, close, volume, turnover, open_interest, num_trades)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        bar_rows,
    )
    # 批量 upsert valuations
    conn.executemany(
        """INSERT OR REPLACE INTO valuations
           (symbol, timestamp, market_cap, pe_ttm, pb, ps_ttm, dividend_yield, turnover_rate, float_shares)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        val_rows,
    )
    conn.commit()
    return (len(bar_rows), len(val_rows))


def ensure_valuations_columns(conn: sqlite3.Connection):
    """确保 valuations 表有新字段（兼容旧库）"""
    cur = conn.execute("PRAGMA table_info(valuations)")
    cols = {row[1] for row in cur.fetchall()}
    for col in ["turnover_rate", "float_shares"]:
        if col not in cols:
            conn.execute(f"ALTER TABLE valuations ADD COLUMN {col} REAL")
            print(f"  已添加字段: valuations.{col}")
    conn.commit()


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    if args[0] == "--all":
        files = sorted(XLSX_DIR.glob("*.xlsx"))
        print(f"全量导入: {len(files)} 个文件")
    else:
        files = []
        for code in args:
            p = XLSX_DIR / f"{code}.xlsx"
            if not p.exists():
                print(f"文件不存在: {p}")
                sys.exit(1)
            files.append(p)

    conn = sqlite3.connect(DB_PATH)
    ensure_valuations_columns(conn)

    total_bars = 0
    total_vals = 0
    failed = 0
    start = time.time()
    last_report = start

    for i, f in enumerate(files, 1):
        try:
            n_bars, n_vals = import_one(conn, f)
            total_bars += n_bars
            total_vals += n_vals
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(files)}] {f.name}: 失败 - {e}")

        # 每 100 个文件或 10 秒报告一次进度
        now = time.time()
        if i % 100 == 0 or now - last_report > 10:
            elapsed = now - start
            rate = i / elapsed if elapsed > 0 else 0
            eta = (len(files) - i) / rate if rate > 0 else 0
            print(f"[{i}/{len(files)}] {i*100//len(files)}% | "
                  f"bars={total_bars} val={total_vals} | "
                  f"{rate:.1f} 文件/秒 | 剩余 {eta:.0f}s | 失败 {failed}")
            last_report = now

    conn.close()
    elapsed = time.time() - start
    db_size = Path(DB_PATH).stat().st_size / 1024 / 1024
    print(f"\n完成: {len(files)} 文件, {total_bars} bars, {total_vals} valuations")
    print(f"失败: {failed} 文件, 耗时 {elapsed:.1f}s, 数据库 {db_size:.1f} MB")


if __name__ == "__main__":
    main()
