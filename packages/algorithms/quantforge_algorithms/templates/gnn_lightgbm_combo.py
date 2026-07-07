"""GNN+LightGBM 组合选股模板。"""

from __future__ import annotations

import pandas as pd

from ..algorithms.registry import AlgorithmRegistry
from ..signal_generators.registry import SignalGeneratorRegistry
from ..types import ApplicationMode, MLSignal
from .base import AlgorithmTemplate, ComboAlgorithmTemplate, ComboContext


class GNNLightGBMComboTemplate(ComboAlgorithmTemplate):
    """GNN→LightGBM 组合选股模板。

    流水线：
    1. GNN 训练 → graph embedding artifact
    2. embedding 作为 LightGBM 的增强特征
    3. LightGBM 训练 → ranking artifact
    4. CrossSectionalRankGenerator 生成选股信号
    """

    @property
    def template_id(self) -> str:
        return "gnn_lightgbm_combo"

    @property
    def meta(self) -> AlgorithmTemplate:
        from quantforge_strategy import StrategyCategory, StrategySubcategory
        return AlgorithmTemplate(
            template_id="gnn_lightgbm_combo",
            name="GNN+LightGBM 组合选股",
            application_mode=ApplicationMode.CROSS_SECTIONAL,
            algorithm="lightgbm",
            signal_generator="cross_sectional_rank",
            description="GNN 生成行业关联 embedding → 增强 LightGBM 特征 → 截面排序选股",
            hyper_param_overrides={},
            category_hint=StrategyCategory.FACTOR_BASED,
            subcategory_hint=StrategySubcategory.ML_NONLINEAR_FACTOR,
            is_combo=True,
        )

    def run(self, ctx: ComboContext) -> list[MLSignal]:
        # Step 1: GNN 训练
        gnn = AlgorithmRegistry.get("gnn")
        gnn_artifact = gnn.train(ctx.graph_data, ctx.graph_labels, ctx.gnn_config)

        # Step 2: embedding 增强基础特征
        graph_embedding = gnn.predict(gnn_artifact, ctx.graph_data)
        embedding_cols = [f"emb_{i}" for i in range(graph_embedding.shape[1])]
        enhanced_features = pd.concat([
            ctx.base_features.reset_index(drop=True),
            pd.DataFrame(graph_embedding, columns=embedding_cols),
        ], axis=1)

        # Step 3: LightGBM 训练
        lgbm = AlgorithmRegistry.get("lightgbm")
        lgbm_artifact = lgbm.train(enhanced_features, ctx.rank_labels, ctx.lgbm_config)

        # Step 4: 信号生成
        raw_output = lgbm.predict(lgbm_artifact, enhanced_features)
        generator = SignalGeneratorRegistry.get("cross_sectional_rank")
        return generator.generate(lgbm_artifact, raw_output, ctx.signal_ctx)
