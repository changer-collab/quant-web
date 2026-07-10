# K 线展示修复 + 模型选择机制实施计划

## 摘要

本计划解决用户提出的两个问题：
1. **搜索标的没有展示 K 线**：策略研究台中搜索标的后 K 线不展示。根因是 `workspace-page.tsx` 的 `handleSymbolChange` 静默吞掉错误、组件初始不自动加载、ConfigPanel 的 triggerPreview 硬编码 symbol='600519'、KlineChart 无错误提示。
2. **前端基础参数不应包含模型路径**：`ai_predictor.py` 暴露 `model_path` 字符串参数让前端用户手动填路径。改为后端封装模型列表，前端通过下拉框选择 `model_id`。

方案分两条主线，共 12 处改动。所有改动均基于实际代码探索，文件路径、行号、模式均来自 Phase 1 调研。

---

## 现状分析

### K 线展示链路（现状）

```
前端 KlineChart 搜索 Enter
  → workspace-page.tsx handleSymbolChange
  → fetchPreview(strategy.name, {symbol, timeframe, limit, preview_params})
  → POST /api/strategies/:name/preview
  → BarRepository.queryPaged（从 data-center SQLite 查）
  → PreviewService.computePreview（叠加 SMA/EMA/RSI/MACD）
  → 返回 { bars, overlays, signals, fingerprint }
```

**问题根因（4 个）**：

1. **静默吞错**：`workspace-page.tsx:393-412` 的 `handleSymbolChange` catch 块为空 `// 静默失败`，搜索失败时前端无任何反馈。`handleLoadMore` 同样问题（第 414-436 行）。
2. **无初始自动加载**：组件挂载时 `previewData` 初始为 `null`（第 304 行），无 effect 触发首次拉取，用户进入页面看到空状态。
3. **ConfigPanel symbol 硬编码**：`config-panel.tsx:195-210` 的 `triggerPreview` 硬编码 `symbol: '600519'`，与 KlineChart 选中的 symbol 不联动，导致参数变更触发预览时把 K 线切回 600519。
4. **KlineChart 无错误展示**：`kline-chart.tsx:381-389` 的 Props 接口无 `error` 字段，空状态文案是固定的"暂无 K 线数据"，无法区分"未加载"与"加载失败"。

### 模型参数链路（现状）

```
Python 策略：ai_predictor.py
  __init__(model_path="data/models/randomForest.joblib", ...)
  meta.params = [StrategyParamDef(key="model_path", type=ParamType.String, ...)]
  init() → _load_artifact(self._model_path) → joblib.load(path)

CLI → API：listStrategies 命令返回策略元信息
  → strategy-sync.ts syncFromPython → camelToSnakeMeta
  → /api/strategies 路由 → mapMeta → 前端

前端：ConfigPanel
  渲染 strategy.params，对 String 类型渲染 <input type="text">
  → 用户看到"模型路径"输入框，需要手动填路径
```

**问题**：用户不应看到文件路径；模型应由后端管理，前端从下拉框选择。

---

## 改动详情

### Task A：K 线修复（4 处改动）

#### 改动 1 — `apps/web/src/components/workspace-page.tsx`

**目标**：新增 klineError 状态、错误捕获、初始自动加载、传递新 props。

具体修改：

1. **新增状态**（第 306 行附近）：
   ```tsx
   const [klineSymbol, setKlineSymbol] = useState('600519');
   const [klineError, setKlineError] = useState<string | null>(null);
   ```

2. **handleSymbolChange 改为捕获错误**（第 393-412 行）：
   ```tsx
   const handleSymbolChange = useCallback(
     async (newSymbol: string) => {
       setKlineSymbol(newSymbol);
       setKlineLoading(true);
       setKlineError(null);
       try {
         const data = await fetchPreview(strategy.name, {
           symbol: newSymbol, timeframe: '1d', limit: 120, preview_params: {},
         });
         setPreviewData(data);
       } catch (err) {
         setKlineError(
           language === 'zh'
             ? `加载 ${newSymbol} K 线失败：${err instanceof Error ? err.message : String(err)}`
             : `Failed to load ${newSymbol}: ${err instanceof Error ? err.message : String(err)}`
         );
       } finally {
         setKlineLoading(false);
       }
     },
     [strategy.name, language]
   );
   ```

3. **handleLoadMore 同样改捕获**（第 414-436 行）：把 catch 改为 `setKlineError(...)`。

