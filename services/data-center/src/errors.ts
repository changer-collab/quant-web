/**
 * 数据中心错误类型体系
 *
 * 所有数据中心抛出的错误都继承自 DataCenterError，
 * 上层消费者可按 code 或类型进行区分处理。
 */

/** 数据中心错误基类 */
export class DataCenterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DataCenterError';
  }
}

/** 数据未找到 */
export class NotFoundError extends DataCenterError {
  constructor(resource: string, key: string) {
    super(`${resource} 未找到: ${key}`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/** 数据验证失败 */
export class ValidationError extends DataCenterError {
  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/** 写入失败 */
export class WriteError extends DataCenterError {
  constructor(message: string, cause?: unknown) {
    super(message, 'WRITE_ERROR', cause);
    this.name = 'WriteError';
  }
}

/** 查询失败 */
export class QueryError extends DataCenterError {
  constructor(message: string, cause?: unknown) {
    super(message, 'QUERY_ERROR', cause);
    this.name = 'QueryError';
  }
}
