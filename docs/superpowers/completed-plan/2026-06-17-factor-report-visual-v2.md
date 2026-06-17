# 因子报告视觉优化 V2：族群表格回退 + 中性化卡片对齐

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将相关性族群从知识图谱退回表格设计（族名横向排列为列头），并将中性化与剥离改为分域表现同款卡片网格布局以彻底解决列对齐问题。

**Architecture:** 两个独立改造：(1) 相关性族群 — 移除 FactorGraph 引用，用横向分组表格展示，每个 Cluster 作为一列，因子作为行；(2) 中性化 — 4 个 section 合并为卡片网格布局，每个卡片内含一张 Grid 表格，与分域表现视觉一致。删除不再使用的 FactorGraph 组件和相关 CSS。

**Tech Stack:** React 19, CSS Modules, TypeScript

---

## 问题根因

### 1. 相关性族群知识图谱
- 用户反馈知识图谱不如表格直观
- 方案：退回表格，但族名横向排列为列头，每列一个 Cluster，因子作为行

### 2. 中性化列不对齐
- 根因：4 个 `FactorReportSection` 各自包含独立 Grid 表格，`display: contents` 的行无法跨 section 共享列宽
- 分域表现之所以对齐，是因为每个卡片内的表格是独立的、列宽由卡片自身约束
- 方案：仿照分域表现的 `domainGrid` + `domainCard` 模式，4 个子表各占一个卡片

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `apps/web/src/components/factor-report/FactorCorrelation.tsx` | 族群改为横向分组表格，移除 FactorGraph 引用 |
| 修改 | `apps/web/src/components/factor-report/FactorNeutralization.tsx` | 改为卡片网格布局 |
| 修改 | `apps/web/src/styles/factor-report.module.css` | 新增族群横向表格样式、中性化卡片复用 domainCard |
| 删除 | `apps/web/src/components/factor-report/FactorGraph.tsx` | 不再使用 |
| 修改 | `apps/web/src/components/factor-report/index.ts` | 移除 FactorGraph 导出 |

---

### Task 1: CSS — 新增族群横向表格样式，中性化复用 domainCard

**Files:**
- Modify: `apps/web/src/styles/factor-report.module.css`

- [ ] **Step 1: 在 CSS 末尾添加族群横向表格样式**

在 `.graphLegendDot` 样式之后添加：

```css
/* ── Cluster Horizontal Table ────────────────────────────── */

.clusterGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-lg);
}

.clusterCard {
  border: 1px solid var(--line);
  background: var(--gradient-panel);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.clusterCardTitle {
  padding: var(--space-md) var(--space-lg);
  color: var(--green);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  border-bottom: 1px solid var(--line);
  background: rgba(77, 240, 160, 0.04);
}

.clusterFactorList {
  padding: var(--space-sm) 0;
}

.clusterFactorItem {
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  color: var(--text);
  border-bottom: 1px solid rgba(38, 54, 50, 0.5);
  display: flex;
  align-items: center;
  gap: 8px;
}

.clusterFactorItem:last-child {
  border-bottom: none;
}

.clusterFactorDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Neutralization Card Grid (reuses domainCard pattern) ── */

.neutGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.neutCard {
  border: 1px solid var(--line);
  background: var(--gradient-panel);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.neutCardTitle {
  padding: var(--space-md) var(--space-lg);
  color: var(--green);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  border-bottom: 1px solid var(--line);
  background: rgba(77, 240, 160, 0.04);
}
```

- [ ] **Step 2: 删除不再使用的知识图谱 CSS**

删除以下 CSS 块：`.graphContainer`, `.graphSvg`, `.graphTooltip`, `.graphTooltip.visible`, `.graphLegend`, `.graphLegendItem`, `.graphLegendDot`

---

### Task 2: FactorCorrelation — 族群改为横向分组表格

**Files:**
- Modify: `apps/web/src/components/factor-report/FactorCorrelation.tsx`

- [ ] **Step 1: 重写 FactorCorrelation.tsx**

移除 FactorGraph 引用，族群改为横向卡片表格（族名为卡片标题，因子列表纵向排列）。

