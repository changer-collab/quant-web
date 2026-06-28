"""报告分析子模块 — 输入 dict，输出结构化分析文本

双模式：
- LLM 驱动（默认）：调用 DeepSeek 生成分析，失败时自动 fallback 到规则引擎
- 纯规则引擎：use_llm=False 时使用

设计原则：
- 不依赖 BacktestResult 等业务类型，输入/输出均为 dict
- 未来因子评估报告也可复用此模块
"""

from .analyzer import ReportAnalyzer
from .config import LLMConfig
from .llm_client import LLMClient, LLMClientError

__all__ = ["ReportAnalyzer", "LLMConfig", "LLMClient", "LLMClientError"]
