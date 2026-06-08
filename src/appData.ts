export type PageId =
  | 'dashboard'
  | 'strategies'
  | 'workspace'
  | 'backtest'
  | 'experiments'
  | 'data'
  | 'jobs'
  | 'settings';

export type ResearchModeId = 'traditional' | 'hft' | 'ai';
export type MetricTone = 'good' | 'info' | 'warn';
export type LanguageCode = 'en' | 'zh';
export type JobTemplate = 'backtest' | 'train' | 'experiment' | 'run';

export interface NavItem {
  id: PageId;
  label: string;
  eyebrow: string;
}

export interface Metric {
  label: string;
  value: string;
  tone: MetricTone;
}

export interface PageSection {
  title: string;
  items: string[];
}

export interface PageContent {
  title: string;
  subtitle: string;
  status: string;
  heroMetrics: Metric[];
  sections: PageSection[];
}

export interface ResearchMode {
  id: ResearchModeId;
  label: string;
  title: string;
  description: string;
  codeFile: string;
  codeSample: string;
  heroMetrics: Metric[];
  sections: PageSection[];
}

export interface AppState {
  activePage: PageId;
}

export interface StrategyRow {
  id: string;
  mode: ResearchModeId;
  name: string;
  type: string;
  return: string;
  drawdown: string;
  sharpe: string;
  status: string;
}

export interface MarketTick {
  time: string;
  bid: string;
  ask: string;
  size: string;
  signal: string;
}

export interface JobItem {
  name: string;
  kind: string;
  state: string;
  progress: number;
}

export interface ResearchJob extends JobItem {
  id: string;
  strategyName: string;
  template?: JobTemplate;
  mode?: ResearchModeId;
  strategyId?: string;
  sequence?: number;
}

export interface CreateResearchJobInput {
  id: string;
  sequence: number;
  mode?: ResearchModeId;
  strategy?: StrategyRow;
}

export interface UiCopy {
  aiDiagnosticsTitle: string;
  aiRiskStable: string;
  aiRiskWatch: string;
  aiTableHeaders: {
    featureSet: string;
    ic: string;
    rankIc: string;
    oosReturn: string;
    risk: string;
  };
  brandTagline: string;
  chartAriaLabel: string;
  currentResearchMode: string;
  enterWorkspace: string;
  heroEyebrow: string;
  languageDescription: string;
  languageTitle: string;
  modeTabsAriaLabel: string;
  navAriaLabel: string;
  ready: string;
  runResearch: string;
  strategySample: string;
  strategyTableTitle: string;
  strategyTableHeaders: {
    strategy: string;
    type: string;
    return: string;
    drawdown: string;
    sharpe: string;
    status: string;
  };
  tickTableHeaders: {
    time: string;
    bid: string;
    ask: string;
    size: string;
    signal: string;
  };
  tickTableTitle: string;
  workspaceAriaLabel: string;
}

interface LanguageContent {
  navItems: NavItem[];
  pages: Record<PageId, PageContent>;
  researchModes: ResearchMode[];
  strategies: StrategyRow[];
  marketTicks: MarketTick[];
  jobs: ResearchJob[];
  modeJobKind: Record<ResearchModeId, string>;
  ui: UiCopy;
  runningState: string;
  runJobPrefix: string;
  draftSuffix: string;
}

const traditionalCodeSample = `def rebalance(context):
    universe = select_stocks(factors=['value', 'quality', 'momentum'])
    weights = optimize(universe, max_position=0.08)
    order_target_weights(weights)`;

const hftCodeSample = `def on_tick(book, trades):
    imbalance = book.bid_size / book.ask_size
    if imbalance > 1.8 and spread(book) < 0.02:
        buy(limit=book.ask, delay_ms=22)`;

const aiCodeSample = `def train_model(dataset):
    features = build_features(dataset, horizon='5m')
    model = fit_xgboost(features, label='future_return')
    return backtest_predictions(model)`;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'quantforge.language';