4. **新增初始自动加载 effect**（放在 handleSymbolChange 之后）：
   ```tsx
   useEffect(() => {
     if (previewData) return; // 已有数据不重复加载
     handleSymbolChange(klineSymbol);
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // 仅挂载时执行一次
   ```

5. **JSX 传递新 props**（第 1012-1029 行）：
   - ConfigPanel 新增 `klineSymbol={klineSymbol}` prop
   - KlineChart 新增 `error={klineError}` prop

#### 改动 2 — `apps/web/src/components/config-panel.tsx`

**目标**：triggerPreview 接收 klineSymbol prop，不再硬编码 '600519'。

具体修改：

1. **ConfigPanelProps 接口扩展**：新增 `klineSymbol?: string`
2. **函数签名解构**：`export function ConfigPanel({ strategy, ui, language, onPreviewUpdate, onConfigSaved, klineSymbol }: ConfigPanelProps)`
3. **triggerPreview 第 199 行改为**：
   ```tsx
   symbol: klineSymbol ?? '600519',
   ```
4. **useCallback 依赖数组**（第 210 行）添加 `klineSymbol`。

#### 改动 3 — `apps/web/src/components/kline-chart.tsx`

**目标**：新增 error prop 渲染错误提示。

具体修改：

1. **Props 接口**（第 381-389 行）新增：
   ```tsx
   error?: string | null;
   ```
2. **函数解构**新增 `error = null`
3. **空状态渲染**（第 698-705 行）改写，区分 error 和 empty：
   ```tsx
   {!loading && error ? (
     <div className={s.emptyState}>
       <span style={{ color: 'var(--danger, #ff6b6b)' }}>{error}</span>
       <span>{language === 'zh' ? '请检查标的代码或重试' : 'Check symbol or retry'}</span>
     </div>
   ) : !loading && (!previewData || previewData.bars.length === 0) ? (
     <div className={s.emptyState}>
       <span>{language === 'zh' ? '暂无 K 线数据' : 'No bar data'}</span>
       <span>{language === 'zh' ? '请选择一个标的并点击"预览"' : 'Select a symbol and click Preview'}</span>
     </div>
   ) : null}
   ```

#### 改动 4 — `apps/web/src/components/workspace-page.tsx`（JSX 部分）

已在改动 1 的第 5 点合并描述：ConfigPanel 传 `klineSymbol`、KlineChart 传 `error`。

---

### Task B：模型选择机制（8 处改动）

#### 改动 5 — `packages/strategies/quantforge_strategies/combined/ai_predictor.py`

**目标**：参数从 `model_path` 改为 `model_id`，保持向后兼容。

具体修改（参考系统提醒中提供的当前文件内容）：

1. **__init__ 第 27-40 行**：
   ```python
   def __init__(
       self,
       model_id: str = "randomForest",
       min_history: int = 21,
       threshold: float = 0.5,
       **kwargs: Any,
   ) -> None:
       # 向后兼容：旧配置仍传 model_path
       legacy_path = kwargs.pop("model_path", None) or kwargs.pop("modelPath", None)
       if legacy_path:
           # 从路径推断 model_id：去掉目录和 .joblib 后缀
           from pathlib import Path
           self._model_id = Path(legacy_path).stem
       else:
           self._model_id = model_id
       self._min_history = max(min_history, 21)
       self._threshold = threshold
       self._bars_by_symbol: defaultdict[str, deque[Bar]] = defaultdict(
           lambda: deque(maxlen=self._min_history)
       )
       self._artifact: Any | None = None
   ```

2. **meta.params 第 49-54 行** 改为：
   ```python
   StrategyParamDef(
       key="model_id",
       label="模型选择",
       type=ParamType.Select,
       default=self._model_id,
       options=list_available_model_ids(),  # 动态扫描 data/models/*.joblib
   ),
   ```

3. **init 第 78-80 行** 改为：
   ```python
   def init(self, context) -> None:
       self._bars_by_symbol.clear()
       self._artifact = _load_artifact_by_id(self._model_id)
   ```