```tsx
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

function heatColor(value: number): string {
  const abs = Math.min(Math.abs(value), 1);
  if (value >= 0) return `rgba(77, 240, 160, ${abs * 0.6 + 0.05})`;
  return `rgba(255, 107, 107, ${abs * 0.6 + 0.05})`;
}

const CLUSTER_COLORS: Record<string, string> = {
  'Cluster 1': '#4df0a0',
  'Cluster 2': '#62d8ff',
  'Cluster 3': '#e9c46a',
  'Cluster 4': '#a78bfa',
  'Cluster 5': '#ff6b6b',
  'Cluster 6': '#60a5fa',
};

function getClusterColor(cluster: string): string {
  return CLUSTER_COLORS[cluster] ?? '#8fa29b';
}

export function FactorCorrelation({ report, ui }: Props) {
  const corr = report.correlation;
  const u = ui.correlation;

  const factors = [...new Set(corr.correlationMatrix.map((r) => r.factorA))];
  const matrixMap = new Map<string, number>();
  corr.correlationMatrix.forEach((r) => {
    matrixMap.set(`${r.factorA}-${r.factorB}`, r.corr);
    matrixMap.set(`${r.factorB}-${r.factorA}`, r.corr);
  });

  return (
    <>
      <FactorReportSection title={u.correlationMatrix} defaultOpen={true}>
        <div className={s.heatmapGrid} style={{ gridTemplateColumns: `100px repeat(${factors.length}, 1fr)` }}>
          <div className={s.heatmapCell} style={{ background: 'transparent' }} />
          {factors.map((f) => (
            <div key={f} className={s.heatmapCell} style={{ background: 'transparent', color: 'var(--muted)', fontSize: '10px' }}>
              {f}
            </div>
          ))}
          {factors.map((rowFactor) => (
            <>
              <div key={`label-${rowFactor}`} className={s.heatmapCell} style={{ background: 'transparent', color: 'var(--muted)', fontSize: '10px' }}>
                {rowFactor}
              </div>
              {factors.map((colFactor) => {
                const v = matrixMap.get(`${rowFactor}-${colFactor}`) ?? (rowFactor === colFactor ? 1 : 0);
                return (
                  <div
                    key={`${rowFactor}-${colFactor}`}
                    className={s.heatmapCell}
                    style={{ background: heatColor(v), color: 'var(--text)' }}
                  >
                    {v.toFixed(2)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.returnCorrelation} defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {corr.returnCorrelation.map((r, i) => {
            const maxCorr = Math.max(...corr.returnCorrelation.map((x) => Math.abs(x.corr)), 0.001);
            return (
              <div key={i} className={s.barRow}>
                <span className={s.barLabel}>{r.factorA} ↔ {r.factorB}</span>
                <div className={s.barTrack}>
                  <div
                    className={`${s.barFill} ${r.corr < 0 ? s.negative : ''}`}
                    style={{ width: `${(Math.abs(r.corr) / maxCorr) * 100}%` }}
                  />
                </div>
                <span className={s.barValue}>{r.corr.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.clustering} defaultOpen={true}>
        <div className={s.clusterGrid}>
          {corr.clusters.map((cluster) => (
            <div key={cluster.cluster} className={s.clusterCard}>
              <div className={s.clusterCardTitle}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: getClusterColor(cluster.cluster), marginRight: 8, verticalAlign: 'middle' }} />
                {cluster.cluster}
              </div>
              <div className={s.clusterFactorList}>
                {cluster.factors.map((f) => (
                  <div key={f} className={s.clusterFactorItem}>
                    <span className={s.clusterFactorDot} style={{ background: getClusterColor(cluster.cluster) }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.pca} defaultOpen={true}>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Component</span>
            <span className={s.colValue}>Variance Explained</span>
            <span className={s.colValue}>Cumulative</span>
          </div>
          {corr.pcaVariance.map((p, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{p.component}</span>
              <span className={s.colValue}>{(p.variance * 100).toFixed(1)}%</span>
              <span className={s.colValue}>{(p.cumulative * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}
```

