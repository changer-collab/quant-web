import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  StrategyRow,
  StrategyParam,
  StrategyCategory,
  PreviewResponse,
  UiCopy,
  LanguageCode,
} from '../appData';
import { saveStrategyConfig } from '../api/strategies-config';
import { fetchPreview } from '../api/preview';
import s from '../styles/config-panel.module.css';

// ─── 子分类隶属关系 ─────────────────────────────────────

const CATEGORY_SUBCATEGORIES: Record<StrategyCategory, string[]> = {
  factor_based: ['linear_multi_factor', 'ml_nonlinear_factor'],
  non_factor: [
    'trend_cta',
    'arbitrage',
    'hft_microstructure',
    'macro_quant',
    'event_driven',
    'e2e_ai_timeseries',
  ],
  transitional: [],
};

// ─── Props ──────────────────────────────────────────────

interface ConfigPanelProps {
  strategy: StrategyRow;
  ui: UiCopy;
  language: LanguageCode;
  onPreviewUpdate?: (data: PreviewResponse | null) => void;
}

// ─── 工具函数 ───────────────────────────────────────────

/** 将数字裁剪到 [min, max] 区间 */
function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/** 生成初始参数字典 */
function buildInitialParams(params: StrategyParam[]): Record<string, unknown> {
  const map: Record<string, unknown> = {};
  for (const p of params) {
    map[p.key] = p.default;
  }
  return map;
}

/** 判断 ui_constraints 中 disable_when 是否触发 */
function isDisabled(
  param: StrategyParam,
  allValues: Record<string, unknown>,
): boolean {
  if (!param.uiConstraints) return false;
  for (const c of param.uiConstraints) {
    if (c.kind === 'disable_when' && allValues[c.target_field] === c.target_value) {
      return true;
    }
  }
  return false;
}

/** 判断 ui_constraints 中 require_when 是否触发 */
function isRequired(
  param: StrategyParam,
  allValues: Record<string, unknown>,
): boolean {
  if (!param.uiConstraints) return false;
  for (const c of param.uiConstraints) {
    if (c.kind === 'require_when' && allValues[c.target_field] === c.target_value) {
      return true;
    }
  }
  return false;
}

// ─── 模拟因子池 ─────────────────────────────────────────

const MOCK_FACTOR_POOL = [
  { id: 'ep', name: 'EP (Earnings Yield)' },
  { id: 'bp', name: 'BP (Book-to-Price)' },
  { id: 'mom', name: 'Momentum (12M-1M)' },
  { id: 'size', name: 'Size (Log Market Cap)' },
  { id: 'vol', name: 'Volatility (60D)' },
  { id: 'turn', name: 'Turnover (20D Avg)' },
  { id: 'roe', name: 'ROE' },
  { id: 'reversal', name: 'Short-Term Reversal (5D)' },
];

// ─── 模拟数据源选项 ─────────────────────────────────────

const MOCK_DATA_SOURCES = [
  { id: 'wind', name: 'Wind Financial' },
  { id: 'tushare', name: 'Tushare Pro' },
  { id: 'joinquant', name: 'JoinQuant' },
  { id: 'custom', name: 'Custom CSV' },
];

// ─── 组件 ──────────────────────────────────────────────

