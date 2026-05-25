/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { buildOpportunityCards } from '@/lib/opportunity/decision';
import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import { OpportunityCard } from '@/components/opportunity/OpportunityCard';

const cards = buildOpportunityCards({
  coreTargets: seedCoreWatchlist,
  context: seedContext,
  events: seedCompanyEvents,
  indicators: seedIndicators,
  rawNews: seedRawNews,
});

describe('OpportunityCard', () => {
  it('renders decision label and scores', () => {
    const mu = cards.find(card => card.symbol === 'MU')!;

    render(<OpportunityCard card={mu} />);

    expect(screen.getByText('MU')).toBeInTheDocument();
    expect(screen.getByText(mu.decision_label)).toBeInTheDocument();
    expect(screen.getByText(/总分/)).toBeInTheDocument();
  });

  it('expands evidence and shows event summaries', () => {
    const mu = cards.find(card => card.symbol === 'MU')!;

    render(<OpportunityCard card={mu} />);
    fireEvent.click(screen.getByRole('button', { name: /证据/ }));

    expect(screen.getByText(/HBM demand remains strong/)).toBeInTheDocument();
  });
});