const CONTENT: Record<LanguageCode, LanguageContent> = {
  en: {
    navItems: [
      { id: 'dashboard', label: 'Dashboard', eyebrow: 'Overview' },
      { id: 'strategies', label: 'Strategy Center', eyebrow: 'Strategies' },
      { id: 'workspace', label: 'Research Workspace', eyebrow: 'Research' },
      { id: 'backtest', label: 'Backtest Report', eyebrow: 'Reports' },
      { id: 'experiments', label: 'Experiments', eyebrow: 'Experiments' },
      { id: 'data', label: 'Data Center', eyebrow: 'Data' },
      { id: 'jobs', label: 'Jobs', eyebrow: 'Jobs' },
      { id: 'settings', label: 'Settings', eyebrow: 'Settings' },
    ],
    researchModes: [
      {
        id: 'traditional',
        label: 'Traditional Quant',
        title: 'Traditional Quant Strategy',
        description: 'Covers factors, timing, arbitrage, and portfolio backtests as the platform baseline strategy path.',
        codeFile: 'traditional_alpha.py',
        codeSample: traditionalCodeSample,
        heroMetrics: [
          { label: 'Strategy Style', value: 'Factor', tone: 'info' },
          { label: 'Rebalance', value: 'Daily', tone: 'good' },
          { label: 'Universe', value: 'CSI 500', tone: 'info' },
          { label: 'Turnover', value: '38.4%', tone: 'warn' },
        ],
        sections: [
          {
            title: 'Traditional Quant Types',
            items: ['Multi-factor Selection', 'Mean Reversion', 'Trend Following', 'Statistical Arbitrage', 'Market Timing'],
          },
          { title: 'Research Setup', items: ['Factors', 'Universe', 'Rebalance Frequency', 'Position Constraints', 'Backtest Params'] },
          { title: 'Diagnostics', items: ['Return', 'Drawdown', 'Sharpe', 'Win Rate', 'Turnover'] },
        ],
      },
      {
        id: 'hft',
        label: 'High-Frequency Research',
        title: 'High-Frequency Strategy Research',
        description: 'A research mode focused on Tick data, order books, matching assumptions, and execution quality.',
        codeFile: 'hft_microstructure.py',
        codeSample: hftCodeSample,
        heroMetrics: [
          { label: 'Frequency', value: 'Tick / 1s', tone: 'info' },
          { label: 'Fill Rate', value: '72.6%', tone: 'good' },
          { label: 'Avg Slippage', value: '1.4bp', tone: 'warn' },
          { label: 'Cancel Rate', value: '18.9%', tone: 'warn' },
        ],
        sections: [
          { title: 'HFT Setup', items: ['Tick', 'Order Book', 'Matching Rules', 'Slippage', 'Latency', 'Cancel Rate'] },
          { title: 'Microstructure', items: ['Tick Data View', 'Order Book Snapshots', 'Trade Stream', 'Depth Changes'] },
          { title: 'Execution Diagnostics', items: ['Fill Rate', 'Average Slippage', 'Order Latency', 'Book Impact'] },
        ],
      },
      {
        id: 'ai',
        label: 'AI Quant',
        title: 'AI Quant Strategy',
        description: 'A predictive research mode built around features, labels, model training, and out-of-sample behavior.',
        codeFile: 'ml_alpha.py',
        codeSample: aiCodeSample,
        heroMetrics: [
          { label: 'Model', value: 'XGBoost', tone: 'info' },
          { label: 'IC', value: '0.071', tone: 'good' },
          { label: 'Rank IC', value: '0.094', tone: 'good' },
          { label: 'Out-of-Sample', value: '+6.8%', tone: 'info' },
        ],
        sections: [
          { title: 'AI Setup', items: ['Features', 'Labels', 'Model', 'Training Window', 'Validation Window', 'Predictions'] },
          { title: 'Model Training', items: ['Training Job Status', 'Feature Importance', 'Prediction Curve'] },
          { title: 'Strategy Validation', items: ['Predicted vs Actual Return', 'Train / Validation / Test Performance', 'AI Backtest Result'] },
        ],
      },
    ],
    pages: {
      dashboard: {
        title: 'Research Command Center',
        subtitle: 'Track strategies, backtests, training jobs, and risk shifts from the first screen.',
        status: 'Research workflow healthy today',
        heroMetrics: [
          { label: 'Portfolio CAGR', value: '31.8%', tone: 'good' },
          { label: 'Max Drawdown', value: '-8.7%', tone: 'warn' },
          { label: 'Training Jobs', value: '3 Running', tone: 'info' },
          { label: 'Tick Coverage', value: '98.4%', tone: 'good' },
        ],
        sections: [
          { title: 'Recent Strategies', items: ['L2 Mean Reversion', 'AI Micro Alpha', 'Opening Auction Drift'] },
          { title: 'Watchlist', items: ['Equity Curve Overview', 'Risk Metrics', 'Job Status', 'Recent Backtests'] },
        ],
      },
      strategies: {
        title: 'Strategy Center',
        subtitle: 'Manage strategy lists, categories, state, and return summaries; research happens in the workspace.',
        status: '12 active strategies',
        heroMetrics: [
          { label: 'Traditional Quant', value: '5', tone: 'info' },
          { label: 'HFT Strategies', value: '4', tone: 'good' },
          { label: 'AI Quant', value: '3', tone: 'warn' },
          { label: 'Best Sharpe', value: '2.41', tone: 'good' },
        ],
        sections: [
          { title: 'Strategy Classes', items: ['Traditional Quant Strategy', 'High-Frequency Strategy', 'AI Quant Strategy'] },
          { title: 'Management Actions', items: ['Tags and Status', 'Return / Drawdown / Sharpe', 'Duplicate Strategy', 'Open Research Workspace'] },
        ],
      },
      workspace: {
        title: 'Research Workspace',
        subtitle: 'Unifies traditional quant, high-frequency research, and AI quant without splitting strategy paradigms into isolated pages.',
        status: 'Workspace saved',
        heroMetrics: [
          { label: 'Modes', value: '3 Modes', tone: 'good' },
          { label: 'Data', value: 'Daily / Tick', tone: 'info' },
          { label: 'Backtest', value: 'Ready', tone: 'good' },
          { label: 'Training', value: 'Ready', tone: 'info' },
        ],
        sections: [
          { title: 'Research Modes', items: ['Traditional Quant Strategy', 'High-Frequency Strategy', 'AI Quant Strategy'] },
          { title: 'Unified Flow', items: ['Choose Strategy Paradigm', 'Configure Research Params', 'Run Backtest or Training', 'Review Unified Report'] },
        ],
      },
      backtest: {
        title: 'Backtest Report',
        subtitle: 'A unified report that changes metrics based on traditional, high-frequency, or AI strategy type.',
        status: 'Backtest completed 14:28:09',
        heroMetrics: [
          { label: 'Annual Return', value: '34.6%', tone: 'good' },
          { label: 'Max Drawdown', value: '-9.2%', tone: 'warn' },
          { label: 'Sharpe', value: '2.18', tone: 'good' },
          { label: 'Trades', value: '18,420', tone: 'info' },
        ],
        sections: [
          { title: 'Traditional Metrics', items: ['Return', 'Drawdown', 'Sharpe', 'Win Rate', 'Turnover'] },
          { title: 'HFT Metrics', items: ['Fill Rate', 'Slippage', 'Latency', 'Book Impact'] },
          { title: 'AI Metrics', items: ['IC', 'Rank IC', 'Prediction Accuracy', 'Out-of-Sample Performance'] },
        ],
      },
      experiments: {
        title: 'Experiments',
        subtitle: 'Compare strategies, parameters, models, and data windows without tuning by feel.',
        status: '27 experiments this week',
        heroMetrics: [
          { label: 'Param Sets', value: '128', tone: 'info' },
          { label: 'Best Drawdown', value: '-5.1%', tone: 'good' },
          { label: 'Best IC', value: '0.083', tone: 'good' },
          { label: 'Stability', value: 'A-', tone: 'warn' },
        ],
        sections: [
          { title: 'Experiment Comparison', items: ['Parameter Result Table', '2-4 Equity Curves', 'Strategy / Model / Window Comparison'] },
          { title: 'Overfit Guardrails', items: ['Out-of-Sample Performance', 'Train / Validation Gap', 'Stability Score'] },
        ],
      },
      data: {
        title: 'Data Center',
        subtitle: 'Inspect markets, instruments, and Tick/minute/daily coverage.',
        status: 'Data sync healthy',
        heroMetrics: [
          { label: 'Instruments', value: '4,812', tone: 'info' },
          { label: 'Tick Since', value: '2019', tone: 'good' },
          { label: 'Minute Bars', value: '99.1%', tone: 'good' },
          { label: 'Gaps', value: '0.6%', tone: 'warn' },
        ],
        sections: [
          { title: 'Data Assets', items: ['Markets', 'Instrument List', 'Field Dictionary', 'Coverage Window'] },
          { title: 'Frequencies', items: ['Tick Data', 'Minute Data', 'Daily Data'] },
        ],
      },
      jobs: {
        title: 'Jobs',
        subtitle: 'Manage backtest and model training jobs so long-running research state stays visible.',
        status: '2 running / 1 queued',
        heroMetrics: [
          { label: 'Backtests Running', value: '2', tone: 'info' },
          { label: 'Training Running', value: '1', tone: 'warn' },
          { label: 'Success Rate', value: '96.3%', tone: 'good' },
          { label: 'Avg Duration', value: '04:12', tone: 'info' },
        ],
        sections: [
          { title: 'Job States', items: ['Queued', 'Running', 'Succeeded', 'Failed'] },
          { title: 'Job Details', items: ['Duration', 'Start Time', 'Error Summary', 'Job Logs'] },
        ],
      },
      settings: {
        title: 'Settings',
        subtitle: 'Keep this simple: only defaults that affect the research experience.',
        status: 'Local preferences',
        heroMetrics: [
          { label: 'Default Market', value: 'CN A', tone: 'info' },
          { label: 'Fee', value: '0.7bp', tone: 'warn' },
          { label: 'Slippage', value: '1.2bp', tone: 'warn' },
          { label: 'Theme', value: 'Terminal', tone: 'good' },
        ],
        sections: [
          { title: 'Research Defaults', items: ['Default Market', 'Default Fee', 'Default Slippage'] },
          { title: 'Workspace Preferences', items: ['Editor Preference', 'Theme', 'Chart Density'] },
        ],
      },
    },
    strategies: [
      {
        id: 'strategy-traditional-core',
        mode: 'traditional',
        name: 'Multi Factor Core',
        type: 'Traditional Quant Strategy',
        return: '+21.4%',
        drawdown: '-7.4%',
        sharpe: '1.72',
        status: 'Stable',
      },
      {
        id: 'strategy-hft-l2',
        mode: 'hft',
        name: 'L2 Mean Reversion',
        type: 'High-Frequency Strategy',
        return: '+34.6%',
        drawdown: '-9.2%',
        sharpe: '2.18',
        status: 'Researching',
      },
      {
        id: 'strategy-ai-micro-alpha',
        mode: 'ai',
        name: 'AI Micro Alpha',
        type: 'AI Quant Strategy',
        return: '+27.1%',
        drawdown: '-7.8%',
        sharpe: '1.94',
        status: 'Training',
      },
    ],
    marketTicks: [
      { time: '09:30:00.120', bid: '12.38', ask: '12.39', size: '8,400', signal: 'buy pressure' },
      { time: '09:30:00.340', bid: '12.39', ask: '12.40', size: '11,200', signal: 'spread widen' },
      { time: '09:30:00.680', bid: '12.41', ask: '12.42', size: '6,900', signal: 'fill event' },
      { time: '09:30:01.040', bid: '12.40', ask: '12.41', size: '9,700', signal: 'cancel spike' },
    ],
    jobs: [
      {
        id: 'job-backtest-multi-factor-core',
        name: 'Backtest: Multi Factor Core',
        kind: 'Traditional Quant',
        state: 'Running',
        progress: 68,
        strategyName: 'Multi Factor Core',
        template: 'backtest',
        mode: 'traditional',
        strategyId: 'strategy-traditional-core',
      },
      {
        id: 'job-train-xgboost-tick-alpha',
        name: 'Train: xgboost_tick_alpha',
        kind: 'AI Quant',
        state: 'Running',
        progress: 42,
        strategyName: 'AI Micro Alpha',
        template: 'train',
        mode: 'ai',
        strategyId: 'strategy-ai-micro-alpha',
      },
      {
        id: 'job-fee-stress',
        name: 'Experiment sweep: fee stress',
        kind: 'Experiment',
        state: 'Queued',
        progress: 8,
        strategyName: 'L2 Mean Reversion',
        template: 'experiment',
        mode: 'hft',
        strategyId: 'strategy-hft-l2',
      },
    ],
    modeJobKind: {
      traditional: 'Traditional Quant',
      hft: 'High-Frequency Research',
      ai: 'AI Quant',
    },
    ui: {
      aiDiagnosticsTitle: 'AI Prediction Diagnostics',
      aiRiskStable: 'Stable',
      aiRiskWatch: 'Watch',
      aiTableHeaders: {
        featureSet: 'Feature Set',
        ic: 'IC',
        rankIc: 'Rank IC',
        oosReturn: 'OOS Return',
        risk: 'Risk',
      },
      brandTagline: 'Strategy Research Terminal',
      chartAriaLabel: 'Research chart preview',
      currentResearchMode: 'Current Research Mode',
      enterWorkspace: 'Open Research Workspace',
      heroEyebrow: 'Personal Quant Research Workspace',
      languageDescription: 'Choose the interface language. Your choice is saved on this device.',
      languageTitle: 'Interface Language / 界面语言',
      modeTabsAriaLabel: 'Strategy research modes',
      navAriaLabel: 'Main navigation',
      ready: 'Ready',
      runResearch: 'Run Research',
      strategySample: 'Workspace strategy sample',
      strategyTableTitle: 'Strategy Center',
      strategyTableHeaders: {
        strategy: 'Strategy',
        type: 'Type',
        return: 'Return',
        drawdown: 'Drawdown',
        sharpe: 'Sharpe',
        status: 'Status',
      },
      tickTableHeaders: {
        time: 'Time',
        bid: 'Bid',
        ask: 'Ask',
        size: 'Size',
        signal: 'Signal',
      },
      tickTableTitle: 'Tick Stream',
      workspaceAriaLabel: 'Strategy workspace preview',
    },
    runningState: 'Running',
    runJobPrefix: 'Run Research: ',
    draftSuffix: ' Draft',
  },
  zh: {
    navItems: [
      { id: 'dashboard', label: '研究总览', eyebrow: '总览' },
      { id: 'strategies', label: '策略中心', eyebrow: '策略' },
      { id: 'workspace', label: '策略研究台', eyebrow: '研究' },
      { id: 'backtest', label: '回测报告', eyebrow: '报告' },
      { id: 'experiments', label: '实验对比', eyebrow: '实验' },
      { id: 'data', label: '数据中心', eyebrow: '数据' },
      { id: 'jobs', label: '任务中心', eyebrow: '任务' },
      { id: 'settings', label: '系统设置', eyebrow: '设置' },
    ],
    researchModes: [
      {
        id: 'traditional',
        label: '传统量化',
        title: '传统量化策略',
        description: '覆盖因子、择时、套利和组合回测，是平台最基础的一等策略入口。',
        codeFile: 'traditional_alpha.py',
        codeSample: traditionalCodeSample,
        heroMetrics: [
          { label: '策略范式', value: 'Factor', tone: 'info' },
          { label: '调仓频率', value: 'Daily', tone: 'good' },
          { label: '股票池', value: 'CSI 500', tone: 'info' },
          { label: '换手率', value: '38.4%', tone: 'warn' },
        ],
        sections: [
          { title: '传统量化类型', items: ['多因子选股', '均值回归', '趋势跟踪', '统计套利', '择时策略'] },
          { title: '研究配置', items: ['因子', '股票池', '调仓频率', '持仓约束', '回测参数'] },
          { title: '诊断指标', items: ['收益', '回撤', '夏普', '胜率', '换手率'] },
        ],
      },
      {
        id: 'hft',
        label: '高频研究',
        title: '高频策略研究',
        description: '高频作为研究模式存在，专注 tick、盘口、撮合假设和执行质量。',
        codeFile: 'hft_microstructure.py',
        codeSample: hftCodeSample,
        heroMetrics: [
          { label: '频率', value: 'Tick / 1s', tone: 'info' },
          { label: '成交率', value: '72.6%', tone: 'good' },
          { label: '平均滑点', value: '1.4bp', tone: 'warn' },
          { label: '撤单率', value: '18.9%', tone: 'warn' },
        ],
        sections: [
          { title: '高频配置', items: ['Tick', '订单簿', '撮合规则', '滑点', '延迟', '撤单率'] },
          { title: '微观结构', items: ['Tick 数据查看', '订单簿快照', '成交流', '买卖盘深度变化'] },
          { title: '执行诊断', items: ['成交率', '平均滑点', '订单延迟', '盘口冲击'] },
        ],
      },
      {
        id: 'ai',
        label: 'AI 量化',
        title: 'AI 量化策略',
        description: 'AI 作为预测型研究模式存在，围绕特征、标签、模型训练和样本外表现。',
        codeFile: 'ml_alpha.py',
        codeSample: aiCodeSample,
        heroMetrics: [
          { label: '模型', value: 'XGBoost', tone: 'info' },
          { label: 'IC', value: '0.071', tone: 'good' },
          { label: 'Rank IC', value: '0.094', tone: 'good' },
          { label: '样本外', value: '+6.8%', tone: 'info' },
        ],
        sections: [
          { title: 'AI 配置', items: ['特征', '标签', '模型', '训练区间', '验证区间', '预测结果'] },
          { title: '模型训练', items: ['训练任务状态', '特征重要性', '预测结果曲线'] },
          { title: '策略验证', items: ['预测值 vs 实际收益', '训练集 / 验证集 / 测试集表现', 'AI 策略回测结果'] },
        ],
      },
    ],
    pages: {
      dashboard: {
        title: '研究指挥台',
        subtitle: '跟踪策略、回测、训练任务和风险变化，第一屏直接进入研究状态。',
        status: '今日研究链路正常',
        heroMetrics: [
          { label: '组合年化', value: '31.8%', tone: 'good' },
          { label: '最大回撤', value: '-8.7%', tone: 'warn' },
          { label: '训练任务', value: '3 个运行中', tone: 'info' },
          { label: 'Tick 覆盖', value: '98.4%', tone: 'good' },
        ],
        sections: [
          { title: '最近策略', items: ['盘口均值回归', 'AI 微观 Alpha', '开盘竞价漂移'] },
          { title: '重点监控', items: ['收益曲线概览', '风险指标', '任务状态', '最近回测'] },
        ],
      },
      strategies: {
        title: '策略中心',
        subtitle: '策略中心只负责管理：列表、分类、状态、收益摘要；研究行为进入策略研究台完成。',
        status: '12 个活跃策略',
        heroMetrics: [
          { label: '传统量化', value: '5', tone: 'info' },
          { label: '高频策略', value: '4', tone: 'good' },
          { label: 'AI 量化', value: '3', tone: 'warn' },
          { label: '最佳夏普', value: '2.41', tone: 'good' },
        ],
        sections: [
          { title: '策略分类', items: ['传统量化策略', '高频策略', 'AI 量化策略'] },
          { title: '管理动作', items: ['标签与状态', '收益 / 回撤 / 夏普', '复制策略', '进入策略研究台'] },
        ],
      },
      workspace: {
        title: '策略研究台',
        subtitle: '统一承载传统量化、高频研究和 AI 量化，避免把策略范式拆成孤立页面。',
        status: '研究台已保存',
        heroMetrics: [
          { label: '模式', value: '3 种模式', tone: 'good' },
          { label: '数据', value: 'Daily / Tick', tone: 'info' },
          { label: '回测', value: '就绪', tone: 'good' },
          { label: '训练', value: '就绪', tone: 'info' },
        ],
        sections: [
          { title: '研究模式', items: ['传统量化策略', '高频策略', 'AI 量化策略'] },
          { title: '统一流程', items: ['选择策略范式', '配置研究参数', '运行回测或训练', '查看统一报告'] },
        ],
      },
      backtest: {
        title: '回测报告',
        subtitle: '统一承接所有策略类型，通过策略类型决定展示传统、高频或 AI 指标。',
        status: '回测完成 14:28:09',
        heroMetrics: [
          { label: '年化收益', value: '34.6%', tone: 'good' },
          { label: '最大回撤', value: '-9.2%', tone: 'warn' },
          { label: '夏普', value: '2.18', tone: 'good' },
          { label: '交易次数', value: '18,420', tone: 'info' },
        ],
        sections: [
          { title: '传统量化指标', items: ['收益', '回撤', '夏普', '胜率', '换手率'] },
          { title: '高频指标', items: ['成交率', '滑点', '延迟', '盘口冲击'] },
          { title: 'AI 指标', items: ['IC', 'Rank IC', '预测准确率', '样本外表现'] },
        ],
      },
      experiments: {
        title: '实验对比',
        subtitle: '对比不同策略、参数、模型和数据区间，减少靠感觉调参。',
        status: '本周 27 次实验',
        heroMetrics: [
          { label: '参数组合', value: '128', tone: 'info' },
          { label: '最佳回撤', value: '-5.1%', tone: 'good' },
          { label: '最佳 IC', value: '0.083', tone: 'good' },
          { label: '稳定性', value: 'A-', tone: 'warn' },
        ],
        sections: [
          { title: '实验对比', items: ['参数组合结果表', '2-4 条净值曲线叠加', '策略 / 模型 / 区间对比'] },
          { title: '防过拟合', items: ['样本外表现', '训练/验证差异', '稳定性评分'] },
        ],
      },
      data: {
        title: '数据中心',
        subtitle: '查看可用市场、标的、tick/分钟/日线数据覆盖情况。',
        status: '数据同步正常',
        heroMetrics: [
          { label: '标的数', value: '4,812', tone: 'info' },
          { label: 'Tick 起始', value: '2019', tone: 'good' },
          { label: '分钟线', value: '99.1%', tone: 'good' },
          { label: '缺口', value: '0.6%', tone: 'warn' },
        ],
        sections: [
          { title: '数据资产', items: ['可用市场', '标的列表', '字段说明', '数据覆盖时间'] },
          { title: '频率', items: ['tick 数据', '分钟数据', '日线数据'] },
        ],
      },
      jobs: {
        title: '任务中心',
        subtitle: '集中管理回测任务和模型训练任务，避免长任务状态丢失。',
        status: '2 个运行中 / 1 个排队中',
        heroMetrics: [
          { label: '回测运行中', value: '2', tone: 'info' },
          { label: '训练运行中', value: '1', tone: 'warn' },
          { label: '成功率', value: '96.3%', tone: 'good' },
          { label: '平均耗时', value: '04:12', tone: 'info' },
        ],
        sections: [
          { title: '任务状态', items: ['等待中', '运行中', '成功', '失败'] },
          { title: '任务信息', items: ['耗时', '开始时间', '错误摘要', '任务日志'] },
        ],
      },
      settings: {
        title: '系统设置',
        subtitle: '保持简单，只放影响研究体验的默认配置。',
        status: '本地配置',
        heroMetrics: [
          { label: '默认市场', value: 'CN A', tone: 'info' },
          { label: '手续费', value: '0.7bp', tone: 'warn' },
          { label: '滑点', value: '1.2bp', tone: 'warn' },
          { label: '主题', value: '终端', tone: 'good' },
        ],
        sections: [
          { title: '研究默认值', items: ['默认市场', '默认手续费', '默认滑点'] },
          { title: '工作台偏好', items: ['编辑器偏好', '主题', '图表密度'] },
        ],
      },
    },
    strategies: [
      {
        id: 'strategy-traditional-core',
        mode: 'traditional',
        name: '多因子核心',
        type: '传统量化策略',
        return: '+21.4%',
        drawdown: '-7.4%',
        sharpe: '1.72',
        status: '稳定',
      },
      {
        id: 'strategy-hft-l2',
        mode: 'hft',
        name: '盘口均值回归',
        type: '高频策略',
        return: '+34.6%',
        drawdown: '-9.2%',
        sharpe: '2.18',
        status: '研究中',
      },
      {
        id: 'strategy-ai-micro-alpha',
        mode: 'ai',
        name: 'AI 微观 Alpha',
        type: 'AI 量化策略',
        return: '+27.1%',
        drawdown: '-7.8%',
        sharpe: '1.94',
        status: '训练中',
      },
    ],
    marketTicks: [
      { time: '09:30:00.120', bid: '12.38', ask: '12.39', size: '8,400', signal: '买盘增强' },
      { time: '09:30:00.340', bid: '12.39', ask: '12.40', size: '11,200', signal: '价差扩大' },
      { time: '09:30:00.680', bid: '12.41', ask: '12.42', size: '6,900', signal: '成交触发' },
      { time: '09:30:01.040', bid: '12.40', ask: '12.41', size: '9,700', signal: '撤单尖峰' },
    ],
    jobs: [
      {
        id: 'job-backtest-multi-factor-core',
        name: '回测：多因子核心',
        kind: '传统量化',
        state: '运行中',
        progress: 68,
        strategyName: '多因子核心',
        template: 'backtest',
        mode: 'traditional',
        strategyId: 'strategy-traditional-core',
      },
      {
        id: 'job-train-xgboost-tick-alpha',
        name: '训练：xgboost_tick_alpha',
        kind: 'AI 量化',
        state: '运行中',
        progress: 42,
        strategyName: 'AI 微观 Alpha',
        template: 'train',
        mode: 'ai',
        strategyId: 'strategy-ai-micro-alpha',
      },
      {
        id: 'job-fee-stress',
        name: '实验：费率压力测试',
        kind: '实验',
        state: '排队中',
        progress: 8,
        strategyName: '盘口均值回归',
        template: 'experiment',
        mode: 'hft',
        strategyId: 'strategy-hft-l2',
      },
    ],
    modeJobKind: {
      traditional: '传统量化',
      hft: '高频研究',
      ai: 'AI 量化',
    },
    ui: {
      aiDiagnosticsTitle: 'AI 预测诊断',
      aiRiskStable: '稳定',
      aiRiskWatch: '观察',
      aiTableHeaders: {
        featureSet: '特征集',
        ic: 'IC',
        rankIc: 'Rank IC',
        oosReturn: '样本外收益',
        risk: '风险',
      },
      brandTagline: '策略研究终端',
      chartAriaLabel: '研究图表预览',
      currentResearchMode: '当前研究模式',
      enterWorkspace: '进入策略研究台',
      heroEyebrow: '个人量化研究者工作台',
      languageDescription: '选择界面语言。你的选择会保存在本机。',
      languageTitle: 'Interface Language / 界面语言',
      modeTabsAriaLabel: '策略研究模式',
      navAriaLabel: '主导航',
      ready: '就绪',
      runResearch: '运行研究',
      strategySample: '研究台策略样本',
      strategyTableTitle: '策略中心',
      strategyTableHeaders: {
        strategy: '策略',
        type: '类型',
        return: '收益',
        drawdown: '回撤',
        sharpe: '夏普',
        status: '状态',
      },
      tickTableHeaders: {
        time: '时间',
        bid: '买一价',
        ask: '卖一价',
        size: '数量',
        signal: '信号',
      },
      tickTableTitle: 'Tick 成交流',
      workspaceAriaLabel: '策略研究台预览',
    },
    runningState: '运行中',
    runJobPrefix: '运行研究：',
    draftSuffix: '草稿',
  },
};

