"""轻量 SQLite 数据客户端 — 直接读取 data-center 的 SQLite 文件"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from quantforge_strategy import Bar, TimeFrame


class DataClient:
    """直接读取 data-center SQLite 数据库的轻量客户端"""

    def __init__(self, db_path: str | Path) -> None:
        self._db_path = Path(db_path)
        if not self._db_path.exists():
            raise FileNotFoundError(f"Database not found: {self._db_path}")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(str(self._db_path))

    def query_bars(
        self,
        symbol: str,
        timeframe: TimeFrame,
        start_ts: int | None = None,
        end_ts: int | None = None,
    ) -> list[Bar]:
        """查询 K 线数据"""
        conn = self._connect()
        try:
            sql = "SELECT * FROM bars WHERE symbol = ? AND timeframe = ?"
            params: list = [symbol, timeframe.value]
            if start_ts is not None:
                sql += " AND timestamp >= ?"
                params.append(start_ts)
            if end_ts is not None:
                sql += " AND timestamp <= ?"
                params.append(end_ts)
            sql += " ORDER BY timestamp ASC"
            cursor = conn.execute(sql, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [
                Bar(
                    symbol=row[columns.index("symbol")],
                    timeframe=TimeFrame(row[columns.index("timeframe")]),
                    timestamp=row[columns.index("timestamp")],
                    open=row[columns.index("open")],
                    high=row[columns.index("high")],
                    low=row[columns.index("low")],
                    close=row[columns.index("close")],
                    volume=row[columns.index("volume")],
                )
                for row in rows
            ]
        finally:
            conn.close()

    def query_bars_df(
        self,
        symbol: str,
        timeframe: TimeFrame,
        start_ts: int | None = None,
        end_ts: int | None = None,
    ) -> pd.DataFrame:
        """查询 K 线数据，返回 DataFrame"""
        conn = self._connect()
        try:
            sql = "SELECT * FROM bars WHERE symbol = ? AND timeframe = ?"
            params: list = [symbol, timeframe.value]
            if start_ts is not None:
                sql += " AND timestamp >= ?"
                params.append(start_ts)
            if end_ts is not None:
                sql += " AND timestamp <= ?"
                params.append(end_ts)
            return pd.read_sql_query(sql, conn, params=params)
        finally:
            conn.close()

    def list_symbols(self) -> list[str]:
        """列出所有合约代码"""
        conn = self._connect()
        try:
            rows = conn.execute("SELECT DISTINCT symbol FROM bars").fetchall()
            return [r[0] for r in rows]
        finally:
            conn.close()

    def list_instruments(self) -> pd.DataFrame:
        """列出所有合约信息"""
        conn = self._connect()
        try:
            return pd.read_sql_query("SELECT * FROM instruments", conn)
        finally:
            conn.close()
