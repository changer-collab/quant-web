import assert from 'node:assert/strict';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  createResearchJob,
  createInitialState,
  getJobs,
  getNavItems,
  getPage,
  getResearchMode,
  getResearchModes,
  getStrategies,
  getUiCopy,
  resolveLanguageCode,
  setActivePage,
} from '../src/appData';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('language defaults to English and rejects invalid values', () => {
  assert.equal(DEFAULT_LANGUAGE, 'en');
  assert.equal(LANGUAGE_STORAGE_KEY, 'quantforge.language');
  assert.equal(resolveLanguageCode('zh'), 'zh');
  assert.equal(resolveLanguageCode('en'), 'en');
  assert.equal(resolveLanguageCode('fr'), 'en');
  assert.equal(resolveLanguageCode(null), 'en');
});

runTest('navigation is centered on the main research workflow', () => {
  const navIds = getNavItems('en').map((item) => item.id);

  assert.deepEqual(navIds, [
    'dashboard',
    'strategies',
    'workspace',
    'backtest',
    'experiments',
    'data',
    'jobs',
    'settings',
  ]);

  assert.ok(!getNavItems('en').some((item) => item.label.includes('HFT Lab')));
  assert.ok(!getNavItems('en').some((item) => item.label.includes('AI Lab')));
});

runTest('page names support English default and Chinese switching', () => {
  assert.deepEqual(
    getNavItems('en').map((item) => item.label),
    ['Dashboard', 'Strategy Center', 'Research Workspace', 'Backtest Report', 'Experiments', 'Data Center', 'Jobs', 'Settings'],
  );

  assert.deepEqual(
    getNavItems('zh').map((item) => item.label),
    ['研究总览', '策略中心', '策略研究台', '回测报告', '实验对比', '数据中心', '任务中心', '系统设置'],
  );

  assert.deepEqual(
    ['dashboard', 'strategies', 'workspace', 'backtest', 'experiments', 'data', 'jobs', 'settings'].map(
      (id) => getPage(id, 'en').title,
    ),
    ['Research Command Center', 'Strategy Center', 'Research Workspace', 'Backtest Report', 'Experiments', 'Data Center', 'Jobs', 'Settings'],
  );

  assert.deepEqual(
    ['dashboard', 'strategies', 'workspace', 'backtest', 'experiments', 'data', 'jobs', 'settings'].map(
      (id) => getPage(id, 'zh').title,
    ),
    ['研究指挥台', '策略中心', '策略研究台', '回测报告', '实验对比', '数据中心', '任务中心', '系统设置'],
  );
});

runTest('research workspace exposes traditional, high-frequency, and AI modes in both languages', () => {
  assert.deepEqual(
    getResearchModes('en').map((mode) => mode.id),
    ['traditional', 'hft', 'ai'],
  );

  assert.deepEqual(
    getResearchModes('en').map((mode) => mode.label),
    ['Traditional Quant', 'High-Frequency Research', 'AI Quant'],
  );

  assert.deepEqual(
    getResearchModes('zh').map((mode) => mode.label),
    ['传统量化', '高频研究', 'AI 量化'],
  );
});

runTest('strategies carry stable ids and localized labels', () => {
  const englishStrategies = getStrategies('en');
  const chineseStrategies = getStrategies('zh');

  assert.deepEqual(
    englishStrategies.map((strategy) => strategy.mode),
    ['traditional', 'hft', 'ai'],
  );

  assert.ok(englishStrategies.every((strategy) => strategy.id.length > 0));
  assert.equal(englishStrategies[0].name, 'Multi Factor Core');
  assert.equal(chineseStrategies[0].name, '多因子核心');
  assert.equal(englishStrategies[0].type, 'Traditional Quant Strategy');
  assert.equal(chineseStrategies[0].type, '传统量化策略');
  assert.equal(englishStrategies[1].type, 'High-Frequency Strategy');
  assert.equal(chineseStrategies[1].type, '高频策略');
  assert.equal(englishStrategies[2].type, 'AI Quant Strategy');
  assert.equal(chineseStrategies[2].type, 'AI 量化策略');
});

runTest('traditional quant is explicit and generic code strategy wording is removed', () => {
  const allContent = JSON.stringify({
    nav: getNavItems('en'),
    workspace: getPage('workspace', 'en'),
    modes: getResearchModes('en'),
  });
  const traditionalMode = getResearchMode('traditional', 'en');

  assert.ok(allContent.includes('Traditional Quant Strategy'));
  assert.ok(!allContent.includes('Generic Code Strategy'));
  assert.ok(traditionalMode.sections.flatMap((section) => section.items).includes('Multi-factor Selection'));
  assert.ok(traditionalMode.sections.flatMap((section) => section.items).includes('Statistical Arbitrage'));
});

runTest('research modes expose their own configuration and diagnostics', () => {
  const traditionalItems = getResearchMode('traditional', 'zh').sections.flatMap((section) => section.items);
  const hftItems = getResearchMode('hft', 'zh').sections.flatMap((section) => section.items);
  const aiItems = getResearchMode('ai', 'zh').sections.flatMap((section) => section.items);

  assert.ok(traditionalItems.includes('因子'));
  assert.ok(traditionalItems.includes('股票池'));
  assert.ok(traditionalItems.includes('调仓频率'));
  assert.ok(hftItems.includes('Tick'));
  assert.ok(hftItems.includes('订单簿'));
  assert.ok(hftItems.includes('撤单率'));
  assert.ok(aiItems.includes('特征'));
  assert.ok(aiItems.includes('训练区间'));
  assert.ok(aiItems.includes('预测结果'));
});

runTest('state changes valid pages and ignores removed pages', () => {
  const state = createInitialState();

  setActivePage(state, 'workspace');
  assert.equal(state.activePage, 'workspace');

  setActivePage(state, 'hft');
  assert.equal(state.activePage, 'workspace');
});

runTest('research jobs are localized from selected strategy or active mode', () => {
  const selectedJob = createResearchJob(
    {
      id: 'job-custom',
      sequence: 7,
      strategy: getStrategies('en')[1],
    },
    'en',
  );
  const defaultJob = createResearchJob(
    {
      id: 'job-default',
      mode: 'ai',
      sequence: 8,
    },
    'zh',
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
      kind: 'High-Frequency Research',
      progress: 12,
      state: 'Running',
      strategyName: 'L2 Mean Reversion',
      name: 'Run Research: L2 Mean Reversion',
    },
  );
  assert.equal(defaultJob.kind, 'AI 量化');
  assert.equal(defaultJob.strategyName, 'AI 量化策略草稿 #8');
  assert.equal(defaultJob.name, '运行研究：AI 量化策略草稿 #8');
});

runTest('mock jobs are localized', () => {
  assert.equal(getJobs('en')[0].name, 'Backtest: Multi Factor Core');
  assert.equal(getJobs('en')[0].state, 'Running');
  assert.equal(getJobs('zh')[0].name, '回测：多因子核心');
  assert.equal(getJobs('zh')[0].state, '运行中');
});

runTest('settings language copy is available in both languages', () => {
  assert.equal(getUiCopy('en').languageTitle, 'Interface Language / 界面语言');
  assert.equal(getUiCopy('zh').languageTitle, 'Interface Language / 界面语言');
  assert.equal(getUiCopy('en').runResearch, 'Run Research');
  assert.equal(getUiCopy('zh').runResearch, '运行研究');
  assert.equal(getUiCopy('en').brandTagline, 'Strategy Research Terminal');
  assert.equal(getUiCopy('zh').brandTagline, '策略研究终端');
});
