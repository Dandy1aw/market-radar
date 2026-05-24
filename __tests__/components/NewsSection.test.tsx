/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { NewsSection } from '@/components/chart/NewsSection';
import type { MarketNews } from '@/types';

const news: MarketNews[] = [
  {
    id: 1,
    symbol: 'NDX',
    title: 'Market closes higher',
    url: 'https://example.com/news',
    source: 'Example',
    published_at: '2026-05-20T12:00:00Z',
    summary: 'A brief market summary.',
    sentiment: 'positive',
    news_type: 'market',
    importance_score: 8,
    created_at: '2026-05-20T12:10:00Z',
  },
];

describe('NewsSection', () => {
  it('renders recent news items with links', () => {
    render(<NewsSection news={news} />);

    expect(screen.getByText('近期新闻')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Market closes higher' })).toHaveAttribute(
      'href',
      'https://example.com/news',
    );
    expect(screen.getByText('利好')).toBeInTheDocument();
  });

  it('renders nothing when there is no news', () => {
    const { container } = render(<NewsSection news={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
