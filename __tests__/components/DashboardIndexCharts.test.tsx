/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DashboardIndexCharts } from '@/components/dashboard/DashboardIndexCharts';
import type { ChartApiResponse } from '@/types';

jest.mock('@/components/chart/KLineChart', () => ({
  KLineChart: ({
    data,
    loading,
  }: {
    data: ChartApiResponse | null;
    loading: boolean;
  }) => (
    <div data-testid={`chart-${data?.symbol ?? 'loading'}`}>
      {loading ? 'loading' : data?.symbol}
    </div>
  ),
}));

function chart(symbol: string): ChartApiResponse {
  return {
    symbol,
    name: symbol,
    candles: [
      {
        date: '2026-05-20',
        open: 100,
        high: 110,
        low: 95,
        close: 105,
        volume: 1000000,
      },
    ],
    ma: [{ date: '2026-05-20', ma20: 102, ma60: 99, ma250: 95 }],
  };
}

beforeEach(() => {
  global.fetch = jest.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: async () => chart(url.includes('SPX') ? 'SPX' : 'NDX'),
    }),
  ) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DashboardIndexCharts', () => {
  it('loads Nasdaq 100 and S&P 500 charts on mount', async () => {
    render(<DashboardIndexCharts />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/chart/NDX?range=3m', {
        cache: 'no-store',
      });
      expect(global.fetch).toHaveBeenCalledWith('/api/chart/SPX?range=3m', {
        cache: 'no-store',
      });
    });

    expect(screen.getByText('纳指 K线')).toBeInTheDocument();
    expect(screen.getByText('标普500 K线')).toBeInTheDocument();
    expect(await screen.findByTestId('chart-NDX')).toBeInTheDocument();
    expect(await screen.findByTestId('chart-SPX')).toBeInTheDocument();
  });

  it('shows a retry action when either chart fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    render(<DashboardIndexCharts />);

    expect(await screen.findByText('K线加载失败：HTTP 500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });
});
