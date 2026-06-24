"""LLM Prompt 模板 — 纯函数，生成 system/user prompt

设计原则：
- 输入为 dict（与 ReportAnalyzer.analyze 相同），输出为 (system_prompt, user_prompt)
- 不依赖任何业务类型
- Prompt 期望 LLM 输出 JSON，与现有规则引擎输出结构一致
"""

from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """你是一位专业的量化策略分析师。请根据提供的回测指标数据，生成结构化的策略分析报告。

要求：
1. 用中文输出
2. 严格按照指定的 JSON 格式输出，不要输出 JSON 以外的内容
3. 分析要基于数据，给出具体数字和判断依据
4. 风险评估要客观，不要过度乐观

输出 JSON 格式：
{
  "executiveSummary": {
    "oneLineConclusion": "一句话总结",
    "recommendedForLive": true/false,
    "recommendationReason": "推荐理由",
    "mainRisks": ["风险点1", "风险点2"],
    "keyMetrics": {"annualizedReturn": 0, "maxDrawdown": 0, "sharpeRatio": 0}
  },
  "overview": {
    "logic": "策略逻辑描述",
    "suitableMarketRegime": ["适用市场环境"],
    "coreLogic": "核心逻辑"
  },
  "issues": {
    "overfittingRisk": "high/medium/low",
    "liquidityAssessment": "流动性评估",
    "capacityEstimate": "容量评估"
  },
  "conclusion": {
    "advantages": ["优势1"],
    "potentialRisks": ["风险1"],
    "improvements": ["改进方向1"],
    "liveTradingAdvice": {
      "suggestedCapital": "建议资金",
      "suggestedInitialPosition": "建议初始仓位",
      "riskControlRules": ["风控规则1"]
    }
  },
  "riskWarnings": {
    "limitations": [{"category": "类别", "description": "描述"}],
    "redLines": [{"rule": "规则", "threshold": "阈值", "actual": "实际值", "passed": true/false}]
  }
}"""


def build_prompts(input_data: dict[str, Any]) -> tuple[str, str]:
    """从回测结果 dict 构建 system/user prompt

    Returns:
        (system_prompt, user_prompt)
    """
    config = input_data.get("config", {})
    metrics = input_data.get("metrics", {})
    strategy_logic = input_data.get("strategyLogic", "")

    user_content = f"""请分析以下回测结果：

## 策略信息
- 策略名称：{config.get('strategyName', '未知')}
- 回测周期：{config.get('timeframe', '未知')}
- 策略类型：{config.get('strategyKind', '未知')}
- 策略逻辑：{strategy_logic or '未提供'}

## 回测指标
```json
{json.dumps(metrics, ensure_ascii=False, indent=2)}
```

请按照系统提示中的 JSON 格式输出分析报告。"""

    return SYSTEM_PROMPT, user_content
