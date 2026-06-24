export const traditionalCodeSample = `def rebalance(context):
    universe = select_stocks(factors=['value', 'quality', 'momentum'])
    weights = optimize(universe, max_position=0.08)
    order_target_weights(weights)`;

export const hftCodeSample = `def on_tick(book, trades):
    imbalance = book.bid_size / book.ask_size
    if imbalance > 1.8 and spread(book) < 0.02:
        buy(limit=book.ask, delay_ms=22)`;

export const aiCodeSample = `def train_model(dataset):
    features = build_features(dataset, horizon='5m')
    model = fit_xgboost(features, label='future_return')
    return backtest_predictions(model)`;
