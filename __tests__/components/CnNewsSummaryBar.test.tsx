/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { CnNewsSummaryBar } from '@/components/cn-news/CnNewsSummaryBar';
import type { CnNewsApiResponse } from '@/lib/cn-news/types';

const data: CnNewsApiResponse = {
  updated_at: '2026-05-26T08:00:00.000Z',
  summary: { total: 4, positive: 2, negative: 1, high_confidence: 2 },
  cards: [],
};

describe('CnNewsSummaryBar', () => {
  it('renders all four summary stats', () => {
    render(<CnNewsSummaryBar data={data} />);
    expect(screen.getByText('活跃信号')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('正面信号')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('负面信号')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('高可信度')).toBeInTheDocument();
  });
});
