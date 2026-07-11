import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  createResearchReport,
  createResearchJob,
  createInitialState,
  getJobs,
  getNavItems,
  getPage,
  getStrategies,
  getUiCopy,
  localizeResearchJob,
  resolveLanguageCode,
  setActivePage,
} from '../src/appData';

describe('appData', () => {
  it('language defaults to English and rejects invalid values', () => {
    assert.equal(DEFAULT_LANGUAGE, 'en');
    assert.equal(LANGUAGE_STORAGE_KEY, 'quantforge.language');
    assert.equal(resolveLanguageCode('zh'), 'zh');
    assert.equal(resolveLanguageCode('en'), 'en');
    assert.equal(resolveLanguageCode('fr'), 'en');
    assert.equal(resolveLanguageCode(null), 'en');
  });

  it('navigation is centered on the main research workflow', () => {
    const navIds = getNavItems('en').map((item) => item.id);

    assert.deepEqual(navIds, [
      'dashboard',
      'strategy',
      'factor-lab',
      'workspace',
      'backtest',
      'experiments',
      'data',
      'jobs',
      'research',
      'settings',
    ]);

    assert.ok(!getNavItems('en').some((item) => item.label.includes('HFT Lab')));
    assert.ok(!getNavItems('en').some((item) => item.label.includes('AI Lab')));
  });

  it('page names support English default and readable Chinese switching', () => {
    assert.deepEqual(
      getNavItems('en').map((item) => item.label),
      [
        'Dashboard',
        'Strategy Center',
        'Factor Lab',
        'Research Workspace',
        'Backtest Report',
        'Experiments',
        'Data Center',
        'Jobs',
        'Research Distillation',
        'Settings',
      ]
    );

    assert.deepEqual(
      getNavItems('zh').map((item) => item.label),
      [
        '研究总览',
        '策略中心',
        '因子工坊',
        '策略研究台',
        '回测报告',
        '实验对比',
        '数据中心',
        '任务中心',
        '研究沉淀',
        '系统设置',
      ]
    );

    assert.deepEqual(
      [
        'dashboard',
        'strategy',
        'workspace',
        'backtest',
        'experiments',
        'data',
        'jobs',
        'settings',
      ].map((id) => getPage(id, 'en').title),
      [
        'Research Command Center',
        'Strategy Center',
        'Research Workspace',
        'Backtest Report',
        'Experiments',
        'Data Center',
        'Jobs',
        'Settings',
      ]
    );

    assert.deepEqual(
      [
        'dashboard',
        'strategy',
        'workspace',
        'backtest',
        'experiments',
        'data',
        'jobs',
        'settings',
      ].map((id) => getPage(id, 'zh').title),
      [
        '研究指挥台',
        '策略中心',
        '策略研究台',
        '回测报告',
        '实验对比',
        '数据中心',
        '任务中心',
        '系统设置',
      ]
    );
  });

  it('Chinese copy is readable and does not contain mojibake markers', () => {
    const chineseContent = JSON.stringify({
      nav: getNavItems('zh'),
      pages: ['dashboard', 'strategy', 'workspace', 'jobs', 'settings'].map((id) =>
        getPage(id, 'zh')
      ),
      strategies: getStrategies('zh'),
      jobs: getJobs('zh'),
      ui: getUiCopy('zh'),
    });

    assert.ok(chineseContent.includes('量化'));
    assert.ok(chineseContent.includes('策略研究台'));
    assert.ok(chineseContent.includes('运行研究'));
    assert.ok(!/[鐮綛栫暐昏�]/u.test(chineseContent));
  });

  it('strategies carry stable ids and localized labels', () => {
    const englishStrategies = getStrategies('en');
    const chineseStrategies = getStrategies('zh');

    assert.deepEqual(
      englishStrategies.map((strategy) => strategy.mode),
      [
        'traditional',
        'traditional',
        'traditional',
        'traditional',
        'traditional',
        'hft',
        'ai',
        'traditional',
        'traditional',
        'traditional',
        'hft',
        'hft',
        'hft',
        'ai',
        'ai',
        'ai',
      ]
    );

    assert.ok(englishStrategies.every((strategy) => strategy.id.length > 0));
    assert.equal(englishStrategies[0].name, 'Dual MA');
    assert.equal(chineseStrategies[0].name, '双均线策略');
    assert.equal(englishStrategies[0].type, 'Trend Following Strategy');
    assert.equal(chineseStrategies[0].type, '趋势跟踪策略');
    assert.equal(englishStrategies[5].type, 'Order Flow Momentum Strategy');
    assert.equal(chineseStrategies[5].type, '订单流动量策略');
    assert.equal(englishStrategies[6].type, 'AI Alpha Mining Strategy');
    assert.equal(chineseStrategies[6].type, 'AI Alpha 挖掘策略');
  });

  it('state changes valid pages and ignores removed pages', () => {
    const state = createInitialState();

    setActivePage(state, 'workspace');
    assert.equal(state.activePage, 'workspace');

    setActivePage(state, 'hft');
    assert.equal(state.activePage, 'workspace');
  });

  it('research jobs are localized from selected strategy or active mode', () => {
    const selectedJob = createResearchJob(
      {
        id: 'job-custom',
        sequence: 7,
        strategy: getStrategies('en').find((s) => s.id === 'strategy-hft-l2'),
      },
      'en'
    );
    const defaultJob = createResearchJob(
      {
        id: 'job-default',
        mode: 'ai',
        sequence: 8,
      },
      'zh'
    );

    assert.deepEqual(
      {
        id: selectedJob.id,
        kind: selectedJob.kind,
        progress: selectedJob.progress,
        state: selectedJob.state,
        strategyName: selectedJob.strategyName,
        name: selectedJob.name,
      },
      {
        id: 'job-custom',
        kind: 'hft',
        progress: 0,
        state: 'Running',
        strategyName: 'Order Flow Momentum',
        name: 'Run Research: Order Flow Momentum',
      }
    );
    assert.equal(defaultJob.kind, 'ai');
    assert.equal(defaultJob.strategyName, 'ai草稿 #8');
    assert.equal(defaultJob.name, '运行研究：ai草稿 #8');
    assert.equal(defaultJob.progress, 0);
    assert.equal(defaultJob.state, 'Running');
    assert.equal(localizeResearchJob(selectedJob, 'zh').state, '运行中');
  });

  it('research jobs keep the selected run configuration summary', () => {
    const configSummary = ['Factors: quality + momentum', 'Universe: CSI 500'];
    const job = createResearchJob(
      {
        id: 'job-configured',
        sequence: 9,
        strategy: getStrategies('en')[0],
        configSummary,
      },
      'en'
    );

    assert.deepEqual(job.configSummary, configSummary);
    assert.deepEqual(localizeResearchJob(job, 'zh').configSummary, configSummary);
  });

  it('research reports inherit selected strategy and mode metrics', () => {
    const strategy = getStrategies('en').find((s) => s.id === 'strategy-hft-l2');
    const report = createResearchReport(
      {
        id: 'report-custom',
        jobId: 'job-custom',
        sequence: 7,
        strategy,
        generatedAt: '15:30:00',
      },
      'en'
    );

    assert.equal(report.id, 'report-custom');
    assert.equal(report.jobId, 'job-custom');
    assert.equal(report.mode, 'hft');
    assert.equal(report.modeName, 'hft');
    assert.equal(report.strategyName, 'Order Flow Momentum');
    assert.equal(report.title, 'Report: Order Flow Momentum');
    assert.equal(report.status, 'Completed · 15:30:00');
    assert.deepEqual(
      report.metrics.map((metric) => metric.value),
      ['+34.6%', '-9.2%', '2.18', 'hft']
    );
  });

  it('research reports include run configuration diagnostics', () => {
    const configSummary = ['Model: XGBoost', 'Training Window: 2020-2024'];
    const report = createResearchReport(
      {
        id: 'report-configured',
        jobId: 'job-configured',
        mode: 'ai',
        sequence: 9,
        generatedAt: '15:32:00',
        configSummary,
      },
      'en'
    );
    const runConfigSection = report.diagnostics.find(
      (section) => section.title === 'Run Configuration'
    );

    assert.deepEqual(runConfigSection?.items, configSummary);
  });

  it('research reports create localized draft names without selected strategy', () => {
    const report = createResearchReport(
      {
        id: 'report-draft',
        jobId: 'job-draft',
        mode: 'ai',
        sequence: 8,
        generatedAt: '15:31:00',
      },
      'zh'
    );

    assert.equal(report.mode, 'ai');
    assert.equal(report.modeName, 'ai');
    assert.equal(report.strategyName, 'ai草稿 #8');
    assert.equal(report.title, '报告：ai草稿 #8');
    assert.equal(report.status, '已完成 · 15:31:00');
  });

  it('mock jobs are localized', () => {
    assert.equal(getJobs('en')[0].name, 'Backtest: Dual MA');
    assert.equal(getJobs('en')[0].state, 'Running');
    assert.equal(getJobs('zh')[0].name, '回测：双均线策略');
    assert.equal(getJobs('zh')[0].state, '运行中');
  });

  it('settings language copy is available in both languages', () => {
    assert.equal(getUiCopy('en').languageTitle, 'Interface Language / 界面语言');
    assert.equal(getUiCopy('zh').languageTitle, '界面语言');
    assert.equal(getUiCopy('en').runResearch, 'Run Research');
    assert.equal(getUiCopy('zh').runResearch, '运行研究');
    assert.equal(getUiCopy('en').viewReport, 'View Report');
    assert.equal(getUiCopy('zh').viewReport, '查看报告');
    assert.equal(getUiCopy('en').brandTagline, 'Factor · Strategy · AI Research Terminal');
    assert.equal(getUiCopy('zh').brandTagline, '因子 · 策略 · AI 量化研究终端');
  });
});
