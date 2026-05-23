/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChartPageClient } from '@/components/chart/ChartPageClient';
import type { IndicatorCard, MarketNews } from '@/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('@/components/chart/KLineChart', () => ({
  KLineChart: ({ loading }: { loading: boolean }) => (
    <div data-testid="k-line-chart">{loading ? 'loading' : 'loaded'}</div>
  ),
}));

jest.mock('@/components/chart/NewsSection', () => ({
  NewsSection: ({ news }: { news: MarketNews[] }) => (
    <div data-testid="news-section">{news.length}</div>
  ),
}));

jest.mock('@/components/strategy/StrategySignalGrid', () => ({
  StrategySignalGrid: ({
    signals,
  }: {
    signals: { title: string }[];
  }) => (
    <div data-testid="strategy-signals">
      {signals.map(signal => signal.title).join(',')}
    </div>
  ),
}));

const indicator: IndicatorCard = {
  symbol: 'NDX',
  name: 'Nasdaq 100',
  trade_date: '2026-05-20',
  close: 19823.45,
  pct_change_1d: 0.82,
  pct_change_5d: 2.14,
  pct_change_20d: 4.37,
  ma20: 19421,
  ma60: 18930,
  ma250: 18100,
  ma500: 16540,
  ma1000: 13200,
  pct_from_ma500: 19.9,
  pct_from_ma1000: 50.2,
  drawdown_1y: -8.3,
  volume_ratio: 1.05,
  risk_level: 'low',
};

const chartResponse = {
  symbol: 'NDX',
  name: 'Nasdaq 100',
  candles: [],
  ma: [],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => chartResponse,
  }) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ChartPageClient', () => {
  it('fetches the default 3m chart data on mount', async () => {
    render(<ChartPageClient symbol="NDX" indicator={indicator} news={[]} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chart/NDX?range=3m', {
        cache: 'no-store',
      });
    });
  });

  it('refetches chart data when the range changes', async () => {
    render(<ChartPageClient symbol="NDX" indicator={indicator} news={[]} />);

    fireEvent.click(screen.getByRole('button', { name: '6M' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chart/NDX?range=6m', {
        cache: 'no-store',
      });
    });
  });

  it('shows a retry action when loading fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<ChartPageClient symbol="NDX" indicator={indicator} news={[]} />);

    expect(await screen.findByText('加载失败：HTTP 500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
  });

  it('renders strategy signals for the current indicator', async () => {
    render(<ChartPageClient symbol="NDX" indicator={indicator} news={[]} />);

    await waitFor(() => {
      expect(screen.getByTestId('strategy-signals')).toHaveTextContent(
        '趋势,回撤,风险,动作',
      );
    });
  });
});
