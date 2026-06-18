import { useState } from 'react';
import type { BacktestReportFull, LanguageCode, ReportTabId, ReportUiCopy } from '../appData';
import {
  ReportOverview,
  ReportDataParams,
  ReportReturnMetrics,
  ReportRiskMetrics,
  ReportRiskAdjMetrics,
  ReportTradeStats,
  ReportEquityCharts,
  ReportRobustness,
  ReportAttribution,
  ReportIssues,
  ReportExecutiveSummary,
  ReportConclusion,
  ReportPositionAnalysis,
  ReportSubStrategyAttribution,
  ReportStressTest,
  ReportCostSensitivity,
  ReportBenchmarkComparison,
  ReportRiskWarnings,
} from './report/index';
import reportStyles from '../styles/report.module.css';

interface FullReportProps {
  report: BacktestReportFull;
  ui: ReportUiCopy;
  language?: LanguageCode;
  /** 所有历史回测报告（用于切换） */
  allReports?: BacktestReportFull[];
  /** 切换报告回调 */
  onSwitchReport?: (reportId: string) => void;
}

const TABS: { id: ReportTabId; label: string }[] = [
  { id: 'executiveSummary', label: 'executiveSummary' },
  { id: 'overview', label: 'overview' },
  { id: 'dataParams', label: 'dataParams' },
  { id: 'returnMetrics', label: 'returnMetrics' },
  { id: 'riskMetrics', label: 'riskMetrics' },
  { id: 'riskAdjMetrics', label: 'riskAdjMetrics' },
  { id: 'tradeStats', label: 'tradeStats' },
  { id: 'equity', label: 'equity' },
  { id: 'robustness', label: 'robustness' },
  { id: 'attribution', label: 'attribution' },
  { id: 'positionAnalysis', label: 'positionAnalysis' },
  { id: 'subStrategyAttribution', label: 'subStrategyAttribution' },
  { id: 'stressTest', label: 'stressTest' },
  { id: 'costSensitivity', label: 'costSensitivity' },
  { id: 'benchmarkComparison', label: 'benchmarkComparison' },
  { id: 'issues', label: 'issues' },
  { id: 'conclusion', label: 'conclusion' },
  { id: 'riskWarnings', label: 'riskWarnings' },
];

export function FullReport({ report, ui, allReports, onSwitchReport }: FullReportProps) {
  const [activeTab, setActiveTab] = useState<ReportTabId>('executiveSummary');

  function renderTabContent() {
    switch (activeTab) {
      case 'executiveSummary':
        return <ReportExecutiveSummary report={report} ui={ui} />;
      case 'overview':
        return <ReportOverview report={report} ui={ui} />;
      case 'dataParams':
        return <ReportDataParams report={report} ui={ui} />;
      case 'returnMetrics':
        return <ReportReturnMetrics report={report} ui={ui} />;
      case 'riskMetrics':
        return <ReportRiskMetrics report={report} ui={ui} />;
      case 'riskAdjMetrics':
        return <ReportRiskAdjMetrics report={report} ui={ui} />;
      case 'tradeStats':
        return <ReportTradeStats report={report} ui={ui} />;
      case 'equity':
        return <ReportEquityCharts report={report} ui={ui} />;
      case 'robustness':
        return <ReportRobustness report={report} ui={ui} />;
      case 'attribution':
        return <ReportAttribution report={report} ui={ui} />;
      case 'positionAnalysis':
        return <ReportPositionAnalysis report={report} ui={ui} />;
      case 'subStrategyAttribution':
        return <ReportSubStrategyAttribution report={report} ui={ui} />;
      case 'stressTest':
        return <ReportStressTest report={report} ui={ui} />;
      case 'costSensitivity':
        return <ReportCostSensitivity report={report} ui={ui} />;
      case 'benchmarkComparison':
        return <ReportBenchmarkComparison report={report} ui={ui} />;
      case 'issues':
        return <ReportIssues report={report} ui={ui} />;
      case 'conclusion':
        return <ReportConclusion report={report} ui={ui} />;
      case 'riskWarnings':
        return <ReportRiskWarnings report={report} ui={ui} />;
      default:
        return null;
    }
  }

  return (
    <section className={reportStyles.fullReport}>
      {/* Report header */}
      <header className={reportStyles.reportHeader}>
        <div className={reportStyles.reportHeaderLeft}>
          <p className={reportStyles.reportEyebrow}>回测报告</p>
          <h2 className={reportStyles.reportTitle}>{report.strategyName}</h2>
          <p className={reportStyles.reportDesc}>{report.strategyDescription}</p>
        </div>
        <div className={reportStyles.reportHeaderRight}>
          {allReports && allReports.length > 1 && onSwitchReport && (
            <select
              className={reportStyles.reportSelect}
              value={report.id}
              onChange={(e) => onSwitchReport(e.target.value)}
              aria-label="切换历史回测报告"
            >
              {allReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.strategyName} - {r.generatedAt}
                </option>
              ))}
            </select>
          )}
          <span className={`${reportStyles.reportStatus} ${reportStyles[report.status]}`}>
            {report.status}
          </span>
          <span className={reportStyles.reportTime}>{report.generatedAt}</span>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className={reportStyles.tabNav} aria-label="报告模块">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`${reportStyles.tabBtn} ${activeTab === tab.id ? reportStyles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {ui.tabs[tab.id]}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className={reportStyles.tabContent}>
        <div className={reportStyles.contentInner}>
          {renderTabContent()}
        </div>
      </div>
    </section>
  );
}

// Keep backward-compatible export for existing usage
import type { ResearchReport, UiCopy } from '../appData';
import { MetricCard } from './common';
import hero from '../styles/hero.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

export function ReportSummary({ report: reportData, ui }: { report: ResearchReport; ui: UiCopy }) {
  return (
    <section className={reportStyles.reportSummary}>
      <div className={reportStyles.reportHeader}>
        <div>
          <p className={reportStyles.reportEyebrow}>{ui.reportSummaryTitle}</p>
          <h3 className={reportStyles.reportTitle}>{reportData.title}</h3>
        </div>
        <mark className={reportStyles.reportStatus}>{reportData.status}</mark>
      </div>
      <dl className={reportStyles.reportMeta}>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportStrategy}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.strategyName}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportMode}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.modeName}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportJob}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.jobId}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportGeneratedAt}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.generatedAt}</dd>
        </div>
      </dl>
      <div className={`${hero.metricGrid} ${hero.metricGridCompact}`}>
        {reportData.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <div className={reportStyles.reportDiagnostics}>
        {reportData.diagnostics.map((section) => (
          <article className={reportStyles.diagnosticSection} key={section.title}>
            <h4>{section.title}</h4>
            <div className={infoPanelStyles.chipRow}>
              {section.items.map((item) => (
                <span className={infoPanelStyles.chip} key={item}>
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}