# 因子报告视觉优化：中性化/分域表格对齐 + 相关性知识图谱

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复因子报告中"中性化与剥离"和"分域表现"表格列不对齐问题，并将"相关性分析"中的族群展示从空洞的 chip 列表升级为 SVG 力导向知识图谱。

**Architecture:** 三个独立模块改造：(1) 表格列宽固定对齐 — 用 CSS Grid 替代原生 table 的 auto 列宽，确保数值列右对齐、标签列等宽；(2) 分域表现统一为紧凑卡片网格 — 6 个子域共用同一组件，消除重复代码；(3) 相关性族群用纯 SVG 力导向图渲染 — 节点=因子、边=相关性、颜色=族群，hover 显示详情，无需引入额外库。

**Tech Stack:** React 19, CSS Modules, SVG (力导向图), ECharts (已有依赖，热力图可选), TypeScript

---

## 问题分析

### 1. 中性化表格列不对齐
- **根因**：使用原生 `<table>` + `width: 100%`，列宽由内容撑开，不同 section 的表格列宽不一致
- **表现**：`rawVsNeutralized` 的 Metric/Raw/Neutralized 三列和 `redundancyMatrix` 的 Factor A/Factor B/Correlation 三列宽度不统一
- **方案**：用 CSS Grid 固定列宽比例，数值列右对齐

### 2. 分域表现表格列不对齐
- **根因**：6 个子域各自独立渲染 `<table>`，首列内容长度差异大（"大盘" vs "能源/材料/工业"），导致 IC/Group Return 列位置漂移
- **方案**：统一为 `DomainTable` 复用组件，首列固定宽度，数值列右对齐 + 条件着色内联条

### 3. 相关性族群展示空洞
- **根因**：`clusters` 只用 chip 列表展示，缺乏空间感和关联性表达
- **方案**：SVG 力导向知识图谱 — 节点按族群着色，边按相关性粗细/颜色编码，hover 交互

---

## 文件结构

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `apps/web/src/styles/factor-report.module.css` | 新增 Grid 表格、域卡片、知识图谱样式 |
| 修改 | `apps/web/src/components/factor-report/FactorNeutralization.tsx` | Grid 表格替换原生 table |
| 修改 | `apps/web/src/components/factor-report/FactorDomainAnalysis.tsx` | 提取 DomainTable + 卡片网格布局 |
| 修改 | `apps/web/src/components/factor-report/FactorCorrelation.tsx` | 新增 SVG 力导向图谱组件 |
| 新增 | `apps/web/src/components/factor-report/FactorGraph.tsx` | 力导向知识图谱独立组件 |

---

### Task 1: CSS — 新增 Grid 表格、域卡片、知识图谱样式

**Files:**
- Modify: `apps/web/src/styles/factor-report.module.css`

- [ ] **Step 1: 在 factor-report.module.css 末尾添加 Grid 表格样式**

