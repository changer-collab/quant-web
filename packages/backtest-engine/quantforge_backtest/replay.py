"""行情回放器"""

from __future__ import annotations

from quantforge_strategy import Bar, Tick


class BarReplay:
    @staticmethod
    def sort_bars(bars: list[Bar]) -> list[Bar]:
        return sorted(bars, key=lambda b: b.timestamp)

    @staticmethod
    def sort_ticks(ticks: list[Tick]) -> list[Tick]:
        return sorted(ticks, key=lambda t: t.timestamp)
