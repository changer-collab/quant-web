/** 量化平台基础错误 */
export class QuantError extends Error {
  readonly code: string;
  readonly detail?: unknown;

  constructor(code: string, message: string, detail?: unknown) {
    super(message);
    this.name = 'QuantError';
    this.code = code;
    this.detail = detail;
  }
}
