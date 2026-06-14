/** 问题严重程度 */
export enum IssueSeverity {
  Warning = 'warning',
  Error = 'error',
}

/** 一致性问题 */
export interface ConsistencyIssue {
  symbol: string;
  /** 问题时间（毫秒时间戳） */
  timestamp: number;
  /** 问题字段 */
  field: string;
  /** 期望值 */
  expectedValue?: number;
  /** 实际值 */
  actualValue: number;
  severity: IssueSeverity;
}

/** 数据质量报告 */
export interface DataQualityReport {
  /** 数据源标识 */
  source: string;
  /** 检查时间范围 */
  dateRange: {
    start: number;
    end: number;
  };
  /** 期望数据点数 */
  totalExpected: number;
  /** 实际数据点数 */
  actualCount: number;
  /** 缺失日期（毫秒时间戳数组） */
  missingDates: number[];
  /** 一致性问题列表 */
  consistencyIssues: ConsistencyIssue[];
  /** 覆盖率（0-1） */
  coverage: number;
  /** 质量是否可接受 */
  isAcceptable: boolean;
}

/** 数据质量校验 Provider 接口 */
export interface DataQualityChecker {
  /** 完整性检查 */
  checkCompleteness(source: string, symbol: string, start: number, end: number): Promise<DataQualityReport>;
  /** 一致性检查 */
  checkConsistency(source: string, symbol: string, start: number, end: number): Promise<DataQualityReport>;
  /** 时效性检查：数据最后更新时间是否在可接受范围内 */
  checkFreshness(source: string, symbol: string, maxStalenessMs: number): Promise<DataQualityReport>;
}