```css
/* ── Grid-Aligned Table (replaces native <table>) ────────── */

.gridTable {
  display: grid;
  gap: 0;
  width: 100%;
}

.gridTableHeader {
  display: contents;
}

.gridTableHeader > span {
  padding: 10px 12px;
  color: var(--muted);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  border-bottom: 1px solid var(--line);
  font-weight: 600;
}

.gridTableRow {
  display: contents;
}

.gridTableRow:hover > span {
  background: var(--gradient-row-hover);
}

.gridTableRow > span {
  padding: 10px 12px;
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  border-bottom: 1px solid var(--line);
  transition: background 0.15s;
}

/* 3-column layout: label 2fr, value 1fr, value 1fr */
.gridTable3 {
  composes: gridTable;
  grid-template-columns: 2fr 1fr 1fr;
}

.gridTable3 .colLabel {
  text-align: left;
  color: var(--text);
}

.gridTable3 .colValue {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 2-column layout: label 2fr, value 1fr */
.gridTable2 {
  composes: gridTable;
  grid-template-columns: 2fr 1fr;
}

.gridTable2 .colLabel {
  text-align: left;
  color: var(--text);
}

.gridTable2 .colValue {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* ── Domain Analysis Card Grid ───────────────────────────── */

.domainGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-lg);
}

.domainCard {
  border: 1px solid var(--line);
  background: var(--gradient-panel);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.domainCardTitle {
  padding: var(--space-md) var(--space-lg);
  color: var(--green);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: var(--tracking-wider);
  border-bottom: 1px solid var(--line);
  background: rgba(77, 240, 160, 0.04);
}

/* Domain inline value bar */
.domainValueCell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
}

.domainInlineBar {
  height: 4px;
  border-radius: 2px;
  min-width: 4px;
  max-width: 60px;
  transition: width 0.3s ease;
}

/* ── Factor Knowledge Graph ──────────────────────────────── */

.graphContainer {
  position: relative;
  width: 100%;
  border: 1px solid var(--line);
  background: rgba(8, 16, 15, 0.45);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.graphSvg {
  width: 100%;
  display: block;
}

.graphTooltip {
  position: absolute;
  padding: 6px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
  color: var(--text);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
  white-space: nowrap;
}

.graphTooltip.visible {
  opacity: 1;
}

.graphLegend {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--line);
  background: rgba(17, 25, 23, 0.64);
}

.graphLegendItem {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  color: var(--muted);
}

.graphLegendDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

- [ ] **Step 2: 验证 CSS 无语法错误**

Run: `cd d:\quant-web\apps\web; npx postcss --check src/styles/factor-report.module.css` 或直接启动 dev 确认无报错

---

### Task 2: FactorNeutralization — Grid 表格替换原生 table

**Files:**
- Modify: `apps/web/src/components/factor-report/FactorNeutralization.tsx`

- [ ] **Step 1: 重写 FactorNeutralization.tsx**

将 4 个原生 `<table>` 替换为 CSS Grid 表格，统一列宽比例和右对齐。

```tsx
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorNeutralization({ report, ui }: Props) {
  const neut = report.neutralization;
  const u = ui.neutralization;

  return (
    <>
      <FactorReportSection title={u.rawVsNeutralized} defaultOpen={true}>
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
      </FactorReportSection>

      <FactorReportSection title={u.pureAlphaIc} defaultOpen={true}>
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
      </FactorReportSection>

      <FactorReportSection title={u.redundancyMatrix} defaultOpen={true}>
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
      </FactorReportSection>

      <FactorReportSection title={u.vif} defaultOpen={true}>
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
      </FactorReportSection>
    </>
  );
}
```

- [ ] **Step 2: 验证页面渲染正常**

Run: `cd d:\quant-web\apps\web; pnpm build`
Expected: 构建成功，无 TypeScript 错误

---

### Task 3: FactorDomainAnalysis — 提取 DomainTable + 卡片网格

**Files:**
- Modify: `apps/web/src/components/factor-report/FactorDomainAnalysis.tsx`

- [ ] **Step 1: 重写 FactorDomainAnalysis.tsx**

提取通用 `DomainTable` 组件，6 个子域共用，首列固定宽度，数值列右对齐 + 内联条。外层用卡片网格布局。

```tsx
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

interface DomainRow {
  label: string;
  ic: number;
  groupReturn: number;
}

