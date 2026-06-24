"""报告分析器 — 输入 dict，输出结构化分析文本

设计原则：
- 不依赖 BacktestResult 等业务类型，输入/输出均为 dict
- 双模式：LLM 驱动（优先）+ 规则引擎 fallback
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

import json
import logging
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
from .config import LLMConfig
from .llm_client import LLMClient, LLMClientError
from .prompts import build_prompts

logger = logging.getLogger(__name__)


class ReportAnalyzer:
    """基于回测指标生成报告分析文本

    双模式：
    - use_llm=True（默认）：调用 DeepSeek 生成分析，失败时自动 fallback 到规则引擎
    - use_llm=False：纯规则引擎，行为与升级前完全一致
    """

    def __init__(self, use_llm: bool = True, llm_config: LLMConfig | None = None):
        self._use_llm = use_llm
        self._llm_client = LLMClient(llm_config) if use_llm else None

    def analyze(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """分析入口 — 输入 dict，输出 dict"""
        if self._use_llm and self._llm_client and self._llm_client.available:
            try:
                return self._analyze_via_llm(input_data)
            except LLMClientError as e:
                logger.warning("LLM 分析失败，fallback 到规则引擎: %s", e)

        return self._analyze_via_rules(input_data)

    def _analyze_via_llm(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """通过 DeepSeek LLM 生成分析"""
        system_prompt, user_prompt = build_prompts(input_data)
        raw = self._llm_client.chat(system_prompt, user_prompt)

        # 兼容 LLM 可能包裹 ```json ... ``` 的情况
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

        try:
            result = json.loads(text)
        except json.JSONDecodeError as e:
            raise LLMClientError(f"LLM 输出 JSON 解析失败: {e}") from e

        # 校验必要字段，缺失则 fallback
        required_keys = {"executiveSummary", "overview", "issues", "conclusion", "riskWarnings"}
        if not required_keys.issubset(result.keys()):
            raise LLMClientError(f"LLM 输出缺少必要字段: {result.keys()}")

        return result

    def _analyze_via_rules(self, input_data: dict[str, Any]) -> dict[str, Any]:
        """通过规则引擎生成分析（与升级前行为一致）"""
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

    # ---- 以下规则引擎方法与升级前完全一致，未做任何修改 ----

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