4. **_load_artifact 改名+改造**（第 108-124 行）：
   ```python
   def _load_artifact_by_id(model_id: str):
       """按 model_id 加载 ModelArtifact——从 data/models/<id>.joblib 读取。"""
       from pathlib import Path
       import joblib
       from quantforge_algorithms import AlgorithmRegistry

       path = Path("data/models") / f"{model_id}.joblib"
       if not path.exists():
           raise FileNotFoundError(f"Model artifact not found: {path}")
       payload = joblib.load(path)
       algorithm_name = payload.get("algorithm")
       if not algorithm_name:
           config = payload.get("config", {})
           if isinstance(config, dict):
               algorithm_name = config.get("algorithm", "random_forest")
           else:
               algorithm_name = getattr(config, "algorithm", "random_forest")
       algorithm = AlgorithmRegistry.get(algorithm_name)
       return algorithm.load(path)


   def list_available_model_ids() -> list[str]:
       """扫描 data/models/ 目录，返回可用 model_id 列表（文件名不含扩展名）。"""
       from pathlib import Path
       models_dir = Path("data/models")
       if not models_dir.exists():
           return []
       return sorted(p.stem for p in models_dir.glob("*.joblib"))
   ```

   说明：`list_available_model_ids` 是模块级函数，在 meta 的 `options=list_available_model_ids()` 中调用；由于 meta 是 @property，每次访问都会重新扫描，但这与现有 StrategySyncService 1 分钟缓存一致，开销可接受。

#### 改动 6 — 新建 `packages/strategy-runtime/quantforge_strategy/commands/list_models.py`

**目标**：CLI 命令返回模型列表，供 API 通过 PythonBridge 调用。

文件内容：
```python
"""listModels 命令 — 返回已注册模型列表。"""

from __future__ import annotations

from typing import Any


def run_list_models(params: dict, emit=None) -> dict:
    """扫描 data/models/ 目录，返回模型列表。

    返回结构（与 listStrategies 风格一致）：
      { ok: True, data: [{ id, algorithm, trained_at, path }] }
    """
    from pathlib import Path
    import json

    models_dir = Path("data/models")
    if not models_dir.exists():
        return {"ok": True, "data": []}

    models: list[dict[str, Any]] = []
    for p in sorted(models_dir.glob("*.joblib")):
        # 从 joblib 文件头读取元信息（不完整加载，避免大模型内存压力）
        # 简化方案：直接 joblib.load 后读字段
        try:
            import joblib
            payload = joblib.load(p)
            algorithm = (
                payload.get("algorithm")
                or (payload.get("config", {}).get("algorithm") if isinstance(payload.get("config"), dict) else None)
                or "unknown"
            )
            trained_at = payload.get("trained_at", 0)
            metrics = payload.get("metrics", {})
        except Exception as e:
            # 单个文件加载失败不阻塞整体列表
            algorithm = "error"
            trained_at = 0
            metrics = {"error": str(e)}

        models.append({
            "id": p.stem,
            "algorithm": algorithm,
            "trainedAt": trained_at,
            "metrics": metrics,
            "path": str(p),
        })

    return {"ok": True, "data": models}
```

**决策**：直接 `joblib.load` 读取元信息，因为 data/models/ 当前为空，未来模型数量也不会很多；不做流式解析以保持代码简单。如果未来模型很大可改用 `joblib.load` 后只读头部字段。

#### 改动 7 — `packages/strategy-runtime/quantforge_strategy/cli.py`

**目标**：注册 listModels 命令。

具体修改（参考系统提醒中的当前文件）：

1. **第 74-77 行后新增** handler：
   ```python
   def _run_list_models(params: dict) -> dict:
       from .commands.list_models import run_list_models
       return run_list_models(params, emit=emit)
   ```

2. **_COMMANDS 字典 第 79-87 行新增**：
   ```python
   _COMMANDS = {
       "backtest": _run_backtest,
       "factorEval": _run_factor_eval,
       "aiTrain": _run_ai_train,
       "analyze": _run_analyze,
       "syncBacktest": _run_sync_backtest,
       "diagnostics": _run_diagnostics,
       "listStrategies": _run_list_strategies,
       "listModels": _run_list_models,
   }
   ```

#### 改动 8 — `packages/strategy-runtime/quantforge_strategy/commands/__init__.py`

**目标**：新增 run_list_models 包装。

在第 33 行后新增：
```python
def run_list_models(*args, **kwargs):
    from .list_models import run_list_models as _run_list_models

    return _run_list_models(*args, **kwargs)
```

并把 `__all__` 列表追加 `"run_list_models"`。

#### 改动 9 — `apps/api/src/services/strategy-sync.ts`

**目标**：StrategySyncService 新增 listModels() 方法，通过 _callCLI 调用 listModels 命令。

