"""因子抽象基类"""

from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd

from .types import FactorDefinition


class Factor(ABC):
    @property
    @abstractmethod
    def definition(self) -> FactorDefinition: ...

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.Series: ...
