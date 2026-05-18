/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { IndexCard } from '@/components/dashboard/IndexCard';
import type { IndicatorCard } from '@/types';

const mockCard: IndicatorCard = {
  symbol: 'NDX', name: '纳斯达克100', trade_date: '2026-05-17',
  close: 19823.45, pct_change_1d: 0.82, pct_change_5d: 2.14, pct_change_20d: 4.37,
  ma20: 19421.0, ma60: 18930.0, ma250: 18100.0, ma500: 16540.0, ma1000: 13200.0,
  pct_from_ma500: 19.9, pct_from_ma1000: 50.2,
  drawdown_1y: -8.3, volume_ratio: 1.05, risk_level: 'low',
};

describe('IndexCard', () => {
  it('renders symbol and name', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('NDX')).toBeInTheDocument();
    expect(screen.getByText('纳斯达克100')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('19,823.45')).toBeInTheDocument();
  });

  it('renders positive pct_change_1d with + prefix', () => {
    render(<IndexCard data={mockCard} />);
    expect(screen.getByText('+0.82%')).toBeInTheDocument();
  });
});
