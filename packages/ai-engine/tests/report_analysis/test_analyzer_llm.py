"""ReportAnalyzer LLM 集成测试"""

import json
import pytest
from unittest.mock import patch

from quantforge_ai.report_analysis.analyzer import ReportAnalyzer
from quantforge_ai.report_analysis.config import LLMConfig
from quantforge_ai.report_analysis.llm_client import LLMClientError


MOCK_LLM_OUTPUT = json.dumps({
    "executiveSummary": {
        "oneLineConclusion": "LLM 分析：策略表现稳健",
        "recommendedForLive": True,
        "recommendationReason": "夏普比率达标",
        "mainRisks": ["回撤偏大"],
        "keyMetrics": {"annualizedReturn": 0.15, "maxDrawdown": -0.12, "sharpeRatio": 1.2},
    },
    "overview": {"logic": "双均线策略", "suitableMarketRegime": ["趋势市"], "coreLogic": "均线交叉"},
    "issues": {"overfittingRisk": "low", "liquidityAssessment": "良好", "capacityEstimate": "充足"},
    "conclusion": {
        "advantages": ["夏普优秀"],
        "potentialRisks": ["回撤"],
        "improvements": ["增加过滤"],
        "liveTradingAdvice": {"suggestedCapital": "100万", "suggestedInitialPosition": "50%", "riskControlRules": ["止损"]},
    },
    "riskWarnings": {
        "limitations": [{"category": "数据质量", "description": "历史数据"}],
        "redLines": [{"rule": "回撤", "threshold": "<20%", "actual": "-12%", "passed": True}],
    },
})

SAMPLE_INPUT = {
    "config": {"strategyName": "dual_ma", "timeframe": "1d", "strategyKind": "趋势跟踪"},
    "metrics": {"totalReturn": 0.15, "annualizedReturn": 0.15, "sharpeRatio": 1.2,
                "maxDrawdown": -0.12, "winRate": 0.55, "totalTrades": 50},
    "strategyLogic": "短期均线上穿长期均线买入",
}


class TestReportAnalyzerLLM:
    def test_llm_success(self):
        config = LLMConfig(api_key="sk-test")
        analyzer = ReportAnalyzer(use_llm=True, llm_config=config)

        with patch.object(analyzer._llm_client, "chat", return_value=MOCK_LLM_OUTPUT):
            result = analyzer.analyze(SAMPLE_INPUT)

        assert result["executiveSummary"]["recommendedForLive"] is True
        assert "LLM 分析" in result["executiveSummary"]["oneLineConclusion"]

    def test_llm_failure_fallback_to_rules(self):
        config = LLMConfig(api_key="sk-test")
        analyzer = ReportAnalyzer(use_llm=True, llm_config=config)

        with patch.object(analyzer._llm_client, "chat", side_effect=LLMClientError("网络超时")):
            result = analyzer.analyze(SAMPLE_INPUT)

        # fallback 到规则引擎，应包含规则引擎的特征
        assert "oneLineConclusion" in result["executiveSummary"]
        assert "recommendedForLive" in result["executiveSummary"]
        # 规则引擎的结论不包含 "LLM 分析" 前缀
        assert "LLM 分析" not in result["executiveSummary"]["oneLineConclusion"]

    def test_rules_only_mode(self):
        analyzer = ReportAnalyzer(use_llm=False)
        result = analyzer.analyze(SAMPLE_INPUT)

        assert "oneLineConclusion" in result["executiveSummary"]
        assert "recommendedForLive" in result["executiveSummary"]
        assert isinstance(result["conclusion"]["advantages"], list)

    def test_llm_invalid_json_fallback(self):
        config = LLMConfig(api_key="sk-test")
        analyzer = ReportAnalyzer(use_llm=True, llm_config=config)

        with patch.object(analyzer._llm_client, "chat", return_value="这不是JSON"):
            result = analyzer.analyze(SAMPLE_INPUT)

        # JSON 解析失败应 fallback
        assert "oneLineConclusion" in result["executiveSummary"]

    def test_llm_missing_fields_fallback(self):
        config = LLMConfig(api_key="sk-test")
        analyzer = ReportAnalyzer(use_llm=True, llm_config=config)

        incomplete = json.dumps({"executiveSummary": {"oneLineConclusion": "ok"}})
        with patch.object(analyzer._llm_client, "chat", return_value=incomplete):
            result = analyzer.analyze(SAMPLE_INPUT)

        # 缺少必要字段应 fallback
        assert "overview" in result

    def test_llm_json_wrapped_in_markdown(self):
        """LLM 输出被 ```json ... ``` 包裹时应正确解析"""
        config = LLMConfig(api_key="sk-test")
        analyzer = ReportAnalyzer(use_llm=True, llm_config=config)

        wrapped = f"```json\n{MOCK_LLM_OUTPUT}\n```"
        with patch.object(analyzer._llm_client, "chat", return_value=wrapped):
            result = analyzer.analyze(SAMPLE_INPUT)

        assert result["executiveSummary"]["recommendedForLive"] is True

    def test_no_key_fallback_to_rules(self):
        """无 API key 时 use_llm=True 也应 fallback"""
        analyzer = ReportAnalyzer(use_llm=True, llm_config=LLMConfig(api_key=""))
        result = analyzer.analyze(SAMPLE_INPUT)

        assert "oneLineConclusion" in result["executiveSummary"]
