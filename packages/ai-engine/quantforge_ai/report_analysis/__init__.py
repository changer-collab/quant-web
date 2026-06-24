"""报告分析子模块 — 输入 dict，输出结构化分析文本

设计原则：
- 不依赖 BacktestResult 等业务类型，输入/输出均为 dict
- 当前用规则引擎+模板生成，预留 LLM 接口
- 放在独立子模块，未来可拆包
- 未来因子评估报告也可复用此模块
"""

from .analyzer import ReportAnalyzer

__all__ = ["ReportAnalyzer"]