function DomainTable({ rows }: { rows: DomainRow[] }) {
  const maxAbsIc = Math.max(...rows.map((r) => Math.abs(r.ic)), 0.001);
  const maxAbsReturn = Math.max(...rows.map((r) => Math.abs(r.groupReturn)), 0.001);

  return (
    <div className={s.gridTable3}>
      <div className={s.gridTableHeader}>
        <span className={s.colLabel}>Domain</span>
        <span className={s.colValue}>IC</span>
        <span className={s.colValue}>Group Return</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={s.gridTableRow}>
          <span className={s.colLabel}>{row.label}</span>
          <span className={s.domainValueCell}>
            <span
              className={s.domainInlineBar}
              style={{
                width: `${(Math.abs(row.ic) / maxAbsIc) * 60}px`,
                background: row.ic >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            />
            <span className={`${s.colValue} ${row.ic > 0 ? s.alertNormal : s.alertCritical}`}>
              {row.ic.toFixed(3)}
            </span>
          </span>
          <span className={s.domainValueCell}>
            <span
              className={s.domainInlineBar}
              style={{
                width: `${(Math.abs(row.groupReturn) / maxAbsReturn) * 60}px`,
                background: row.groupReturn >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            />
            <span className={`${s.colValue} ${row.groupReturn >= 0 ? s.alertNormal : s.alertCritical}`}>
              {(row.groupReturn * 100).toFixed(1)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function FactorDomainAnalysis({ report, ui }: Props) {
  const domain = report.domain;
  const u = ui.domainAnalysis;

  const sections: { title: string; rows: DomainRow[] }[] = [
    { title: u.byCap, rows: domain.byCap.map((d) => ({ label: d.cap, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byIndustry, rows: domain.byIndustry.map((d) => ({ label: d.industry, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byRegime, rows: domain.byRegime.map((d) => ({ label: d.regime, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byValuation, rows: domain.byValuation.map((d) => ({ label: d.level, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byLiquidity, rows: domain.byLiquidity.map((d) => ({ label: d.level, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byBoard, rows: domain.byBoard.map((d) => ({ label: d.board, ic: d.ic, groupReturn: d.groupReturn })) },
  ];

  return (
    <div className={s.domainGrid}>
      {sections.map((sec) => (
        <div key={sec.title} className={s.domainCard}>
          <div className={s.domainCardTitle}>{sec.title}</div>
          <DomainTable rows={sec.rows} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

Run: `cd d:\quant-web\apps\web; pnpm build`
Expected: 构建成功

---

### Task 4: FactorGraph — SVG 力导向知识图谱组件

**Files:**
- Create: `apps/web/src/components/factor-report/FactorGraph.tsx`

这是核心新增组件，用纯 SVG + 简单力导向模拟实现因子关系知识图谱。

- [ ] **Step 1: 创建 FactorGraph.tsx**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import s from '../../styles/factor-report.module.css';

interface GraphNode {
  id: string;
  cluster: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

interface FactorGraphProps {
  clusters: { cluster: string; factors: string[] }[];
  correlationMatrix: { factorA: string; factorB: string; corr: number }[];
  width?: number;
  height?: number;
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

export function FactorGraph({ clusters, correlationMatrix, width = 600, height = 400 }: FactorGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; visible: boolean }>({
    text: '',
    x: 0,
    y: 0,
    visible: false,
  });

  // Build nodes and edges
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const frameRef = useRef<number>(0);

  // Initialize nodes
  useEffect(() => {
    const nodes: GraphNode[] = [];
    const clusterMap = new Map<string, string>();

    clusters.forEach((c) => {
      c.factors.forEach((f) => clusterMap.set(f, c.cluster));
    });

    let idx = 0;
    clusterMap.forEach((cluster, id) => {
      const angle = (idx / clusterMap.size) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.3;
      nodes.push({
        id,
        cluster,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      });
      idx++;
    });

    // Build edges from correlation matrix (only |corr| > 0.3)
    const edges: GraphEdge[] = correlationMatrix
      .filter((r) => r.factorA !== r.factorB && Math.abs(r.corr) > 0.3)
      .map((r) => ({ source: r.factorA, target: r.factorB, weight: r.corr }));

    nodesRef.current = nodes;
    edgesRef.current = edges;

    // Force simulation
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const alpha = 0.3;
    const repulsion = 2000;
    const attraction = 0.005;
    const centerForce = 0.01;
    const damping = 0.85;

    function tick() {
      const ns = nodesRef.current;
      const es = edgesRef.current;

      // Repulsion between all pairs
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          ns[i].vx -= fx;
          ns[i].vy -= fy;
          ns[j].vx += fx;
          ns[j].vy += fy;
        }
      }

      // Attraction along edges
      for (const edge of es) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * attraction * Math.abs(edge.weight);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      }

      // Center gravity
      for (const n of ns) {
        n.vx += (width / 2 - n.x) * centerForce;
        n.vy += (height / 2 - n.y) * centerForce;
      }

      // Apply velocity
      for (const n of ns) {
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx * alpha;
        n.y += n.vy * alpha;
        // Bounds
        n.x = Math.max(30, Math.min(width - 30, n.x));
        n.y = Math.max(30, Math.min(height - 30, n.y));
      }
    }

    // Run simulation for 120 frames
    let frame = 0;
    function animate() {
      if (frame >= 120) return;
      tick();
      frame++;
      frameRef.current = requestAnimationFrame(animate);
    }

    // Initial settling
    for (let i = 0; i < 80; i++) tick();
    animate();

    return () => cancelAnimationFrame(frameRef.current);
  }, [clusters, correlationMatrix, width, height]);

  const handleNodeHover = useCallback(
    (nodeId: string, event: React.MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relatedEdges = edgesRef.current.filter(
        (e) => e.source === nodeId || e.target === nodeId
      );
      const lines = relatedEdges.map(
        (e) =>
          `${e.source} ↔ ${e.target}: ${e.weight.toFixed(3)}`
      );
      setTooltip({
        text: [nodeId, ...lines].join('\n'),
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 10,
        visible: true,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

  return (
    <div className={s.graphContainer}>
      <svg
        ref={svgRef}
        className={s.graphSvg}
        viewBox={`0 0 ${width} ${height}`}
        onMouseLeave={handleMouseLeave}
      >
        {/* Edges */}
        {edgesRef.current.map((edge, i) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          const absWeight = Math.abs(edge.weight);
          return (
            <line
              key={`edge-${i}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={edge.weight >= 0 ? 'rgba(77, 240, 160, 0.25)' : 'rgba(255, 107, 107, 0.25)'}
              strokeWidth={absWeight * 3 + 0.5}
              strokeDasharray={edge.weight < 0 ? '4 2' : undefined}
            />
          );
        })}

        {/* Nodes */}
        {nodesRef.current.map((node) => (
          <g
            key={node.id}
            onMouseEnter={(e) => handleNodeHover(node.id, e)}
            style={{ cursor: 'pointer' }}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={8}
              fill={getClusterColor(node.cluster)}
              fillOpacity={0.2}
              stroke={getClusterColor(node.cluster)}
              strokeWidth={1.5}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={4}
              fill={getClusterColor(node.cluster)}
            />
            <text
              x={node.x}
              y={node.y - 14}
              textAnchor="middle"
              fill="var(--text)"
              fontSize={10}
              fontFamily="var(--font-mono)"
              fontWeight={600}
            >
              {node.id}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      <div
        className={`${s.graphTooltip} ${tooltip.visible ? s.visible : ''}`}
        style={{ left: tooltip.x, top: tooltip.y }}
      >
        {tooltip.text.split('\n').map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>

      {/* Legend */}
      <div className={s.graphLegend}>
        {clusters.map((c) => (
          <div key={c.cluster} className={s.graphLegendItem}>
            <span
              className={s.graphLegendDot}
              style={{ background: getClusterColor(c.cluster) }}
            />
            {c.cluster}
          </div>
        ))}
        <div className={s.graphLegendItem}>
          <span style={{ display: 'inline-block', width: 20, height: 2, background: 'rgba(77, 240, 160, 0.4)' }} />
          正相关
        </div>
        <div className={s.graphLegendItem}>
          <span style={{ display: 'inline-block', width: 20, height: 2, background: 'rgba(255, 107, 107, 0.4)', borderTop: '1px dashed rgba(255, 107, 107, 0.6)' }} />
          负相关
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

Run: `cd d:\quant-web\apps\web; npx tsc --noEmit --pretty 2>&1 | Select-String "FactorGraph"`
Expected: 无错误输出

---

### Task 5: FactorCorrelation — 集成知识图谱替换 chip 列表

**Files:**
- Modify: `apps/web/src/components/factor-report/FactorCorrelation.tsx`

- [ ] **Step 1: 重写 FactorCorrelation.tsx**

将 clustering section 中的 chip 列表替换为 `FactorGraph` 组件。

```tsx
import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import { FactorGraph } from './FactorGraph';
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

export function FactorCorrelation({ report, ui }: Props) {
  const corr = report.correlation;
  const u = ui.correlation;

  // Build matrix from flat correlationMatrix
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
        <FactorGraph
          clusters={corr.clusters}
          correlationMatrix={corr.correlationMatrix}
          width={600}
          height={400}
        />
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

- [ ] **Step 2: 验证构建**

Run: `cd d:\quant-web\apps\web; pnpm build`
Expected: 构建成功

---

### Task 6: 导出 FactorGraph 并验证完整页面

**Files:**
- Modify: `apps/web/src/components/factor-report/index.ts`

- [ ] **Step 1: 在 index.ts 中导出 FactorGraph**

在现有导出列表中添加 `FactorGraph`。

- [ ] **Step 2: 运行完整构建 + 测试**

Run: `cd d:\quant-web\apps\web; pnpm build && pnpm test`
Expected: 构建成功，所有测试通过

- [ ] **Step 3: 浏览器验证**

在浏览器中访问 `http://127.0.0.1:4173/`，导航到因子报告页面，验证：
1. "中性化与剥离" tab — 4 个表格列宽对齐，数值右对齐
2. "分域表现" tab — 6 个子域以卡片网格展示，IC/Group Return 列对齐且有内联条
3. "相关性分析" tab — 族群展示为力导向知识图谱，节点可 hover 查看关联详情

---

## Self-Review

### 1. Spec Coverage
- ✅ 中性化表格列对齐 — Task 2
- ✅ 分域表现表格列对齐 — Task 3
- ✅ 相关性族群知识图谱 — Task 4 + Task 5
- ✅ PCA 表格也对齐了 — Task 5

### 2. Placeholder Scan
- 无 TBD/TODO，所有代码完整

### 3. Type Consistency
- `DomainRow` 接口在 Task 3 中定义，与 `FactorReportDomain` 各子域字段映射一致
- `FactorGraph` props 与 `FactorReportCorrelation` 的 `clusters` 和 `correlationMatrix` 类型匹配
- CSS class 名与 `factor-report.module.css` 中新增的样式名一致