export function resolveLanguageCode(value: unknown): LanguageCode {
  return value === 'zh' || value === 'en' ? value : DEFAULT_LANGUAGE;
}

function getContent(language?: unknown): LanguageContent {
  return CONTENT[resolveLanguageCode(language)];
}

function copyJob(job: ResearchJob): ResearchJob {
  return { ...job };
}

export function getNavItems(language?: unknown): NavItem[] {
  return getContent(language).navItems;
}

export function getPages(language?: unknown): Record<PageId, PageContent> {
  return getContent(language).pages;
}

export function getResearchModes(language?: unknown): ResearchMode[] {
  return getContent(language).researchModes;
}

export function getStrategies(language?: unknown): StrategyRow[] {
  return getContent(language).strategies;
}

export function getMarketTicks(language?: unknown): MarketTick[] {
  return getContent(language).marketTicks;
}

export function getJobs(language?: unknown): ResearchJob[] {
  return getContent(language).jobs.map(copyJob);
}

export function getUiCopy(language?: unknown): UiCopy {
  return getContent(language).ui;
}

export function getPage(id: string, language?: unknown): PageContent {
  const pages = getPages(language);
  return pages[(id as PageId) in pages ? (id as PageId) : 'dashboard'];
}

export function getResearchMode(id: string, language?: unknown): ResearchMode {
  return getResearchModes(language).find((mode) => mode.id === id) ?? getResearchModes(language)[0];
}

