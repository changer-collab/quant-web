/**
 * 回测结果处理器
 *
 * 将 Worker 返回的 backtest result 映射为 BacktestReportFull，
 * 合并 AI 分析、清洗 surrogate 字符后持久化到 ReportRepository。
 * 保存失败时抛异常使 complete handler 将任务标记为 failed。
 */
import type { ResultProcessor, ResultProcessorContext, ResultProcessorOutput } from './types.js';
import type { ReportRepository } from '../../storage/report-repo.js';
import { mapBacktestResultToReport } from '../report-mapper.js';
import type { BacktestResult } from '../../types.js';

// ─── 辅助：清理 LLM 输出中的非法 surrogate 字符 ──────────────────────

function cleanStr(v: unknown): string {
  if (typeof v !== 'string') return String(v ?? '');
  return v.replace(/[\uDC00-\uDFFF]/g, '');
}

function cleanArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => (typeof item === 'string' ? cleanStr(item) : String(item)));
}

// ─── Processor ─────────────────────────────────────────────────────────

export class BacktestResultProcessor implements ResultProcessor {
  constructor(private reportRepo: ReportRepository) {}

  async process(ctx: ResultProcessorContext): Promise<ResultProcessorOutput> {
    const { task, result } = ctx;
    const taskResult = result as {
      backtestResult: BacktestResult;
      analysis?: Record<string, unknown>;
    };
    const backtestResult = taskResult.backtestResult;
    const payload = task.payload as {
      strategy: string;
      symbol: string;
      timeframe: string;
      startTs?: number;
      endTs?: number;
      initialCash?: number;
      slippage?: number;
      params?: Record<string, unknown>;
      configSnapshot?: {
        strategy: string;
        category?: string;
        subcategory?: string;
        hash?: string;
        params: Record<string, unknown>;
      };
    };

    const configSnapshot = payload.configSnapshot;

    const report = mapBacktestResultToReport(backtestResult, {
      strategyName: payload.strategy,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      startTime: payload.startTs,
      endTime: payload.endTs,
      category: configSnapshot?.category,
      subcategory: configSnapshot?.subcategory,
      configHash: configSnapshot?.hash,
    });

    // 合并 AI 分析结果到报告（覆盖结论性字段）
    if (taskResult.analysis) {
      const ai = taskResult.analysis as Record<string, unknown>;

      if (ai.executiveSummary) {
        const es = ai.executiveSummary as Record<string, unknown>;
        report.executiveSummary = {
          ...report.executiveSummary,
          oneLineConclusion:
            cleanStr(es.oneLineConclusion) || report.executiveSummary.oneLineConclusion,
          recommendedForLive:
            (es.recommendedForLive as boolean) ?? report.executiveSummary.recommendedForLive,
          recommendationReason:
            cleanStr(es.recommendationReason) || report.executiveSummary.recommendationReason,
          mainRisks: cleanArray(es.mainRisks).length
            ? cleanArray(es.mainRisks)
            : report.executiveSummary.mainRisks,
        };
      }
      if (ai.overview) {
        const ov = ai.overview as Record<string, unknown>;
        let regime = report.overview.suitableMarketRegime;
        if (ov.suitableMarketRegime !== undefined) {
          if (Array.isArray(ov.suitableMarketRegime)) {
            regime = cleanArray(ov.suitableMarketRegime);
          } else if (typeof ov.suitableMarketRegime === 'string') {
            regime = [cleanStr(ov.suitableMarketRegime)];
          }
        }
        report.overview = {
          ...report.overview,
          logic: cleanStr(ov.logic) || report.overview.logic,
          coreLogic: cleanStr(ov.coreLogic) || report.overview.coreLogic,
          suitableMarketRegime: regime,
        };
      }
      if (ai.issues) {
        const iss = ai.issues as Record<string, unknown>;
        report.issues = {
          ...report.issues,
          overfittingRisk:
            (iss.overfittingRisk as 'low' | 'medium' | 'high') ?? report.issues.overfittingRisk,
          survivorshipBias: (iss.survivorshipBias as boolean) ?? report.issues.survivorshipBias,
          lookAheadBias: (iss.lookAheadBias as boolean) ?? report.issues.lookAheadBias,
          enableMarketRules: (iss.enableMarketRules as boolean) ?? report.issues.enableMarketRules,
          liquidityAssessment:
            cleanStr(iss.liquidityAssessment) || report.issues.liquidityAssessment,
          capacityEstimate: cleanStr(iss.capacityEstimate) || report.issues.capacityEstimate,
        };
      }
      if (ai.conclusion) {
        const con = ai.conclusion as Record<string, unknown>;
        report.conclusion = {
          ...report.conclusion,
          advantages: cleanArray(con.advantages).length
            ? cleanArray(con.advantages)
            : report.conclusion.advantages,
          potentialRisks: cleanArray(con.potentialRisks).length
            ? cleanArray(con.potentialRisks)
            : report.conclusion.potentialRisks,
          improvements: cleanArray(con.improvements).length
            ? cleanArray(con.improvements)
            : report.conclusion.improvements,
          liveTradingAdvice:
            (con.liveTradingAdvice as typeof report.conclusion.liveTradingAdvice) ??
            report.conclusion.liveTradingAdvice,
        };
      }
      if (ai.riskWarnings) {
        const rw = ai.riskWarnings as Record<string, unknown>;
        report.riskWarnings = {
          ...report.riskWarnings,
          limitations:
            (rw.limitations as typeof report.riskWarnings.limitations) ??
            report.riskWarnings.limitations,
          redLines:
            (rw.redLines as typeof report.riskWarnings.redLines) ?? report.riskWarnings.redLines,
        };
      }
    }

    // 持久化报告（失败时抛异常，由 complete handler 标记任务 failed）
    await this.reportRepo.save({
      id: report.id,
      taskId: task.id,
      strategyName: payload.strategy,
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      startTime: payload.startTs,
      endTime: payload.endTs,
      createdAt: Date.now(),
      totalReturn: backtestResult.metrics.totalReturn,
      annualizedReturn: backtestResult.metrics.annualizedReturn,
      sharpeRatio: backtestResult.metrics.sharpeRatio,
      maxDrawdown: backtestResult.metrics.maxDrawdown,
      winRate: backtestResult.metrics.winRate,
      totalTrades: backtestResult.metrics.totalTrades,
      reportData: report,
    });

    return {
      resultId: report.id,
      resultType: 'backtest',
      data: { backtestResult, analysis: taskResult.analysis },
    };
  }
}
