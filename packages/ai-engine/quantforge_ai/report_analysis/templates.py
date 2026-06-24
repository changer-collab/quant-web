"""分析模板和规则引擎 — 纯函数，无外部依赖

所有函数均接收原始值（float/int/str），返回文本或结构化数据。
不依赖任何业务类型，确保跨包安全。
"""

from __future__ import annotations

# 策略逻辑描述映射
_STRATEGY_LOGIC = {
    'dual_ma': '双均线交叉策略，当短期均线上穿长期均线时买入，下穿时卖出',
    'rsi': 'RSI 均值回归策略，超卖时买入，超买时卖出',
    'bollinger_band': '布林带突破策略，价格突破上轨买入，跌破下轨卖出',
    'macd': 'MACD 策略，基于快慢线交叉和柱状图变化产生信号',
    'kdj': 'KDJ 策略，基于 K/D 交叉和超买超卖区间产生信号',
}

# 策略适用市场环境映射
_STRATEGY_REGIME = {
    'dual_ma': ['趋势市', '弱震荡市'],
    'rsi': ['震荡市', '区间市'],
    'bollinger_band': ['震荡市', '区间市'],
    'macd': ['趋势市', '弱震荡市'],
    'kdj': ['震荡市', '区间市'],
}


def get_strategy_logic(name: str, fallback: str = '') -> str:
    """获取策略逻辑描述"""
    return _STRATEGY_LOGIC.get(name, fallback)


def get_strategy_regime(name: str) -> list[str]:
    """获取策略适用市场环境"""
    return _STRATEGY_REGIME.get(name, ['all'])


def generate_executive_conclusion(
    sharpe: float, max_dd: float, ann_ret: float, win_rate: float, total_trades: int
) -> tuple[str, bool, str]:
    """生成执行摘要结论

    Returns:
        (一句话结论, 是否推荐实盘, 推荐理由)
    """
    if sharpe > 1.5 and abs(max_dd) < 0.15:
        return (
            f"策略表现优秀，年化收益 {ann_ret:.1%}，夏普 {sharpe:.2f}，风险收益比良好",
            True,
            "策略回撤可控，夏普比率优秀，建议小资金实盘验证",
        )
    if sharpe > 1.0 and win_rate > 0.4:
        return (
            f"策略表现稳健，年化收益 {ann_ret:.1%}，夏普 {sharpe:.2f}，建议进一步优化",
            True,
            "策略夏普达标，胜率可接受，建议优化后实盘验证",
        )
    if max_dd < -0.3:
        return (
            f"策略回撤较大（{max_dd:.1%}），需要加强风险控制",
            False,
            "最大回撤超过 30%，不建议直接实盘",
        )
    return (
        f"策略表现一般，年化收益 {ann_ret:.1%}，夏普 {sharpe:.2f}，建议重新评估",
        False,
        "策略表现未达标，建议调整参数或更换策略",
    )


def generate_risks(
    max_dd: float, win_rate: float, total_trades: int, sharpe: float
) -> list[str]:
    """生成风险点列表"""
    risks: list[str] = []
    if max_dd < -0.2:
        risks.append(f"最大回撤 {max_dd:.1%}，超过 20%")
    if win_rate < 0.4:
        risks.append(f"胜率 {win_rate:.1%}，偏低")
    if total_trades < 10:
        risks.append(f"交易次数 {total_trades}，统计意义不足")
    if sharpe < 0:
        risks.append(f"夏普比率 {sharpe:.2f}，为负值")
    if not risks:
        risks.append("未发现显著风险点")
    return risks


def generate_advantages(metrics: dict) -> list[str]:
    """生成策略优势列表"""
    advantages: list[str] = []
    sharpe = metrics.get("sharpeRatio", 0)
    ann_ret = metrics.get("annualizedReturn", 0)
    max_dd = metrics.get("maxDrawdown", 0)

    if sharpe > 1.0:
        advantages.append(f"夏普比率 {sharpe:.2f}，风险调整收益良好")
    if ann_ret > 0:
        advantages.append(f"年化收益 {ann_ret:.1%}，为正收益")
    if abs(max_dd) < 0.15:
        advantages.append(f"最大回撤 {max_dd:.1%}，回撤可控")
    return advantages


def generate_improvements(metrics: dict) -> list[str]:
    """生成改进方向列表"""
    improvements: list[str] = []
    win_rate = metrics.get("winRate", 0)
    max_dd = metrics.get("maxDrawdown", 0)
    total_trades = metrics.get("totalTrades", 0)

    if win_rate < 0.4:
        improvements.append("考虑增加信号过滤条件，提高胜率")
    if max_dd < -0.2:
        improvements.append("引入止损机制，控制最大回撤")
    if total_trades < 20:
        improvements.append("放宽信号条件或扩展回测区间，增加交易次数")
    if not improvements:
        improvements.append("策略表现稳定，可考虑扩展至多标的组合")
    return improvements


def generate_limitations(metrics: dict, config: dict) -> list[dict]:
    """生成局限性列表"""
    limitations = [
        {"category": "数据质量", "description": "回测使用历史数据，可能存在前视偏差"},
        {"category": "流动性假设", "description": "假设按收盘价成交，大单冲击未完全建模"},
    ]
    total_trades = metrics.get("totalTrades", 0)
    if total_trades < 20:
        limitations.append({"category": "样本量", "description": f"交易次数仅 {total_trades} 次，统计意义有限"})
    return limitations


def generate_red_lines(metrics: dict) -> list[dict]:
    """生成红线检查列表"""
    max_dd = metrics.get("maxDrawdown", 0)
    sharpe = metrics.get("sharpeRatio", 0)
    total_trades = metrics.get("totalTrades", 0)
    return [
        {"rule": "最大回撤", "threshold": "< 20%", "actual": f"{max_dd:.1%}", "passed": abs(max_dd) < 0.2},
        {"rule": "夏普比率", "threshold": "> 0.5", "actual": f"{sharpe:.2f}", "passed": sharpe > 0.5},
        {"rule": "交易次数", "threshold": "≥ 20", "actual": str(total_trades), "passed": total_trades >= 20},
    ]