export function ConfigPanel({
  strategy,
  ui,
  language,
  onPreviewUpdate,
}: ConfigPanelProps) {
  // ── 分类 Tab 状态 ──
  const [activeCategory, setActiveCategory] = useState<StrategyCategory>(
    (strategy.category as StrategyCategory) ?? 'non_factor',
  );

  const availableSubcats = CATEGORY_SUBCATEGORIES[activeCategory];
  const [activeSubcategory, setActiveSubcategory] = useState<string>(
    strategy.subcategory && availableSubcats.includes(strategy.subcategory)
      ? strategy.subcategory
      : (availableSubcats[0] ?? ''),
  );

  // ── 表单参数值 ──
  const [paramValues, setParamValues] = useState<Record<string, unknown>>(
    () => buildInitialParams(strategy.params ?? []),
  );

  // ── 因子型专属状态 ──
  const [factorPool, setFactorPool] = useState<string[]>([]);
  const [winsorizationLevel, setWinsorizationLevel] = useState(3);
  const [neutralizationEnabled, setNeutralizationEnabled] = useState(false);
  const [standardizationMethod, setStandardizationMethod] = useState<'zscore' | 'minmax' | 'rank'>('zscore');

  // ── 非因子型专属状态 ──
  const [lookbackWindow, setLookbackWindow] = useState(20);
  const [holdPeriod, setHoldPeriod] = useState(5);
  const [indicators, setIndicators] = useState({ macd: false, rsi: false, bollinger: false });
  const [orderBookDepth, setOrderBookDepth] = useState(10);
  const [featureSeqLength, setFeatureSeqLength] = useState(60);
  const [eventTN, setEventTN] = useState({ tBefore: 5, nAfter: 5 });

  // ── 过渡形态专属状态 ──
  const [dataSource, setDataSource] = useState('wind');
  const [decayHalfLife, setDecayHalfLife] = useState(7);
  const [mappingTarget, setMappingTarget] = useState('momentum');

  // ── 操作状态 ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当 strategy 切换时重置所有表单状态
  const prevStrategyRef = useRef(strategy.id);
  useEffect(() => {
    if (prevStrategyRef.current !== strategy.id) {
      prevStrategyRef.current = strategy.id;
      const cat = (strategy.category as StrategyCategory) ?? 'non_factor';
      setActiveCategory(cat);
      const subs = CATEGORY_SUBCATEGORIES[cat];
      const sub = strategy.subcategory && subs.includes(strategy.subcategory)
        ? strategy.subcategory
        : (subs[0] ?? '');
      setActiveSubcategory(sub);
      setParamValues(buildInitialParams(strategy.params ?? []));
      setFactorPool([]);
      setWinsorizationLevel(3);
      setNeutralizationEnabled(false);
      setStandardizationMethod('zscore');
      setLookbackWindow(20);
      setHoldPeriod(5);
      setIndicators({ macd: false, rsi: false, bollinger: false });
      setOrderBookDepth(10);
      setFeatureSeqLength(60);
      setEventTN({ tBefore: 5, nAfter: 5 });
      setDataSource('wind');
      setDecayHalfLife(7);
      setMappingTarget('momentum');
      setSaving(false);
      setSaved(false);
      setError(null);
    }
  }, [strategy.id, strategy.category, strategy.subcategory, strategy.params]);

  // ── Preview debounce ──
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 提取 chart-relevant 参数
  const chartRelevantParams = useMemo(() => {
    const relevant: Record<string, unknown> = {};
    for (const p of strategy.params ?? []) {
      if (p.chartRelevant && paramValues[p.key] !== undefined) {
        relevant[p.key] = paramValues[p.key];
      }
    }
    return relevant;
  }, [strategy.params, paramValues]);

  // 触发 preview 的方法
  const triggerPreview = useCallback(() => {
    if (!strategy.name || Object.keys(chartRelevantParams).length === 0) return;

    fetchPreview(strategy.name, {
      symbol: '600519',
      timeframe: '1d',
      limit: 120,
      preview_params: chartRelevantParams,
    })
      .then((data) => {
        onPreviewUpdate?.(data);
      })
      .catch(() => {
        // preview 失败不阻塞使用
      });
  }, [strategy.name, chartRelevantParams, onPreviewUpdate]);

  // Debounced preview hook
  useEffect(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      triggerPreview();
    }, 300);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRelevantParams]);

  // ── 参数变更处理 ──
  function handleParamChange(key: string, value: unknown) {
    setParamValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  }

  // ── 保存配置 ──
  async function handleSave() {
    if (!strategy.name) return;
    setSaving(true);
    setError(null);
    try {
      const configPayload = {
        strategy: strategy.name,
        params: paramValues,
        ...(activeCategory === 'factor_based' && {
          factorPool,
          preprocessing: {
            winsorization: winsorizationLevel,
            neutralization: neutralizationEnabled,
            standardization: standardizationMethod,
          },
        }),
        ...(activeCategory === 'non_factor' && {
          lookbackWindow,
          holdPeriod,
          indicators: Object.entries(indicators)
            .filter(([, v]) => v)
            .map(([k]) => k),
          ...(activeSubcategory === 'hft_microstructure' && { orderBookDepth }),
          ...(activeSubcategory === 'e2e_ai_timeseries' && { featureSeqLength }),
          ...(activeSubcategory === 'event_driven' && { eventTN }),
        }),
        ...(activeCategory === 'transitional' && {
          dataSource,
          decayHalfLife,
          mappingTarget,
        }),
      };
      const result = await saveStrategyConfig(strategy.name, configPayload);
      if (result.saved) {
        setSaved(true);
        setError(null);
      } else {
        setError(ui.configPanelSaveError ?? 'Save failed');
      }
    } catch {
      setError(ui.configPanelSaveError ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // ── 切换因子选择 ──
  function toggleFactor(factorId: string) {
    setFactorPool((prev) =>
      prev.includes(factorId)
        ? prev.filter((f) => f !== factorId)
        : [...prev, factorId],
    );
  }

  // ── 切换指标 ──
  function toggleIndicator(name: 'macd' | 'rsi' | 'bollinger') {
    setIndicators((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  // ── 子类型文案 ──
  function subcategoryLabel(sub: string): string {
    const label = (ui.strategySubcategoryLabels as Record<string, string>)[sub];
    return label ?? sub;
  }

  // ── 分类 Tab 图标 ──
  function categoryIcon(cat: StrategyCategory): string {
    if (cat === 'factor_based') return 'F';
    if (cat === 'transitional') return 'T';
    return 'N';
  }

  // ══════════════════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════════════════

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── 一级 Tab：分类切换 ── */}
      <div className={s.categoryTabs}>
        {(Object.keys(CATEGORY_SUBCATEGORIES) as StrategyCategory[]).map((cat) => (
          <button
            key={cat}
            className={`${s.categoryTab} ${activeCategory === cat ? s.categoryTabActive : ''}`}
            onClick={() => {
              setActiveCategory(cat);
              const subs = CATEGORY_SUBCATEGORIES[cat];
              if (subs.length > 0 && !subs.includes(activeSubcategory)) {
                setActiveSubcategory(subs[0]);
              }
            }}
            type="button"
          >
            {categoryIcon(cat)} {(ui.configPanelCategoryTabs as Record<string, string>)[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* ── 二级 Tab：子分类切换 ── */}
      {availableSubcats.length > 0 && (
        <div className={s.subcategoryTabs}>
          {availableSubcats.map((sub) => (
            <button
              key={sub}
              className={`${s.subcategoryTab} ${activeSubcategory === sub ? s.subcategoryTabActive : ''}`}
              onClick={() => setActiveSubcategory(sub)}
              type="button"
            >
              {subcategoryLabel(sub)}
            </button>
          ))}
        </div>
      )}

      {/* ── 滚动内容区 ── */}
      <div className={s.scrollArea}>
        {/* ── 基础参数区 ── */}
        {(strategy.params ?? []).length > 0 && (
          <div className={s.section}>
            <div className={s.sectionTitle}>{ui.configPanelBasicParams}</div>
            {(strategy.params ?? []).map((param) => {
              const disabled = isDisabled(param, paramValues);
              const required = isRequired(param, paramValues);
              return (
                <div
                  key={param.key}
                  className={`${s.paramRow} ${disabled ? s.paramRowDisabled : ''}`}
                >
                  <span className={s.paramLabel}>
                    {param.label}
                    {required && (
                      <span style={{ color: '#ff6b6b', marginLeft: 4 }}>*</span>
                    )}
                  </span>
                  <div className={s.paramControl}>
                    {param.type === 'boolean' ? (
                      <div className={s.checkboxRow}>
                        <input
                          type="checkbox"
                          className={s.checkbox}
                          checked={!!paramValues[param.key]}
                          onChange={(e) => handleParamChange(param.key, e.target.checked)}
                        />
                        <span className={s.checkboxLabel}>
                          {paramValues[param.key] ? 'On' : 'Off'}
                        </span>
                      </div>
                    ) : param.type === 'select' ? (
                      <select
                        className={s.select}
                        value={String(paramValues[param.key] ?? '')}
                        onChange={(e) => handleParamChange(param.key, e.target.value)}
                      >
                        {(param.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : param.type === 'number' ? (
                      <div className={s.sliderRow}>
                        <input
                          type="range"
                          className={s.slider}
                          min={param.min ?? 0}
                          max={param.max ?? 100}
                          step={Number.isInteger(param.default) ? 1 : 0.1}
                          value={Number(paramValues[param.key] ?? 0)}
                          onChange={(e) =>
                            handleParamChange(
                              param.key,
                              Number(e.target.value),
                            )
                          }
                        />
                        <input
                          type="number"
                          className={s.numberInput}
                          min={param.min ?? 0}
                          max={param.max ?? 100}
                          step={Number.isInteger(param.default) ? 1 : 0.1}
                          value={Number(paramValues[param.key] ?? 0)}
                          onChange={(e) => {
                            const v = clamp(
                              Number(e.target.value),
                              param.min ?? -Infinity,
                              param.max ?? Infinity,
                            );
                            handleParamChange(param.key, v);
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        className={s.textInput}
                        value={String(paramValues[param.key] ?? '')}
                        onChange={(e) => handleParamChange(param.key, e.target.value)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 因子型专属区块 ── */}
        {activeCategory === 'factor_based' && (
          <>
            {/* 因子池多选 */}
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelFactorPool}</div>
              <input
                type="text"
                className={s.factorPoolSearch}
                placeholder={ui.configPanelFactorPoolPlaceholder}
              />
              <div className={s.factorPool}>
                {MOCK_FACTOR_POOL.map((f) => {
                  const selected = factorPool.includes(f.id);
                  return (
                    <span
                      key={f.id}
                      className={`${s.factorChip} ${selected ? s.factorChipSelected : ''}`}
                      onClick={() => toggleFactor(f.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') toggleFactor(f.id);
                      }}
                    >
                      {f.name}
                      {selected && <span className={s.factorChipRemove}>✕</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 数据预处理流水线 */}
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelPreprocessing}</div>
              {/* 极值缩尾 */}
              <div className={s.preprocessingRow}>
                <span className={s.paramLabel}>{ui.configPanelWinsorization}</span>
                <input
                  type="range"
                  className={s.preprocessingSlider}
                  min={1}
                  max={5}
                  step={1}
                  value={winsorizationLevel}
                  onChange={(e) => setWinsorizationLevel(Number(e.target.value))}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
                  ±{winsorizationLevel}σ
                </span>
              </div>
              {/* 中性化 */}
              <div className={s.preprocessingRow}>
                <div className={s.checkboxRow}>
                  <input
                    type="checkbox"
                    className={s.checkbox}
                    checked={neutralizationEnabled}
                    onChange={(e) => setNeutralizationEnabled(e.target.checked)}
                  />
                  <span className={s.checkboxLabel}>{ui.configPanelNeutralization}</span>
                </div>
              </div>
              {/* 标准化 */}
              <div className={s.preprocessingRow}>
                <span className={s.paramLabel}>{ui.configPanelStandardization}</span>
                <div className={s.radioGroup}>
                  {(['zscore', 'minmax', 'rank'] as const).map((method) => (
                    <label key={method} className={s.radioLabel}>
                      <input
                        type="radio"
                        name="standardization"
                        checked={standardizationMethod === method}
                        onChange={() => setStandardizationMethod(method)}
                      />
                      {method === 'zscore' ? 'Z-Score' : method === 'minmax' ? 'Min-Max' : 'Rank'}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── 非因子型专属区块 ── */}
        {activeCategory === 'non_factor' && (
          <>
            {/* 时序窗口参数 */}
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelWindowParams}</div>
              <div className={s.paramRow}>
                <span className={s.paramLabel}>{ui.configPanelLookbackWindow}</span>
                <div className={s.sliderRow}>
                  <input
                    type="range"
                    className={s.slider}
                    min={5}
                    max={120}
                    step={1}
                    value={lookbackWindow}
                    onChange={(e) => setLookbackWindow(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className={s.numberInput}
                    min={5}
                    max={120}
                    value={lookbackWindow}
                    onChange={(e) => setLookbackWindow(clamp(Number(e.target.value), 5, 120))}
                  />
                </div>
              </div>
              <div className={s.paramRow}>
                <span className={s.paramLabel}>{ui.configPanelHoldPeriod}</span>
                <div className={s.sliderRow}>
                  <input
                    type="range"
                    className={s.slider}
                    min={1}
                    max={60}
                    step={1}
                    value={holdPeriod}
                    onChange={(e) => setHoldPeriod(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className={s.numberInput}
                    min={1}
                    max={60}
                    value={holdPeriod}
                    onChange={(e) => setHoldPeriod(clamp(Number(e.target.value), 1, 60))}
                  />
                </div>
              </div>
            </div>

            {/* 指标工具箱 */}
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelIndicatorToolbox}</div>
              <div className={s.indicatorGrid}>
                {([
                  { key: 'macd' as const, label: ui.configPanelMACD },
                  { key: 'rsi' as const, label: ui.configPanelRSI },
                  { key: 'bollinger' as const, label: ui.configPanelBollinger },
                ]).map((ind) => (
                  <div
                    key={ind.key}
                    className={`${s.indicatorCard} ${indicators[ind.key] ? s.indicatorCardSelected : ''}`}
                    onClick={() => toggleIndicator(ind.key)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') toggleIndicator(ind.key);
                    }}
                  >
                    <input
                      type="checkbox"
                      className={s.indicatorCardCheckbox}
                      checked={indicators[ind.key]}
                      readOnly
                    />
                    <span className={s.indicatorCardLabel}>{ind.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 动态参数区（按子类型） */}
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelDynamicParams}</div>
              {activeSubcategory === 'hft_microstructure' && (
                <div className={s.dynamicParamRow}>
                  <span className={s.dynamicParamLabel}>Order Book Depth</span>
                  <div className={s.sliderRow}>
                    <input
                      type="range"
                      className={s.slider}
                      min={1}
                      max={50}
                      step={1}
                      value={orderBookDepth}
                      onChange={(e) => setOrderBookDepth(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className={s.numberInput}
                      min={1}
                      max={50}
                      value={orderBookDepth}
                      onChange={(e) => setOrderBookDepth(clamp(Number(e.target.value), 1, 50))}
                    />
                  </div>
                </div>
              )}
              {activeSubcategory === 'e2e_ai_timeseries' && (
                <div className={s.dynamicParamRow}>
                  <span className={s.dynamicParamLabel}>Feature Seq Length</span>
                  <div className={s.sliderRow}>
                    <input
                      type="range"
                      className={s.slider}
                      min={10}
                      max={240}
                      step={1}
                      value={featureSeqLength}
                      onChange={(e) => setFeatureSeqLength(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      className={s.numberInput}
                      min={10}
                      max={240}
                      value={featureSeqLength}
                      onChange={(e) => setFeatureSeqLength(clamp(Number(e.target.value), 10, 240))}
                    />
                  </div>
                </div>
              )}
              {activeSubcategory === 'event_driven' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className={s.dynamicParamRow}>
                    <span className={s.dynamicParamLabel}>T (Before Event)</span>
                    <input
                      type="number"
                      className={s.numberInput}
                      min={1}
                      max={30}
                      value={eventTN.tBefore}
                      onChange={(e) =>
                        setEventTN((prev) => ({
                          ...prev,
                          tBefore: clamp(Number(e.target.value), 1, 30),
                        }))
                      }
                    />
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>days</span>
                  </div>
                  <div className={s.dynamicParamRow}>
                    <span className={s.dynamicParamLabel}>N (After Event)</span>
                    <input
                      type="number"
                      className={s.numberInput}
                      min={1}
                      max={30}
                      value={eventTN.nAfter}
                      onChange={(e) =>
                        setEventTN((prev) => ({
                          ...prev,
                          nAfter: clamp(Number(e.target.value), 1, 30),
                        }))
                      }
                    />
                    <span style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>days</span>
                  </div>
                </div>
              )}
              {!['hft_microstructure', 'e2e_ai_timeseries', 'event_driven'].includes(
                activeSubcategory,
              ) && (
                <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>
                  {language === 'zh' ? '该子类型无额外动态参数' : 'No dynamic params for this subcategory'}
                </p>
              )}
            </div>
          </>
        )}

        {/* ── 过渡形态专属区块 ── */}
        {activeCategory === 'transitional' && (
          <>
            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelDataSource}</div>
              <div className={s.transitionalRow}>
                <span className={s.transitionalLabel}>{ui.configPanelDataSource}</span>
                <select
                  className={s.select}
                  value={dataSource}
                  onChange={(e) => setDataSource(e.target.value)}
                >
                  {MOCK_DATA_SOURCES.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelDecayHalfLife}</div>
              <div className={s.paramRow}>
                <span className={s.paramLabel}>{ui.configPanelDecayHalfLife}</span>
                <div className={s.sliderRow}>
                  <input
                    type="range"
                    className={s.slider}
                    min={1}
                    max={60}
                    step={1}
                    value={decayHalfLife}
                    onChange={(e) => setDecayHalfLife(Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className={s.numberInput}
                    min={1}
                    max={60}
                    value={decayHalfLife}
                    onChange={(e) => setDecayHalfLife(clamp(Number(e.target.value), 1, 60))}
                  />
                </div>
              </div>
            </div>

            <div className={s.section}>
              <div className={s.sectionTitle}>{ui.configPanelMappingTarget}</div>
              <div className={s.transitionalRow}>
                <span className={s.transitionalLabel}>{ui.configPanelMappingTarget}</span>
                <select
                  className={s.select}
                  value={mappingTarget}
                  onChange={(e) => setMappingTarget(e.target.value)}
                >
                  <option value="momentum">Momentum</option>
                  <option value="value">Value</option>
                  <option value="quality">Quality</option>
                  <option value="growth">Growth</option>
                  <option value="low_vol">Low Volatility</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── 状态提示 ── */}
        {saved && (
          <div className={`${s.statusMessage} ${s.statusSuccess}`}>
            {ui.configPanelSaved}
          </div>
        )}
        {error && (
          <div className={`${s.statusMessage} ${s.statusError}`}>
            {error}
          </div>
        )}
      </div>

      {/* ── 底部操作按钮 ── */}
      <div className={s.actionBar}>
        <button
          className={s.saveButton}
          disabled={saving}
          onClick={handleSave}
          type="button"
        >
          {saving ? ui.configPanelSaving : saved ? ui.configPanelSaved : ui.configPanelSave}
        </button>
        <button
          className={s.previewButton}
          onClick={triggerPreview}
          type="button"
        >
          {ui.configPanelPreview}
        </button>
        <button
          className={s.submitButton}
          type="button"
        >
          {ui.configPanelSubmitTask}
        </button>
      </div>
    </div>
  );
}
