"""AI 训练命令"""

from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Any, Callable

from quantforge_strategy import TimeFrame

AIPredictor = None
TrainConfig = None
ModelType = None
LabelType = None
DataClient = None


def run_ai_train(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    _emit = emit or (lambda *a, **kw: None)

    # 优先走 template_id 路径
    template_id = params.get("templateId")
    if template_id:
        return _run_with_template(template_id, params, _emit)

    # 向后兼容：无 template_id 走旧 AIPredictor 路径
    return _run_legacy(params, _emit)


def _run_with_template(template_id: str, params: dict[str, Any], emit) -> dict[str, Any]:
    """通过 TemplateRegistry 分派训练。"""
    from quantforge_algorithms import AlgorithmRegistry, TemplateRegistry
    from quantforge_algorithms.types import TrainConfig
    from quantforge_data import DataClient

    template = TemplateRegistry.get(template_id)
    data_range = params.get("dataRange", {})
    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    emit("log", {"level": "info", "message": f"Loading data for template {template_id}: {symbol} {timeframe.value}"})

    client = DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    emit("progress", {"percent": 20, "message": f"Loaded {len(df)} bars, preparing features"})

    # 构造特征和标签（简化版，真实特征工程在 ai-engine.FeatureExtractor）
    from quantforge_ai.features import FeatureExtractor

    X = FeatureExtractor.extract_all(df).dropna()
    forward_returns = df["close"].pct_change().shift(-1)
    y = (forward_returns.reindex(X.index).dropna() > 0).astype(int)
    X, y = X.align(y, join="inner", axis=0)

    emit("progress", {"percent": 50, "message": "Training model"})

    # 从模板构造 TrainConfig
    hyper_params = dict(template.hyper_param_overrides)
    hyper_params.update(params.get("hyperParams", {}))
    config = TrainConfig(
        algorithm=template.algorithm,
        application_mode=template.application_mode,
        hyper_params=hyper_params,
    )

    algorithm = AlgorithmRegistry.get(template.algorithm)
    artifact = algorithm.train(X, y, config)

    emit("progress", {"percent": 100, "message": "Training complete"})

    model_path = _resolve_model_path(params, template.algorithm, symbol, timeframe.value)
    algorithm.save(artifact, model_path)

    metrics_dict = _to_dict(artifact.metrics)
    return {
        "ok": True,
        "data": {
            **metrics_dict,
            "metrics": metrics_dict,
            "modelPath": str(model_path),
            "artifactId": artifact.artifact_id,
            "templateId": template_id,
        },
    }


def _run_legacy(params: dict[str, Any], emit) -> dict[str, Any]:
    """旧 AIPredictor 路径——向后兼容。

    Task 8 将 ModelType 降级为普通类（不可调用）、TrainConfig 字段从 model_type 改为
    algorithm + application_mode。本函数适配新类型：不再调用 _ModelType(...)，直接用字符串；
    构造 TrainConfig 时使用新字段，application_mode 固定 TIME_SERIES（旧 AIPredictor 行为）。
    """
    from quantforge_algorithms.types import ApplicationMode

    _AIPredictor, _TrainConfig, _ModelType, _LabelType, _DataClient = _load_dependencies()

    model_type_str = params.get("modelType", "randomForest")
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    emit("log", {"level": "info", "message": f"Loading data for AI training: {symbol} {timeframe.value}"})

    client = _DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    emit("progress", {"percent": 20, "message": f"Loaded {len(df)} bars, preparing features"})

    algorithm = _map_model_type_to_algorithm(model_type_str)
    config = _TrainConfig(
        algorithm=algorithm,
        application_mode=ApplicationMode.TIME_SERIES,
        label_type=_LabelType(params.get("labelType", "returnBinary")),
        test_size=params.get("testSize", 0.2),
    )

    emit("progress", {"percent": 50, "message": "Training model"})

    predictor = _AIPredictor(config)
    forward_returns = df["close"].pct_change().shift(-1)
    metrics = predictor.train(df, forward_returns)

    model_path = _resolve_model_path(params, model_type_str, symbol, timeframe.value)
    predictor.save(model_path)

    emit("progress", {"percent": 100, "message": "Training complete"})

    metrics_dict = _to_dict(metrics)
    return {
        "ok": True,
        "data": {**metrics_dict, "metrics": metrics_dict, "modelPath": str(model_path)},
    }


def _map_model_type_to_algorithm(model_type_str: str) -> str:
    """旧 ModelType 字符串映射到 AlgorithmRegistry 注册名。"""
    mapping = {
        "randomForest": "random_forest",
        "gradientBoosting": "gradient_boosting",
        "logisticRegression": "logistic_regression",
    }
    return mapping.get(model_type_str, "random_forest")


def _load_dependencies():
    global AIPredictor, TrainConfig, ModelType, LabelType, DataClient

    if AIPredictor is None:
        from quantforge_ai import AIPredictor as _AIPredictor
        AIPredictor = _AIPredictor
    if TrainConfig is None or ModelType is None or LabelType is None:
        from quantforge_ai import LabelType as _LabelType
        from quantforge_ai import ModelType as _ModelType
        from quantforge_ai import TrainConfig as _TrainConfig
        TrainConfig = _TrainConfig
        ModelType = _ModelType
        LabelType = _LabelType
    if DataClient is None:
        from quantforge_data import DataClient as _DataClient
        DataClient = _DataClient
    return AIPredictor, TrainConfig, ModelType, LabelType, DataClient


def _resolve_model_path(params: dict[str, Any], model_type: str, symbol: str, timeframe: str) -> Path:
    explicit_path = params.get("modelPath") or params.get("outputPath")
    if explicit_path:
        return Path(explicit_path).expanduser().resolve()

    model_name = Path(str(params.get("modelName") or model_type)).name
    if not model_name.endswith(".joblib"):
        model_name = f"{model_name}.joblib"
    return (Path.cwd() / "data" / "models" / model_name).resolve()


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)
