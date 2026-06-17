/**
 * ECharts 暗色主题，与项目 design tokens 对齐
 */
import type { ComposeOption } from 'echarts/core';

const quantDarkTheme = {
  color: [
    '#4df0a0', // --green
    '#62d8ff', // --cyan
    '#e9c46a', // --amber
    '#ff6b6b', // --red
    '#a78bfa', // purple
    '#f472b6', // pink
    '#34d399', // emerald
    '#fbbf24', // yellow
  ],
  backgroundColor: 'transparent',
  textStyle: {
    color: '#8fa29b', // --muted
    fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
  },
  title: {
    textStyle: { color: '#e6eee9', fontSize: 14, fontWeight: 700 },
    subtextStyle: { color: '#8fa29b', fontSize: 12 },
  },
  legend: {
    textStyle: { color: '#8fa29b', fontSize: 12 },
  },
  tooltip: {
    backgroundColor: 'rgba(17, 25, 23, 0.95)',
    borderColor: '#263632',
    textStyle: { color: '#e6eee9', fontSize: 12 },
  },
  axisPointer: {
    lineStyle: { color: '#263632' },
    crossStyle: { color: '#263632' },
    label: { backgroundColor: '#16211f' },
  },
  splitLine: {
    lineStyle: { color: 'rgba(38, 54, 50, 0.6)' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#263632' } },
    axisTick: { lineStyle: { color: '#263632' } },
    axisLabel: { color: '#8fa29b', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(38, 54, 50, 0.4)' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#263632' } },
    axisTick: { lineStyle: { color: '#263632' } },
    axisLabel: { color: '#8fa29b', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(38, 54, 50, 0.4)' } },
  },
  logAxis: {
    axisLine: { lineStyle: { color: '#263632' } },
    axisTick: { lineStyle: { color: '#263632' } },
    axisLabel: { color: '#8fa29b', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(38, 54, 50, 0.4)' } },
  },
  timeAxis: {
    axisLine: { lineStyle: { color: '#263632' } },
    axisTick: { lineStyle: { color: '#263632' } },
    axisLabel: { color: '#8fa29b', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(38, 54, 50, 0.4)' } },
  },
  toolbox: {
    iconStyle: { borderColor: '#8fa29b' },
    emphasis: { iconStyle: { borderColor: '#4df0a0' } },
  },
  dataZoom: {
    backgroundColor: 'rgba(17, 25, 23, 0.6)',
    dataBackgroundColor: 'rgba(38, 54, 50, 0.6)',
    fillerColor: 'rgba(77, 240, 160, 0.12)',
    handleColor: '#4df0a0',
    handleSize: '80%',
    textStyle: { color: '#8fa29b' },
  },
  markPoint: {
    label: { color: '#e6eee9' },
  },
};

export default quantDarkTheme;