在 StrategySyncService 类内（clearCache 方法之前，第 210 行附近）新增：
```typescript
async listModels(): Promise<PythonModelMeta[]> {
  try {
    const result = await this._callCLI({ command: 'listModels' });
    if (result.ok && Array.isArray(result.data)) {
      return result.data as PythonModelMeta[];
    }
    console.warn('List models: CLI returned error:', result.error?.message ?? 'unknown');
    return [];
  } catch (err) {
    console.warn('List models: CLI unavailable:', (err as Error)?.message ?? String(err));
    return [];
  }
}
```

在文件顶部（PythonStrategyMeta 接口之后）新增接口定义：
```typescript
export interface PythonModelMeta {
  id: string;
  algorithm: string;
  trainedAt: number;
  metrics: Record<string, unknown>;
  path: string;
}
```

**决策**：listModels 不做缓存（与 syncFromPython 不同），因为模型训练后需要立即反映；调用频率低。

#### 改动 10 — 新建 `apps/api/src/routes/models.ts`

**目标**：新增 GET /api/models 端点。

文件内容：
```typescript
import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';

export async function modelRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const models = await strategySyncService.listModels();
    return models.map((m) => ({
      id: m.id,
      algorithm: m.algorithm,
      trainedAt: m.trainedAt,
      metrics: m.metrics,
      // path 不返回给前端，避免暴露文件系统信息
    }));
  });
}
```

#### 改动 11 — `apps/api/src/app.ts`

**目标**：注册 modelRoutes。

具体修改：

1. **第 16 行后新增** import：
   ```typescript
   import { modelRoutes } from './routes/models.js';
   ```

2. **第 46 行后新增** 注册：
   ```typescript
   await app.register(modelRoutes, { prefix: '/api/models' });
   ```

#### 改动 12 — 新建 `apps/web/src/api/models.ts` + 修改 `apps/web/src/components/config-panel.tsx`

**目标**：前端获取模型列表 + ConfigPanel 动态渲染下拉框。

**新建 `apps/web/src/api/models.ts`**：
```typescript
import { apiGet } from './client';

export interface ApiModelInfo {
  id: string;
  algorithm: string;
  trainedAt: number;
  metrics: Record<string, unknown>;
}

export function fetchModels(): Promise<ApiModelInfo[]> {
  return apiGet<ApiModelInfo[]>('/models');
}
```

**修改 `apps/web/src/components/config-panel.tsx`**：

1. **新增 import**：
   ```typescript
   import { useEffect, useState } from 'react';
   import { fetchModels, type ApiModelInfo } from '../api/models';
   ```

2. **组件内新增状态**（在现有 state 附近）：
   ```typescript
   const [models, setModels] = useState<ApiModelInfo[]>([]);
   ```

3. **新增 useEffect 拉取模型列表**：
   ```typescript
   useEffect(() => {
     const hasModelParam = (strategy.params ?? []).some((p) => p.name === 'model_id');
     if (!hasModelParam) return;
     fetchModels()
       .then(setModels)
       .catch((err) => console.warn('Failed to load models:', err));
   }, [strategy.params]);
   ```

4. **基础参数渲染分支**（第 387-398 行 select 分支之前）新增 model_id 特殊处理：
   ```tsx
   ) : param.name === 'model_id' ? (
     <select
       className={s.select}
       value={String(paramValues[param.name] ?? '')}
       onChange={(e) => handleParamChange(param.name, e.target.value)}
       disabled={models.length === 0}
     >
       {models.length === 0 ? (
         <option value="">{language === 'zh' ? '暂无可用模型' : 'No models available'}</option>
       ) : (
         models.map((m) => (
           <option key={m.id} value={m.id}>
             {m.id} ({m.algorithm})
           </option>
         ))
       )}
     </select>
   ) : param.type === 'select' ? (
   ```

**决策**：用 `param.name === 'model_id'` 硬编码判断，而非引入新的 ParamType 或 param.kind 字段。原因：
- 引入新 ParamType 会影响 Python 端、API 层、前端层多处类型契约，超出本次需求范围。
- model_id 是 ai_predictor 策略的约定参数名，硬编码判断够用且简单。
- 若未来其他策略需要模型选择，可沿用相同约定。

---

## 假设与决策

### 假设

