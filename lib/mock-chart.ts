import { mockDashboard } from '@/lib/mock-data';
import type { ChartApiResponse, ChartCandle, IndicatorCard } from '@/types';

function getMockIndicator(symbol: string): IndicatorCard | undefined {
  return [...mockDashboard.index_cards, ...mockDashboard.etf_cards].find(
    card => card.symbol === symbol,
  );
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getMockChartData(
  symbol: string,
  limit: number,
): ChartApiResponse | null {
  const indicator = getMockIndicator(symbol);
  if (!indicator) return null;

  const endDate = new Date(`${indicator.trade_date}T00:00:00Z`);
  const candles: ChartCandle[] = Array.from({ length: limit }, (_, index) => {
    const daysFromEnd = limit - index - 1;
    const date = new Date(endDate);
    date.setUTCDate(endDate.getUTCDate() - daysFromEnd);

    const trend = 1 - daysFromEnd * 0.0018;
    const wave = Math.sin(index / 5) * 0.012;
    const close = indicator.close * (trend + wave);
    const open = close * (1 + Math.cos(index / 4) * 0.006);
    const high = Math.max(open, close) * 1.008;
    const low = Math.min(open, close) * 0.992;

    return {
      date: toDateString(date),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Math.round(900000 + index * 4500 + Math.abs(wave) * 2000000),
    };
  });

  return {
    symbol,
    name: indicator.name,
    candles,
    ma: candles.map((candle, index) => ({
      date: candle.date,
      ma20: movingAverage(candles, index, 20),
      ma60: movingAverage(candles, index, 60),
      ma250: movingAverage(candles, index, 250),
    })),
  };
}

export function getMockIndicatorCard(symbol: string) {
  return getMockIndicator(symbol) ?? null;
}

function movingAverage(candles: ChartCandle[], index: number, windowSize: number) {
  if (index + 1 < windowSize) return null;

  const window = candles.slice(index + 1 - windowSize, index + 1);
  const sum = window.reduce((total, candle) => total + candle.close, 0);
  return Number((sum / window.length).toFixed(2));
}
