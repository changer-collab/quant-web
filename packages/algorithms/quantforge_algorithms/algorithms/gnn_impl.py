"""GNN 算法骨架——延迟导入 torch，接口完整但训练用占位实现。

真实 GNN 训练（torch-geometric）作为后续工作。当前骨架：
- train：用 PCA 降维作为 embedding 占位（不依赖 torch）
- predict：用同一 PCA 变换输出 embedding
- save/load：joblib 持久化

这样组合模板 GNN→LightGBM 可以端到端跑通，真实 GNN 替换时不改接口。
"""

from __future__ import annotations

import uuid
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from ..types import (
    AlgorithmMeta,
    ApplicationMode,
    HyperParamDef,
    ModelArtifact,
    ModelMetrics,
    TrainConfig,
)
from .base import Algorithm


class GNNAlgorithm(Algorithm):
    """GNN 算法骨架——用 PCA 降维占位实现，真实 GNN 训练作为后续工作。"""

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="gnn",
            supported_modes=[ApplicationMode.GRAPH_EMBEDDING],
            hyper_param_defs=[
                HyperParamDef(key="embedding_dim", label="嵌入维度", type="int", default=8, range=(2, 64)),
            ],
            description="GNN 图嵌入算法（骨架，PCA 占位，真实 GNN 后续实现）",
            version="0.1.0",
        )

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        from sklearn.decomposition import PCA

        embedding_dim = config.hyper_params.get("embedding_dim", 8)
        n_components = min(embedding_dim, X.shape[1], len(X))

        model = PCA(n_components=n_components)
        model.fit(X.values)

        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="gnn",
            model=model,
            config=config,
            metrics=ModelMetrics(),
            feature_schema=list(X.columns),
            application_mode=ApplicationMode.GRAPH_EMBEDDING,
            trained_at=int(pd.Timestamp.now().timestamp()),
        )

    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        return artifact.model.transform(X.values)

    def save(self, artifact: ModelArtifact, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": artifact.model,
            "config": artifact.config,
            "feature_schema": artifact.feature_schema,
            "application_mode": artifact.application_mode,
            "metrics": artifact.metrics,
        }, path)

    def load(self, path: Path) -> ModelArtifact:
        payload = joblib.load(path)
        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="gnn",
            model=payload["model"],
            config=payload["config"],
            metrics=payload["metrics"],
            feature_schema=payload["feature_schema"],
            application_mode=payload["application_mode"],
            trained_at=int(pd.Timestamp.now().timestamp()),
            artifact_path=str(path),
        )
