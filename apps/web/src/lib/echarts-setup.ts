/**
 * ECharts 按需引入 + 通用 Hook
 *
 * 使用 echarts-for-react 封装，统一注册必要组件，
 * 所有报告图表通过此 Hook 获取 chart 实例。
 */
import { useRef, useEffect, useCallback } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart, RadarChart, PieChart, GaugeChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  RadarComponent as RadarCoordComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import quantDarkTheme from './echarts-theme';

// 注册必要组件（一次性）
echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  RadarChart,
  PieChart,
  GaugeChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
  ToolboxComponent,
  RadarCoordComponent,
  CanvasRenderer,
]);

// 注册主题
echarts.registerTheme('quant-dark', quantDarkTheme);

export { ReactEChartsCore, echarts };

/** 通用图表容器样式常量 */
export const CHART_DEFAULTS = {
  /** 图表最小高度 */
  minHeight: 280,
  /** tooltip 统一配置 */
  tooltip: {
    trigger: 'axis' as const,
    backgroundColor: 'rgba(17, 25, 23, 0.95)',
    borderColor: '#263632',
    textStyle: { color: '#e6eee9', fontSize: 12 },
  },
};

/** 百分比格式化 */
export function fmtPct(v: number): string {
  return `${(v >= 0 ? '+' : '')}${(v * 100).toFixed(2)}%`;
}

/** 数值格式化 */
export function fmtNum(v: number, digits = 2): string {
  return v.toFixed(digits);
}