1. **`data/models/` 目录**：当前不存在或为空（Glob 已确认）。改动后 `list_available_model_ids()` 和 listModels CLI 命令都会优雅返回空列表，前端展示"暂无可用模型"。用户训练出第一个模型后即可选择。
2. **模型文件命名**：`data/models/<model_id>.joblib`。model_id 就是文件名不含扩展名（如 `randomForest`）。
3. **ParamType.Select**：策略 meta 中 model_id 使用 Select 类型并带 `options` 字段。但 `options` 是静态扫描结果，可能不实时；前端用 `/api/models` 动态覆盖渲染。
4. **向后兼容**：`__init__` 兼容旧 `model_path` 参数（从路径推断 model_id），旧 configSnapshot 不破坏。

### 关键决策

1. **model_id 而非 artifact_id**：更简洁，与文件名直接对应。
2. **type 保持 ParamType.String**（实际改为 Select 但前端按 `param.name === 'model_id'` 覆盖渲染）：避免引入新类型字段，最小改动。
3. **listModels 不缓存**：调用频率低，训练后立即生效。
4. **path 不返回前端**：避免暴露文件系统信息。
5. **K 线错误展示用 dangerouslySetInnerHTML 不需要**：直接 React 文本插值即可。
6. **初始自动加载只在 previewData 为 null 时执行**：避免覆盖已加载的数据。

---

## 验证步骤

### 单元/集成测试

1. **Python 测试**：
   ```bash
   pnpm --filter quantforge-strategies test
   pnpm --filter quantforge-strategy-runtime test
   ```
   重点：ai_predictor 的 model_id 参数、向后兼容、_load_artifact_by_id、list_available_model_ids、run_list_models。

2. **API 测试**：
   ```bash
   pnpm --filter @quant/api test
   ```
   重点：新增 listModels service 方法、/api/models 路由。

3. **前端测试**：
   ```bash
   pnpm --filter @quant/web test
   pnpm --filter @quant/web build
   ```
   重点：ConfigPanel 渲染 model_id 下拉框、KlineChart error 展示、workspace-page 自动加载。

### 手动验证

1. **启动开发环境**：
   ```bash
   pnpm dev
   ```

2. **验证 K 线修复**：
   - 进入策略研究台，选择一个策略
   - 进入"参数配置"tab
   - 验证：页面加载后 K 线自动加载（不再显示空状态）
   - 在搜索框输入不存在的标的（如 `XXXXXX`）→ Enter
   - 验证：K 线区域展示红色错误提示，提示具体失败原因
   - 在搜索框输入有效标的（如 `000001`）→ Enter
   - 验证：K 线正常展示
   - 修改 ConfigPanel 中 chart_relevant 参数
   - 验证：K 线 symbol 保持当前选中，不切回 600519

3. **验证模型选择**：
   - 进入 ai_predictor 策略
   - 验证：基础参数区"模型选择"显示为下拉框（非文本输入）
   - 当前 data/models/ 为空 → 验证：下拉框显示"暂无可用模型"，禁用状态
   - （可选）放置一个 .joblib 文件到 data/models/ → 重新进入页面
   - 验证：下拉框列出该模型，选项格式为 `<id> (<algorithm>)`

4. **验证向后兼容**：
   - 用旧 model_path 配置初始化 AIModelStrategy
   - 验证：从路径推断出 model_id，不报错

### 验证证据

- 构建命令输出：`pnpm --filter @quant/web build` 成功
- 测试命令输出：所有测试通过
- 手动验证截图或描述：K 线错误提示、模型下拉框、自动加载行为

---

## 实施顺序

1. 先做 Task A（K 线修复），4 处改动互相耦合，一次性完成
2. 再做 Task B（模型选择），按改动 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 顺序
3. 改动 5（Python）独立可测，改动 6-8（CLI 链路）依赖改动 5，改动 9-11（API 链路）依赖改动 6-8，改动 12（前端）依赖改动 9-11
4. 完成后统一运行所有验证步骤

---

## 风险与回滚

- **风险 1**：`list_available_model_ids()` 在 meta 的 @property 中调用，每次访问都扫描目录。若 data/models/ 文件很多可能慢。**缓解**：当前为空，未来可加 lru_cache。
- **风险 2**：前端硬编码 `param.name === 'model_id'` 判断，与策略约定耦合。**缓解**：若未来其他策略需要模型选择，沿用相同命名约定即可。
- **风险 3**：`_load_artifact_by_id` 找不到文件抛 FileNotFoundError。**缓解**：策略 init 会抛错，用户在回测前能看到错误（前端 SSE 会传递 error 事件）。
- **回滚**：所有改动都是新增/替换，git revert 即可。无数据库迁移、无破坏性 API 变更（listStrategies 仍返回 model_id 参数，前端按 Select 类型渲染兜底）。
