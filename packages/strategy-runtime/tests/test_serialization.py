"""序列化工具测试"""

from quantforge_strategy.serialization import to_camel, to_snake, to_camel_dict, from_camel_dict


def test_to_camel():
    assert to_camel("filled_qty") == "filledQty"
    assert to_camel("avg_price") == "avgPrice"
    assert to_camel("market_value") == "marketValue"
    assert to_camel("unrealized_pnl") == "unrealizedPnl"
    assert to_camel("order_id") == "orderId"
    assert to_camel("id") == "id"


def test_to_snake():
    assert to_snake("filledQty") == "filled_qty"
    assert to_snake("avgPrice") == "avg_price"
    assert to_snake("marketValue") == "market_value"
    assert to_snake("unrealizedPnl") == "unrealized_pnl"
    assert to_snake("orderId") == "order_id"
    assert to_snake("id") == "id"


def test_roundtrip():
    names = ["filled_qty", "avg_price", "order_id", "initial_cash", "id"]
    for name in names:
        assert to_snake(to_camel(name)) == name


def test_to_camel_dict():
    data = {
        "filled_qty": 100,
        "avg_price": 10.5,
        "nested": {"order_id": "o1"},
        "items": [{"market_value": 1000}],
    }
    result = to_camel_dict(data)
    assert result["filledQty"] == 100
    assert result["avgPrice"] == 10.5
    assert result["nested"]["orderId"] == "o1"
    assert result["items"][0]["marketValue"] == 1000


def test_from_camel_dict():
    data = {
        "filledQty": 100,
        "avgPrice": 10.5,
        "nested": {"orderId": "o1"},
        "items": [{"marketValue": 1000}],
    }
    result = from_camel_dict(data)
    assert result["filled_qty"] == 100
    assert result["avg_price"] == 10.5
    assert result["nested"]["order_id"] == "o1"
    assert result["items"][0]["market_value"] == 1000


def test_dict_roundtrip():
    original = {
        "filled_qty": 100,
        "avg_price": 10.5,
        "nested": {"order_id": "o1"},
    }
    assert from_camel_dict(to_camel_dict(original)) == original
