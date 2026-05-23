import {
  deriveDashboardStrategy,
  deriveIndicatorSignals,
} from '@/lib/strategy-signals';
import { mockDashboard } from '@/lib/mock-data';
import type { IndicatorCard } from '@/types';

const baseIndicator: IndicatorCard = {
  symbol: 'NDX',
  name: 'Nasdaq 100',
  trade_date: '2026-05-20',
  close: 100,
  pct_change_1d: 0.5,
  pct_change_5d: 1.2,
  pct_change_20d: 3.8,
  ma20: 98,
  ma60: 96,
  ma250: 90,
  ma500: 80,
  ma1000: 70,
  pct_from_ma500: 25,
  pct_from_ma1000: 42,
  drawdown_1y: -4,
  volume_ratio: 1.1,
  risk_level: 'low',
};

describe('deriveIndicatorSignals', () => {
  it('returns trend, pullback, risk, and action signals for a strong index', () => {
    const signals = deriveIndicatorSignals(baseIndicator);

    expect(signals.map(signal => signal.title)).toEqual([
      '趋势',
      '回撤',
      '风险',
      '动作',
    ]);
    expect(signals[0]).toMatchObject({
      value: '上升趋势',
      tone: 'positive',
    });
    expect(signals[3]).toMatchObject({
      value: '避免追高',
      tone: 'warning',
    });
  });

  it('recommends staged attention when the index is near MA500', () => {
    const signals = deriveIndicatorSignals({
      ...baseIndicator,
      pct_from_ma500: 3,
      drawdown_1y: -11,
    });

    expect(signals.find(signal => signal.title === '动作')).toMatchObject({
      value: '分批关注',
      tone: 'positive',
    });
  });

  it('recommends pausing adds for high risk symbols', () => {
    const signals = deriveIndicatorSignals({
      ...baseIndicator,
      risk_level: 'high',
    });

    expect(signals.find(signal => signal.title === '动作')).toMatchObject({
      value: '控制仓位',
      tone: 'negative',
    });
  });
});

describe('deriveDashboardStrategy', () => {
  it('summarizes a strong market as avoid chasing', () => {
    const summary = deriveDashboardStrategy(mockDashboard);

    expect(summary.title).toBe('今日操作建议');
    expect(summary.label).toBe('趋势偏强，避免追高');
    expect(summary.tone).toBe('warning');
  });

  it('warns when VIX is elevated', () => {
    const summary = deriveDashboardStrategy({
      ...mockDashboard,
      index_cards: mockDashboard.index_cards.map(card =>
        card.symbol === 'VIX' ? { ...card, close: 28 } : card,
      ),
    });

    expect(summary.label).toBe('风险升高，放慢节奏');
    expect(summary.tone).toBe('negative');
  });
});
