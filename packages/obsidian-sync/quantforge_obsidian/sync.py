"""SyncService — 将数据同步到 Obsidian vault 的编排器"""

from __future__ import annotations

import os

from .client import ObsidianClient
from .builders import (
    build_strategy_overview, build_strategy_note,
    build_backtest_overview, build_backtest_report,
    build_factor_overview, build_factor_note,
    build_dashboard,
    build_data_overview, build_instrument_list,
)
from quantforge_strategy import StrategyMeta
from quantforge_backtest import BacktestResult
from quantforge_factor import FactorDefinition, FactorMetrics
from quantforge_data import DataClient


class SyncService:
    def __init__(self, api_url: str | None = None) -> None:
        url = api_url or os.getenv("OBSIDIAN_API_URL") or ""
        self._client = ObsidianClient(url) if url else None

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def sync_all(
        self,
        data_client: DataClient,
        strategies: list[StrategyMeta],
        factors: list[FactorDefinition],
        backtest_records: list[dict],
    ) -> None:
        if not self._client:
            return
        c = self._client

        await _safe_put(c, "quant-web/仪表盘.md", build_dashboard(strategies, factors, len(backtest_records)))

        # 策略
        await _safe_put(c, "quant-web/策略/策略概览.md", build_strategy_overview(strategies))
        for s in strategies:
            await _safe_put(c, f"quant-web/策略/{s.name}.md", build_strategy_note(s))

        # 因子
        await _safe_put(c, "quant-web/因子/因子概览.md", build_factor_overview(factors))
        for f in factors:
            await _safe_put(c, f"quant-web/因子/{f.name}.md", build_factor_note(f))

        # 数据概览
        try:
            await _safe_put(c, "quant-web/数据/数据概览.md", build_data_overview(data_client))
        except Exception:
            pass
        try:
            await _safe_put(c, "quant-web/数据/参考数据/标的列表.md", build_instrument_list(data_client))
        except Exception:
            pass

        # 回测
        await _safe_put(c, "quant-web/回测报告/回测概览.md", build_backtest_overview(backtest_records))

    async def sync_strategy(self, meta: StrategyMeta) -> None:
        if not self._client:
            return
        await _safe_put(self._client, f"quant-web/策略/{meta.name}.md", build_strategy_note(meta))

    async def sync_backtest_result(
        self, strategy_name: str, symbol: str, result: BacktestResult,
    ) -> None:
        if not self._client:
            return
        from datetime import date
        d = date.today().isoformat()
        path = f"quant-web/回测报告/{strategy_name}-{symbol}-{d}.md"
        await _safe_put(self._client, path, build_backtest_report(strategy_name, symbol, result))

    async def sync_factor(self, definition: FactorDefinition, metrics: FactorMetrics | None = None) -> None:
        if not self._client:
            return
        await _safe_put(self._client, f"quant-web/因子/{definition.name}.md", build_factor_note(definition, metrics))

    async def sync_data_overview(self, data_client: DataClient) -> None:
        if not self._client:
            return
        try:
            await _safe_put(self._client, "quant-web/数据/数据概览.md", build_data_overview(data_client))
        except Exception:
            pass


async def _safe_put(client: ObsidianClient, path: str, content: str) -> None:
    try:
        await client.put_note(path, content)
    except Exception:
        pass
