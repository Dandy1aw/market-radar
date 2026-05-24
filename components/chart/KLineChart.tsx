'use client';

import ReactECharts from 'echarts-for-react';
import type { ChartApiResponse } from '@/types';

interface KLineChartProps {
  data: ChartApiResponse | null;
  height?: number;
  loading: boolean;
  compact?: boolean;
}

const DEFAULT_CHART_HEIGHT = 500;

export function KLineChart({
  compact = false,
  data,
  height = DEFAULT_CHART_HEIGHT,
  loading,
}: KLineChartProps) {
  if (loading) {
    return (
      <div
        className="w-full rounded-lg bg-[var(--bg-subtle)] animate-pulse"
        style={{ height }}
        aria-label="Loading chart"
      />
    );
  }

  if (!data || data.candles.length === 0) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-lg border border-[var(--border)] text-sm text-[var(--muted)]"
        style={{ height }}
      >
        暂无 K 线数据
      </div>
    );
  }

  const dates = data.candles.map(candle => candle.date);
  const candleValues = data.candles.map(candle => [
    candle.open,
    candle.close,
    candle.low,
    candle.high,
  ]);
  const volumes = data.candles.map(candle => ({
    value: candle.volume,
    itemStyle: { color: candle.close >= candle.open ? '#ef4444' : '#22c55e' },
  }));

  const volumeGridTop = Math.max(height - (compact ? 70 : 110), 220);
  const volumeGridBottom = compact ? 22 : 60;
  const mainGridBottom = compact ? 82 : 150;
  const dataZoom = compact
    ? [{ type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 }]
    : [
        { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          bottom: 12,
          height: 28,
          borderColor: 'rgba(255,255,255,0.12)',
          fillerColor: 'rgba(99,102,241,0.18)',
          handleStyle: { color: '#6366f1' },
          textStyle: { color: '#9ca3af' },
        },
      ];

  const option = {
    backgroundColor: 'transparent',
    animation: false,
    legend: {
      data: ['MA20', 'MA60', 'MA250'],
      top: compact ? 0 : 4,
      right: 8,
      textStyle: { color: '#9ca3af' },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(17,17,24,0.96)',
      borderColor: 'rgba(255,255,255,0.12)',
      textStyle: { color: '#e8e8f0', fontSize: 12 },
    },
    grid: [
      { left: 8, right: 48, top: compact ? 34 : 40, bottom: mainGridBottom },
      { left: 8, right: 48, top: volumeGridTop, bottom: volumeGridBottom },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.14)' } },
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: dates,
        boundaryGap: false,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.14)' } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        position: 'right',
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      {
        scale: true,
        gridIndex: 1,
        position: 'right',
        axisLabel: { color: '#9ca3af', fontSize: 10 },
        splitLine: { show: false },
      },
    ],
    dataZoom,
    series: [
      {
        name: 'K Line',
        type: 'candlestick',
        data: candleValues,
        itemStyle: {
          color: '#ef4444',
          color0: '#22c55e',
          borderColor: '#ef4444',
          borderColor0: '#22c55e',
        },
      },
      {
        name: 'MA20',
        type: 'line',
        data: data.ma.map(item => item.ma20),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#818cf8', width: 1.5 },
      },
      {
        name: 'MA60',
        type: 'line',
        data: data.ma.map(item => item.ma60),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#fbbf24', width: 1.5 },
      },
      {
        name: 'MA250',
        type: 'line',
        data: data.ma.map(item => item.ma250),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#38bdf8', width: 1.5 },
      },
      {
        name: 'Volume',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
        barMaxWidth: compact ? 6 : 8,
      },
    ],
  };

  return (
    <div role="img" aria-label={`${data.symbol} K-line chart`}>
      <ReactECharts
        option={option}
        style={{ height, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
}
