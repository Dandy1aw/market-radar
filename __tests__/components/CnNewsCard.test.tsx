/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { CnNewsCard } from '@/components/cn-news/CnNewsCard';
import type { CnNewsCardData } from '@/lib/cn-news/types';

const card: CnNewsCardData = {
  symbol: '688981',
  company_name: '中芯国际',
  theme: '半导体 / 国产替代',
  event_direction: 'positive',
  confidence_level: 'high',
  source_type: 'announcement',
  source_label: '巨潮资讯',
  event_type: '业绩快报',
  importance_score: 8.5,
  event_summary: '公司发布 Q1 业绩快报，营收同比增长 18%。',
  watch_points: ['板块是否持续放量'],
  risk_notes: ['单条公告不能单独触发买入判断'],
  evidence: ['2026-05-20 巨潮公告：中芯国际 Q1 业绩快报'],
  updated_at: '2026-05-26T08:00:00.000Z',
};

describe('CnNewsCard', () => {
  it('renders symbol, company name, and summary', () => {
    render(<CnNewsCard card={card} />);
    expect(screen.getByText('688981')).toBeInTheDocument();
    expect(screen.getByText('中芯国际')).toBeInTheDocument();
    expect(screen.getByText(/Q1 业绩快报/)).toBeInTheDocument();
  });

  it('shows direction and confidence badges', () => {
    render(<CnNewsCard card={card} />);
    expect(screen.getByText('正面信号')).toBeInTheDocument();
    expect(screen.getByText('公告')).toBeInTheDocument();
  });

  it('expands evidence on button click', () => {
    render(<CnNewsCard card={card} />);
    fireEvent.click(screen.getByRole('button', { name: /证据/ }));
    expect(screen.getByText(/中芯国际 Q1 业绩快报/)).toBeInTheDocument();
  });
});
