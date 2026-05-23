/**
 * @jest-environment jsdom
 */
import type { CSSProperties } from 'react';
import { render, screen } from '@testing-library/react';
import { KLineChart } from '@/components/chart/KLineChart';
import type { ChartApiResponse } from '@/types';

jest.mock('echarts-for-react', () => ({
  __esModule: true,
  default: ({
    option,
    style,
  }: {
    option?: { dataZoom?: { type?: string }[] };
    style?: CSSProperties;
  }) => (
    <div
      data-testid="echarts"
      data-has-slider={String(
        option?.dataZoom?.some(item => item.type === 'slider') ?? false,
      )}
      data-height={String(style?.height)}
      style={style}
    />
  ),
}));

const mockData: ChartApiResponse = {
  symbol: 'NDX',
  name: 'Nasdaq 100',
  candles: [
    {
      date: '2026-05-19',
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 1000000,
    },
    {
      date: '2026-05-20',
      open: 105,
      high: 115,
      low: 100,
      close: 110,
      volume: 1200000,
    },
  ],
  ma: [
    { date: '2026-05-19', ma20: 102, ma60: 99, ma250: 95 },
    { date: '2026-05-20', ma20: 103, ma60: 100, ma250: 96 },
  ],
};

describe('KLineChart', () => {
  it('renders ECharts when candle data is available', () => {
    render(<KLineChart data={mockData} loading={false} />);

    expect(screen.getByTestId('echarts')).toHaveAttribute('data-height', '500');
    expect(screen.getByTestId('echarts')).toHaveAttribute(
      'data-has-slider',
      'true',
    );
    expect(screen.getByLabelText('NDX K-line chart')).toBeInTheDocument();
  });

  it('supports compact mode with a custom height and no slider zoom', () => {
    render(
      <KLineChart
        data={mockData}
        loading={false}
        height={340}
        compact
      />,
    );

    expect(screen.getByTestId('echarts')).toHaveAttribute('data-height', '340');
    expect(screen.getByTestId('echarts')).toHaveAttribute(
      'data-has-slider',
      'false',
    );
  });

  it('shows a skeleton while loading', () => {
    render(<KLineChart data={null} loading />);

    expect(screen.queryByTestId('echarts')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows an empty state when no candles are available', () => {
    render(
      <KLineChart
        data={{ ...mockData, candles: [], ma: [] }}
        loading={false}
      />,
    );

    expect(screen.getByText('暂无 K 线数据')).toBeInTheDocument();
  });
});
