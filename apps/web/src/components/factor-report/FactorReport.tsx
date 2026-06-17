import { useState } from 'react';
import type { FactorReportFull, FactorReportTabId, FactorReportUiCopy } from '../../appData';
import { FactorReportHeader } from './FactorReportHeader';
import { FactorBasicInfo } from './FactorBasicInfo';
import { FactorDescriptiveStats } from './FactorDescriptiveStats';
import { FactorEffectiveness } from './FactorEffectiveness';
import { FactorRiskAnalysis } from './FactorRiskAnalysis';
import { FactorTurnoverCost } from './FactorTurnoverCost';
import { FactorNeutralization } from './FactorNeutralization';
import { FactorDomainAnalysis } from './FactorDomainAnalysis';
import { FactorCorrelation } from './FactorCorrelation';
import { FactorMultiFactor } from './FactorMultiFactor';
import { FactorEconomicLogic } from './FactorEconomicLogic';
import { FactorRobustness } from './FactorRobustness';
import { FactorMonitoring } from './FactorMonitoring';
import { FactorConclusion } from './FactorConclusion';
import s from '../../styles/factor-report.module.css';

const TABS: { id: FactorReportTabId }[] = [
  { id: 'basicInfo' },
  { id: 'descriptiveStats' },
  { id: 'effectiveness' },
  { id: 'riskAnalysis' },
  { id: 'turnoverCost' },
  { id: 'neutralization' },
  { id: 'domainAnalysis' },
  { id: 'correlation' },
  { id: 'multiFactor' },
  { id: 'economicLogic' },
  { id: 'robustness' },
  { id: 'monitoring' },
  { id: 'conclusion' },
];

interface FactorReportProps {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
  onBack?: () => void;
}

export function FactorReport({ report, ui, onBack }: FactorReportProps) {
  const [activeTab, setActiveTab] = useState<FactorReportTabId>('basicInfo');

  function renderTabContent() {
    switch (activeTab) {
      case 'basicInfo':
        return <FactorBasicInfo report={report} ui={ui} />;
      case 'descriptiveStats':
        return <FactorDescriptiveStats report={report} ui={ui} />;
      case 'effectiveness':
        return <FactorEffectiveness report={report} ui={ui} />;
      case 'riskAnalysis':
        return <FactorRiskAnalysis report={report} ui={ui} />;
      case 'turnoverCost':
        return <FactorTurnoverCost report={report} ui={ui} />;
      case 'neutralization':
        return <FactorNeutralization report={report} ui={ui} />;
      case 'domainAnalysis':
        return <FactorDomainAnalysis report={report} ui={ui} />;
      case 'correlation':
        return <FactorCorrelation report={report} ui={ui} />;
      case 'multiFactor':
        return <FactorMultiFactor report={report} ui={ui} />;
      case 'economicLogic':
        return <FactorEconomicLogic report={report} ui={ui} />;
      case 'robustness':
        return <FactorRobustness report={report} ui={ui} />;
      case 'monitoring':
        return <FactorMonitoring report={report} ui={ui} />;
      case 'conclusion':
        return <FactorConclusion report={report} ui={ui} />;
      default:
        return null;
    }
  }

  return (
    <section className={s.factorReport}>
      <FactorReportHeader report={report} ui={ui} onBack={onBack} />
      <nav className={s.tabNav} aria-label="因子报告导航">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${s.tabButton} ${activeTab === tab.id ? s.active : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {ui.tabs[tab.id]}
          </button>
        ))}
      </nav>
      {renderTabContent()}
    </section>
  );
}
