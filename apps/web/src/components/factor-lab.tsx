import { useState } from 'react';
import { FactorEvalTab, FactorStatus } from '@quant/common';
import type { FactorDisplayRow, FactorEvalDisplayResult, UiCopy } from '../appData';
import s from '../styles/factor-lab.module.css';

function FactorDefinitionTable({
  factors,
  ui,
  selectedId,
  onSelect,
}: {
  factors: FactorDisplayRow[];
  ui: UiCopy;
  selectedId?: string;
  onSelect?: (factor: FactorDisplayRow) => void;
}) {
  return (
    <section className={s.factorTablePanel}>
      <h3>{ui.factorDefinitionTitle}</h3>
      <table className={s.factorTable}>
        <thead>
          <tr>
            <th>{ui.factorTableHeaders.name}</th>
            <th>{ui.factorTableHeaders.category}</th>
            <th>{ui.factorTableHeaders.ic}</th>
            <th>{ui.factorTableHeaders.rankIc}</th>
            <th>{ui.factorTableHeaders.groupReturn}</th>
            <th>{ui.factorTableHeaders.layerReturn}</th>
            <th>{ui.factorTableHeaders.referencedBy}</th>
            <th>{ui.factorTableHeaders.status}</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr
              key={f.id}
              className={`${s.factorRow} ${f.id === selectedId ? s.selected : ''}`}
              onClick={onSelect ? () => onSelect(f) : undefined}
              style={onSelect ? { cursor: 'pointer' } : undefined}
            >
              <td>
                <strong>{f.name}</strong>
                <span style={{ display: 'block', marginTop: 2, color: 'var(--muted)', fontSize: 12 }}>{f.description}</span>
              </td>
              <td>{f.category}</td>
              <td>{f.ic}</td>
              <td>{f.rankIc}</td>
              <td>{f.groupReturn}</td>
              <td>{f.layerReturn}</td>
              <td>
                {f.referencedBy.length > 0
                  ? f.referencedBy.map((r) => (
                      <span key={r} className={s.refTag}>{r}</span>
                    ))
                  : '—'}
              </td>
              <td>
                <span className={f.status === FactorStatus.Active ? s.statusActive : s.statusDraft}>
                  {f.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function IcCurveChart({ icSeries }: { icSeries: string[] }) {
  const values = icSeries.map(Number);
  const maxAbs = Math.max(...values.map(Math.abs), 0.001);

  return (
    <div className={s.icSeries}>
      {values.map((v, i) => {
        const height = Math.abs(v) / maxAbs * 100;
        return (
          <div
            key={i}
            className={`${s.icBar} ${v < 0 ? s.negative : ''}`}
            style={{ height: `${height}%` }}
            title={`${v}`}
          />
        );
      })}
    </div>
  );
}

function GroupReturnGrid({ groupReturns }: { groupReturns: FactorEvalDisplayResult['groupReturns'] }) {
  return (
    <div className={s.groupGrid}>
      {groupReturns.map((g) => (
        <div key={g.group} className={s.groupCard}>
          <div className={s.groupLabel}>{g.group}</div>
          <div className={s.groupValue}>{g.return}</div>
        </div>
      ))}
    </div>
  );
}

function LayerTable({ layerSummary }: { layerSummary: FactorEvalDisplayResult['layerSummary'] }) {
  return (
    <table className={s.layerTable}>
      <thead>
        <tr>
          <th>Layer</th>
          <th>Return</th>
          <th>Sharpe</th>
        </tr>
      </thead>
      <tbody>
        {layerSummary.map((l) => (
          <tr key={l.layer}>
            <td>{l.layer}</td>
            <td>{l.return}</td>
            <td>{l.sharpe}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const EVAL_TABS: { id: FactorEvalTab; label: string }[] = [
  { id: FactorEvalTab.Sorting, label: 'Sorting' },
  { id: FactorEvalTab.ICAnalysis, label: 'IC Analysis' },
  { id: FactorEvalTab.Regression, label: 'Regression' },
];

function FactorEvalPanel({
  evalResults,
  ui,
}: {
  evalResults: FactorEvalDisplayResult[];
  ui: UiCopy;
}) {
  const [activeTab, setActiveTab] = useState<FactorEvalTab>(FactorEvalTab.ICAnalysis);
  const result = evalResults[0];

  if (!result) return null;

  return (
    <section className={s.evalPanel}>
      <h3>{ui.factorEvalTitle} — {result.factorName}</h3>
      <div className={s.evalTabs}>
        {EVAL_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${s.evalTab} ${activeTab === tab.id ? s.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === FactorEvalTab.ICAnalysis && <IcCurveChart icSeries={result.icSeries} />}
      {activeTab === FactorEvalTab.Sorting && <GroupReturnGrid groupReturns={result.groupReturns} />}
      {activeTab === FactorEvalTab.Regression && <LayerTable layerSummary={result.layerSummary} />}
    </section>
  );
}

function FactorReferencePanel({
  factors,
  ui,
}: {
  factors: FactorDisplayRow[];
  ui: UiCopy;
}) {
  const referenced = factors.filter((f) => f.referencedBy.length > 0);

  return (
    <section className={s.refPanel}>
      <h3>{ui.factorReferenceTitle}</h3>
      {referenced.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>—</p>
      ) : (
        <div className={s.refList}>
          {referenced.map((f) => (
            <div key={f.id} className={s.refItem}>
              <span className={s.refFactorName}>{f.name}</span>
              <div className={s.refStrategyList}>
                {f.referencedBy.map((r) => (
                  <span key={r} className={s.refTag}>{r}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function FactorLabContent({
  factors,
  factorEvalResults,
  ui,
}: {
  factors: FactorDisplayRow[];
  factorEvalResults: FactorEvalDisplayResult[];
  ui: UiCopy;
}) {
  const [selectedFactorId, setSelectedFactorId] = useState<string | undefined>();

  const selectedEval = selectedFactorId
    ? factorEvalResults.filter((r) => r.factorId === selectedFactorId)
    : factorEvalResults;

  return (
    <div className={s.factorLabGrid}>
      <FactorDefinitionTable
        factors={factors}
        ui={ui}
        selectedId={selectedFactorId}
        onSelect={(f) => setSelectedFactorId(f.id === selectedFactorId ? undefined : f.id)}
      />
      <FactorEvalPanel evalResults={selectedEval} ui={ui} />
      <FactorReferencePanel factors={factors} ui={ui} />
    </div>
  );
}