export function localizeResearchJob(job: ResearchJob, language?: unknown): ResearchJob {
  const content = getContent(language);
  const seedJob = content.jobs.find((item) => item.id === job.id);

  if (job.template !== 'run' && seedJob) {
    return { ...seedJob, progress: job.progress };
  }

  if (job.template !== 'run') {
    return { ...job, state: job.state === '排队中' || job.state === 'Queued' ? job.state : content.runningState };
  }

  const mode = job.mode ?? 'traditional';
  const strategy = job.strategyId ? getStrategies(language).find((item) => item.id === job.strategyId) : undefined;
  const strategyName = strategy?.name ?? `${getResearchMode(mode, language).title}${content.draftSuffix} #${job.sequence ?? 1}`;

  return {
    ...job,
    kind: content.modeJobKind[mode],
    name: `${content.runJobPrefix}${strategyName}`,
    state: content.runningState,
    strategyName,
  };
}

export function createResearchJob(input: CreateResearchJobInput, language?: unknown): ResearchJob {
  const content = getContent(language);
  const mode = input.strategy?.mode ?? input.mode ?? 'traditional';
  const strategyName =
    input.strategy?.name ?? `${getResearchMode(mode, language).title}${content.draftSuffix} #${input.sequence}`;

  return {
    id: input.id,
    name: `${content.runJobPrefix}${strategyName}`,
    kind: content.modeJobKind[mode],
    state: content.runningState,
    progress: 12,
    strategyName,
    template: 'run',
    mode,
    strategyId: input.strategy?.id,
    sequence: input.sequence,
  };
}

export function createInitialState(): AppState {
  return { activePage: 'dashboard' };
}

export function isPageId(id: string): id is PageId {
  return id in CONTENT[DEFAULT_LANGUAGE].pages;
}

export function setActivePage(state: AppState, id: string): AppState {
  if (isPageId(id)) {
    state.activePage = id;
  }
  return state;
}

export const NAV_ITEMS = getNavItems(DEFAULT_LANGUAGE);
export const RESEARCH_MODES = getResearchModes(DEFAULT_LANGUAGE);
export const PAGES = getPages(DEFAULT_LANGUAGE);
export const STRATEGIES = getStrategies(DEFAULT_LANGUAGE);
export const MARKET_TICKS = getMarketTicks(DEFAULT_LANGUAGE);
export const JOBS = getJobs(DEFAULT_LANGUAGE);
