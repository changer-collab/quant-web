"""安全公式因子"""

from __future__ import annotations

import ast

import numpy as np
import pandas as pd
from quantforge_strategy import ResearchMode, TimeFrame

from .factor import Factor
from .types import FactorDefinition, FactorStatus


_ALLOWED_COLUMNS = {"open", "high", "low", "close", "volume", "turnover"}
_ALLOWED_FUNCTIONS = {"pct_change", "rolling_mean", "rolling_std", "shift", "log", "rank"}


class FormulaFactor(Factor):
    """基于受限 AST 表达式计算因子值。"""

    def __init__(self, definition: FactorDefinition | str) -> None:
        if isinstance(definition, str):
            definition = FactorDefinition(
                id="custom",
                name="custom",
                formula=definition,
                category="custom",
                modes=[ResearchMode.Traditional],
                frequency=TimeFrame.D1,
                status=FactorStatus.Active,
            )
        self._definition = definition
        self._tree = self._parse(definition.formula)

    @property
    def definition(self) -> FactorDefinition:
        return self._definition

    def compute(self, df: pd.DataFrame) -> pd.Series:
        result = self._eval(self._tree.body, df)
        if isinstance(result, pd.Series):
            return result
        return pd.Series(result, index=df.index)

    def _parse(self, formula: str) -> ast.Expression:
        if not isinstance(formula, str) or "__" in formula:
            raise ValueError("Illegal formula")
        try:
            tree = ast.parse(formula, mode="eval")
        except SyntaxError as exc:
            raise ValueError("Illegal formula") from exc
        self._validate(tree)
        return tree

    def _validate(self, node: ast.AST) -> None:
        if isinstance(node, ast.Expression):
            self._validate(node.body)
            return
        if isinstance(node, ast.BinOp):
            if not isinstance(node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
                raise ValueError("Unsupported operator")
            self._validate(node.left)
            self._validate(node.right)
            return
        if isinstance(node, ast.UnaryOp):
            if not isinstance(node.op, (ast.UAdd, ast.USub)):
                raise ValueError("Unsupported operator")
            self._validate(node.operand)
            return
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in _ALLOWED_FUNCTIONS:
                raise ValueError("Unsupported function")
            if node.keywords:
                raise ValueError("Keyword arguments are not supported")
            for arg in node.args:
                self._validate(arg)
            return
        if isinstance(node, ast.Name):
            if node.id not in _ALLOWED_COLUMNS:
                raise ValueError("Unknown column")
            return
        if isinstance(node, ast.Constant):
            if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
                raise ValueError("Only numeric constants are supported")
            return
        raise ValueError("Unsupported formula syntax")

    def _eval(self, node: ast.AST, df: pd.DataFrame):
        if isinstance(node, ast.BinOp):
            left = self._eval(node.left, df)
            right = self._eval(node.right, df)
            if isinstance(node.op, ast.Add):
                return left + right
            if isinstance(node.op, ast.Sub):
                return left - right
            if isinstance(node.op, ast.Mult):
                return left * right
            if isinstance(node.op, ast.Div):
                return left / right
        if isinstance(node, ast.UnaryOp):
            value = self._eval(node.operand, df)
            if isinstance(node.op, ast.UAdd):
                return value
            if isinstance(node.op, ast.USub):
                return -value
        if isinstance(node, ast.Name):
            if node.id not in df.columns:
                raise ValueError(f"Missing column: {node.id}")
            return df[node.id]
        if isinstance(node, ast.Constant):
            return node.value
        if isinstance(node, ast.Call):
            return self._eval_call(node, df)
        raise ValueError("Unsupported formula syntax")

    def _eval_call(self, node: ast.Call, df: pd.DataFrame):
        name = node.func.id
        args = [self._eval(arg, df) for arg in node.args]

        if name == "pct_change":
            series, periods = self._series_and_window(args, df)
            return series.pct_change(periods)
        if name == "rolling_mean":
            series, window = self._series_and_window(args, df)
            return series.rolling(window).mean()
        if name == "rolling_std":
            series, window = self._series_and_window(args, df)
            return series.rolling(window).std()
        if name == "shift":
            series, periods = self._series_and_window(args, df)
            return series.shift(periods)
        if name == "log":
            series = self._single_series_arg(args, df)
            return np.log(series)
        if name == "rank":
            series = self._single_series_arg(args, df)
            return series.rank()
        raise ValueError("Unsupported function")

    def _single_series_arg(self, args: list, df: pd.DataFrame) -> pd.Series:
        if len(args) > 1:
            raise ValueError("Function expects zero or one argument")
        series = args[0] if args else self._default_close(df)
        if not isinstance(series, pd.Series):
            raise ValueError("Argument must be a series")
        return series

    def _series_and_window(self, args: list, df: pd.DataFrame) -> tuple[pd.Series, int]:
        if len(args) == 1:
            series = self._default_close(df)
            window = args[0]
        elif len(args) == 2:
            series = args[0]
            window = args[1]
        else:
            raise ValueError("Function expects one or two arguments")
        if not isinstance(series, pd.Series):
            raise ValueError("First argument must be a series")
        if not isinstance(window, (int, float)) or isinstance(window, bool) or int(window) != window:
            raise ValueError("Window argument must be a positive integer")
        window = int(window)
        if window <= 0:
            raise ValueError("Window argument must be a positive integer")
        return series, window

    def _default_close(self, df: pd.DataFrame) -> pd.Series:
        if "close" not in df.columns:
            raise ValueError("Missing column: close")
        return df["close"]
