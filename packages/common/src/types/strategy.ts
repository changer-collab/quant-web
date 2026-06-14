/** 策略参数类型 */
export enum ParamType {
  Number = 'number',
  String = 'string',
  Boolean = 'boolean',
  Select = 'select',
}

/** 策略参数定义 */
export interface StrategyParamDef {
  key: string;
  label: string;
  type: ParamType;
  default: unknown;
  min?: number;
  max?: number;
  options?: string[];
}
