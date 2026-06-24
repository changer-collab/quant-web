"""报告分析器 — 输入 dict，输出结构化分析文本

设计原则：
- 不依赖 BacktestResult 等业务类型，输入/输出均为 dict
- 当前用规则引擎+模板生成，预留 LLM 接口
- 放在独立子模块，未来可拆包

输入 dict 结构：
{
    "config": {"strategyName": str, "timeframe": str, "strategyKind": str, ...},
    "metrics": {"totalReturn": float, "annualizedReturn": float, "sharpeRatio": float, ...},
    "strategyLogic": str  # 可选，策略逻辑描述
}

输出 dict 结构：
{
    "executiveSummary": {"oneLineConclusion": str, "recommendedForLive": bool, ...},
    "overview": {"logic": str, "suitableMarketRegime": list[str], ...},
    "issues": {"overfittingRisk": str, ...},
    "conclusion": {"advantages": list[str], "potentialRisks": list[str], ...},
    "riskWarnings": {"limitations": list[dict], "redLines": list[dict]}
}
"""

from __future__ import annotations
from typing import Any

from .templates import (
    get_strategy_logic,
    get_strategy_regime,
    generate_executive_conclusion,
    generate_risks,
    generate_advantages,
    generate_improvements,
    generate_limitations,
    generate_red_lines,
)


class ReportAnalyzer:
    """基于真实回测指标生成报告分析文本

    接口为纯 dict，不依赖任何业务类型。
    未来可替换为 LLM 调用，只需保持输入/输出 dict 结构不变。
    """

    def analyze(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """分析入口 — 输入 dict，输出 dict"""
        config = input_data.get("config", {})
        metrics = input_data.get("metrics", {})
        strategy_name = config.get("strategyName", "")
        strategy_logic = input_data.get("strategyLogic", "")

        return {
            "executiveSummary": self._analyze_executive(metrics),
            "overview": self._analyze_overview(strategy_name, strategy_logic),
            "issues": self._analyze_issues(metrics, config),
            "conclusion": self._analyze_conclusion(metrics),
            "riskWarnings": self._analyze_risk_warnings(metrics, config),
        }

    def _analyze_executive(self, metrics: dict) -> dict:
        m = metrics
        sharpe = m.get("sharpeRatio", 0)
        max_dd = m.get("maxDrawdown", 0)
        ann_ret = m.get("annualizedReturn", 0)
        win_rate = m.get("winRate", 0)
        total_trades = m.get("totalTrades", 0)

        conclusion, recommended, reason = generate_executive_conclusion(
            sharpe, max_dd, ann_ret, win_rate, total_trades
        )
        risks = generate_risks(max_dd, win_rate, total_trades, sharpe)

        return {
            "oneLineConclusion": conclusion,
            "recommendedForLive": recommended,
            "recommendationReason": reason,
            "mainRisks": risks,
            "keyMetrics": {
                "annualizedReturn": ann_ret,
                "maxDrawdown": max_dd,
                "sharpeRatio": sharpe,
            },
        }

    def _analyze_overview(self, strategy_name: str, strategy_logic: str) -> dict:
        logic = get_strategy_logic(strategy_name, strategy_logic)
        regime = get_strategy_regime(strategy_name)
        return {
            "logic": logic,
            "suitableMarketRegime": regime,
            "coreLogic": logic,
        }

    def _analyze_issues(self, metrics: dict, config: dict) -> dict:
        total_trades = metrics.get("totalTrades", 0)
        timeframe = config.get("timeframe", "")

        if total_trades < 10:
            overfitting = "high"
        elif total_trades < 30:
            overfitting = "medium"
        else:
            overfitting = "low"

        return {
            "overfittingRisk": overfitting,
            "liquidityAssessment": f"基于 {timeframe} 频率回测，流动性假设需根据实际标的评估",
            "capacityEstimate": f"策略交易 {total_trades} 次，容量需根据标的日均成交量评估",
        }

    def _analyze_conclusion(self, metrics: dict) -> dict:
        m = metrics
        advantages = generate_advantages(m)
        potential_risks = generate_risks(
            m.get("maxDrawdown", 0), m.get("winRate", 0),
            m.get("totalTrades", 0), m.get("sharpeRatio", 0)
        )
        improvements = generate_improvements(m)

        return {
            "advantages": advantages or ["暂无明显优势"],
            "potentialRisks": potential_risks,
            "improvements": improvements,
            "liveTradingAdvice": {
                "suggestedCapital": "≥ 100 万（保证流动性）",
                "suggestedInitialPosition": "建议从 50% 仓位开始，观察 1 个月",
                "riskControlRules": [
                    "单日回撤超过 3% 暂停交易",
                    "个股权重上限 10%",
                ],
            },
        }

    def _analyze_risk_warnings(self, metrics: dict, config: dict) -> dict:
        limitations = generate_limitations(metrics, config)
        red_lines = generate_red_lines(metrics)
        return {
            "limitations": limitations,
            "redLines": red_lines,
        }
