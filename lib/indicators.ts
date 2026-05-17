import type { RiskLevel } from '@/types';

export function calcMA(closePrices: number[], period: number): number | null {
  if (closePrices.length < period) return null;
  const slice = closePrices.slice(-period);
  return slice.reduce((sum, p) => sum + p, 0) / period;
}

export function calcDrawdown1y(yearlyCloses: number[]): number | null {
  if (yearlyCloses.length === 0) return null;
  const high = Math.max(...yearlyCloses);
  const last = yearlyCloses[yearlyCloses.length - 1];
  return (last - high) / high;
}

export function calcVolumeRatio(todayVolume: number, ma20Volume: number): number | null {
  if (ma20Volume === 0) return null;
  return todayVolume / ma20Volume;
}

export function calcRiskLevel(params: {
  close: number;
  ma500: number | null;
  ma1000: number | null;
  drawdown1y: number | null;
}): RiskLevel {
  const { close, ma500, ma1000, drawdown1y } = params;
  if (ma1000 !== null && close < ma1000) return 'extreme';
  if (ma500 !== null && close < ma500) return 'high';
  if (drawdown1y !== null && drawdown1y < -0.15) return 'medium';
  return 'low';
}
