"""数据客户端测试 — 使用内存 SQLite"""

import sqlite3
import tempfile
from pathlib import Path

import pandas as pd
import pytest

from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


@pytest.fixture
def db_path(tmp_path):
    """创建临时 SQLite 数据库并插入测试数据"""
    db = tmp_path / "test.db"
    conn = sqlite3.connect(str(db))
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bars (
            symbol TEXT NOT NULL, timeframe TEXT NOT NULL, timestamp INTEGER NOT NULL,
            open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
            volume REAL NOT NULL, turnover REAL NOT NULL DEFAULT 0,
            PRIMARY KEY (symbol, timeframe, timestamp)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS instruments (
            symbol TEXT PRIMARY KEY, name TEXT NOT NULL, exchange TEXT NOT NULL,
            lot_size INTEGER NOT NULL, price_tick REAL NOT NULL,
            industry TEXT NOT NULL, sector TEXT NOT NULL,
            list_date INTEGER NOT NULL, delist_date INTEGER,
            status TEXT NOT NULL, attributes TEXT
        )
    """)
    # 插入测试 bars
    for i in range(10):
        conn.execute(
            "INSERT INTO bars VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ("000001.SZ", "1d", 1000 + i * 86400, 10 + i, 11 + i, 9 + i, 10.5 + i, 1000, 10500),
        )
    conn.execute(
        "INSERT INTO instruments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("000001.SZ", "平安银行", "SZSE", 100, 0.01, "银行", "金融", 19900101, None, "active", None),
    )
    conn.commit()
    conn.close()
    return db


def test_client_init(db_path):
    client = DataClient(db_path)
    assert client._db_path == db_path


def test_client_file_not_found():
    with pytest.raises(FileNotFoundError):
        DataClient("/nonexistent/path.db")


def test_query_bars(db_path):
    client = DataClient(db_path)
    bars = client.query_bars("000001.SZ", TimeFrame.D1)
    assert len(bars) == 10
    assert bars[0].symbol == "000001.SZ"
    assert bars[0].close == 10.5


def test_query_bars_with_range(db_path):
    client = DataClient(db_path)
    bars = client.query_bars("000001.SZ", TimeFrame.D1, start_ts=1000 + 3 * 86400)
    assert len(bars) == 7


def test_query_bars_df(db_path):
    client = DataClient(db_path)
    df = client.query_bars_df("000001.SZ", TimeFrame.D1)
    assert len(df) == 10
    assert "close" in df.columns


def test_list_symbols(db_path):
    client = DataClient(db_path)
    symbols = client.list_symbols()
    assert "000001.SZ" in symbols


def test_list_instruments(db_path):
    client = DataClient(db_path)
    df = client.list_instruments()
    assert len(df) == 1
    assert df.iloc[0]["name"] == "平安银行"
