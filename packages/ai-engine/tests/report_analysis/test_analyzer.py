"""ReportAnalyzer 测试"""

import pytest
from quantforge_ai.report_analysis import ReportAnalyzer


def test_analyze_excellent_strategy():
    analyzer = ReportAnalyzer()
    input_data = {
        "config": {"strategyName": "dual_ma", "timeframe": "1d", "strategyKind": "timing"},
        "metrics": {"totalReturn": 0.36, "annualizedReturn": 0.17, "sharpeRatio": 1.8,
                    "maxDrawdown": -0.12, "winRate": 0.55, "totalTrades": 30},
        "strategyLogic": "",
    }
    result = analyzer.analyze(input_data)
    assert "优秀" in result["executiveSummary"]["oneLineConclusion"]
    assert result["executiveSummary"]["recommendedForLive"] is True
    assert len(result["executiveSummary"]["mainRisks"]) > 0
    assert result["overview"]["logic"] != ""
    assert len(result["overview"]["suitableMarketRegime"]) > 0


def test_analyze_poor_strategy():
    analyzer = ReportAnalyzer()
    input_data = {
        "config": {"strategyName": "dual_ma", "timeframe": "1d", "strategyKind": "timing"},
        "metrics": {"totalReturn": -0.36, "annualizedReturn": -0.21, "sharpeRatio": -1.79,
                    "maxDrawdown": -0.38, "winRate": 0.15, "totalTrades": 33},
        "strategyLogic": "",
    }
    result = analyzer.analyze(input_data)
    assert "回撤较大" in result["executiveSummary"]["oneLineConclusion"] or "一般" in result["executiveSummary"]["oneLineConclusion"]
    assert result["executiveSummary"]["recommendedForLive"] is False


def test_analyzer_does_not_depend_on_backtest_types():
    """验证 analyzer 接口为纯 dict，不依赖 BacktestResult 类型"""
    analyzer = ReportAnalyzer()
    result = analyzer.analyze({"config": {}, "metrics": {}})
    assert "executiveSummary" in result
    assert "overview" in result
    assert "issues" in result
    assert "conclusion" in result
    assert "riskWarnings" in result


def test_analyze_issues_overfitting_risk():
    analyzer = ReportAnalyzer()
    # 交易次数 < 10 → high
    result = analyzer.analyze({
        "config": {"timeframe": "1d"},
        "metrics": {"totalTrades": 5},
    })
    assert result["issues"]["overfittingRisk"] == "high"

    # 交易次数 10-30 → medium
    result = analyzer.analyze({
        "config": {"timeframe": "1d"},
        "metrics": {"totalTrades": 20},
    })
    assert result["issues"]["overfittingRisk"] == "medium"

    # 交易次数 >= 30 → low
    result = analyzer.analyze({
        "config": {"timeframe": "1d"},
        "metrics": {"totalTrades": 50},
    })
    assert result["issues"]["overfittingRisk"] == "low"


def test_analyze_red_lines():
    analyzer = ReportAnalyzer()
    result = analyzer.analyze({
        "config": {},
        "metrics": {"maxDrawdown": -0.15, "sharpeRatio": 0.8, "totalTrades": 25},
    })
    red_lines = result["riskWarnings"]["redLines"]
    assert len(red_lines) == 3
    assert all("passed" in rl for rl in red_lines)
