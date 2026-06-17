"""模型训练器测试"""

import pandas as pd
import numpy as np

from quantforge_ai.model import ModelTrainer
from quantforge_ai.types import TrainConfig, ModelType


def _make_data(n: int = 200):
    np.random.seed(42)
    X = pd.DataFrame({
        "f1": np.random.randn(n),
        "f2": np.random.randn(n),
        "f3": np.random.randn(n),
    })
    y = (X["f1"] + X["f2"] > 0).astype(int)
    return X, y


def test_train_random_forest():
    X, y = _make_data()
    trainer = ModelTrainer(TrainConfig(model_type=ModelType.RandomForest))
    metrics = trainer.train(X, y)
    assert metrics.accuracy > 0.5
    assert metrics.f1 > 0.0


def test_predict():
    X, y = _make_data()
    trainer = ModelTrainer()
    trainer.train(X, y)
    preds = trainer.predict(X[:5])
    assert len(preds) == 5


def test_predict_proba():
    X, y = _make_data()
    trainer = ModelTrainer()
    trainer.train(X, y)
    probs = trainer.predict_proba(X[:5])
    assert probs.shape[0] == 5


def test_predict_before_train():
    trainer = ModelTrainer()
    try:
        trainer.predict(pd.DataFrame({"f1": [1]}))
        assert False, "should raise"
    except RuntimeError:
        pass