---

### Task 3: FactorNeutralization — 改为卡片网格布局

**Files:**
- Modify: `apps/web/src/components/factor-report/FactorNeutralization.tsx`

- [ ] **Step 1: 重写 FactorNeutralization.tsx**

4 个 section 合并为卡片网格，每个卡片内含一张 Grid 表格，与分域表现视觉一致。

```tsx
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorNeutralization({ report, ui }: Props) {
  const neut = report.neutralization;
  const u = ui.neutralization;

  return (
    <div className={s.neutGrid}>
      {/* Raw vs Neutralized */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.rawVsNeutralized}</div>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Metric</span>
            <span className={s.colValue}>Raw</span>
            <span className={s.colValue}>Neutralized</span>
          </div>
          {neut.rawVsNeutralized.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.metric}</span>
              <span className={s.colValue}>{row.raw.toFixed(3)}</span>
              <span className={`${s.colValue} ${row.neutralized >= row.raw ? s.alertNormal : s.alertCritical}`}>
                {row.neutralized.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pure Alpha IC */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.pureAlphaIc}</div>
        <div className={s.gridTable2}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Orthogonal To</span>
            <span className={s.colValue}>IC</span>
          </div>
          {neut.pureAlphaIc.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.orthogonalTo}</span>
              <span className={`${s.colValue} ${row.ic > 0 ? s.alertNormal : s.alertCritical}`}>
                {row.ic.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redundancy Matrix */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.redundancyMatrix}</div>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Factor A</span>
            <span className={s.colLabel}>Factor B</span>
            <span className={s.colValue}>Correlation</span>
          </div>
          {neut.redundancyMatrix.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.factorA}</span>
              <span className={s.colLabel}>{row.factorB}</span>
              <span className={`${s.colValue} ${Math.abs(row.correlation) > 0.5 ? s.alertWarning : s.alertNormal}`}>
                {row.correlation.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VIF */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.vif}</div>
        <div className={s.gridTable2}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Factor</span>
            <span className={s.colValue}>VIF</span>
          </div>
          {neut.vif.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.factor}</span>
              <span className={`${s.colValue} ${row.vif > 5 ? s.negative : s.positive}`}>
                {row.vif.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

### Task 4: 清理 — 删除 FactorGraph + 更新导出 + 构建验证

**Files:**
- Delete: `apps/web/src/components/factor-report/FactorGraph.tsx`
- Modify: `apps/web/src/components/factor-report/index.ts`

- [ ] **Step 1: 删除 FactorGraph.tsx**

删除文件 `apps/web/src/components/factor-report/FactorGraph.tsx`

- [ ] **Step 2: 更新 index.ts 移除 FactorGraph 导出**

```ts
export { FactorReport } from './FactorReport';
export { FactorReportHeader } from './FactorReportHeader';
export { FactorReportSection } from './FactorReportSection';
```

- [ ] **Step 3: 运行构建 + 测试**

Run: `cd d:\quant-web\apps\web; pnpm build && pnpm test`
Expected: 构建成功，81 个测试通过

- [ ] **Step 4: 浏览器验证**

访问 `http://127.0.0.1:4173/`，验证：
1. "中性化与剥离" — 4 个卡片网格布局，列宽对齐
2. "相关性分析" — 族群为横向卡片表格，族名为卡片标题，因子纵向排列

---

## Self-Review

### 1. Spec Coverage
- ✅ 族群退回表格设计，族名横向排列 — Task 2
- ✅ 中性化仿照分域表现卡片网格 — Task 3
- ✅ 清理 FactorGraph — Task 4

### 2. Placeholder Scan
- 无 TBD/TODO，所有代码完整

### 3. Type Consistency
- `FactorCorrelation` 使用 `corr.clusters` 和 `corr.correlationMatrix`，与 `FactorReportCorrelation` 类型一致
- `FactorNeutralization` 使用 `neut.rawVsNeutralized` / `pureAlphaIc` / `redundancyMatrix` / `vif`，与 `FactorReportNeutralization` 类型一致
- CSS class 名与新增样式一致
