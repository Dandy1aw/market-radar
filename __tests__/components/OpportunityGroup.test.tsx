/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { buildOpportunityCards } from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';

const cards = buildOpportunityCards({
  coreTargets: seedCoreWatchlist,
  context: seedContext,
  events: seedCompanyEvents,
  indicators: seedIndicators,
  rawNews: seedRawNews,
});

describe('OpportunityGroup', () => {
  it('renders cards in a group', () => {
    render(<OpportunityGroup groupKey="pullback-candidate" title="回调买入候选" cards={cards.slice(0, 2)} />);

    expect(screen.getByRole('heading', { name: '回调买入候选' })).toBeInTheDocument();
    expect(screen.getAllByText(/总分/).length).toBe(2);
  });

  it('renders a compact empty state', () => {
    render(<OpportunityGroup groupKey="risk-high" title="风险过高" cards={[]} />);

    expect(screen.getByText('暂无匹配标的')).toBeInTheDocument();
  });
});
