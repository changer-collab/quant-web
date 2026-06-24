"""临时检查 quant.db 内容"""
import sqlite3
from pathlib import Path

db_path = Path("data/quant.db")
print(f"DB exists: {db_path.exists()}, size: {db_path.stat().st_size}")

conn = sqlite3.connect(str(db_path))
try:
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print(f"Tables: {tables}")

    if "bars" in tables:
        cursor = conn.execute("SELECT COUNT(*) FROM bars")
        print(f"bars count: {cursor.fetchone()[0]}")

        cursor = conn.execute("SELECT DISTINCT symbol FROM bars LIMIT 20")
        symbols = [r[0] for r in cursor.fetchall()]
        print(f"symbols (first 20): {symbols}")

        cursor = conn.execute("SELECT DISTINCT timeframe FROM bars")
        timeframes = [r[0] for r in cursor.fetchall()]
        print(f"timeframes: {timeframes}")

        cursor = conn.execute("SELECT MIN(timestamp), MAX(timestamp) FROM bars")
        row = cursor.fetchone()
        print(f"timestamp range: {row}")

        cursor = conn.execute("SELECT * FROM bars LIMIT 3")
        cols = [d[0] for d in cursor.description]
        print(f"columns: {cols}")
        for r in cursor.fetchall():
            print(f"  sample: {r}")
finally:
    conn.close()
