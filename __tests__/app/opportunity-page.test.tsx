import OpportunityPage from '@/app/opportunity/page';
import { getOpportunityData } from '@/lib/supabase/opportunity';
import { OpportunitySummaryBar } from '@/components/opportunity/OpportunitySummaryBar';
import { OpportunityGroup } from '@/components/opportunity/OpportunityGroup';
import type { ReactElement } from 'react';

jest.mock('@/lib/supabase/opportunity', () => ({
  getOpportunityData: jest.fn(),
}));

jest.mock('@/components/opportunity/OpportunitySummaryBar', () => ({
  OpportunitySummaryBar: () => <div data-testid="opportunity-summary" />,
}));

jest.mock('@/components/opportunity/OpportunityGroup', () => ({
  OpportunityGroup: () => <div data-testid="opportunity-group" />,
}));

describe('OpportunityPage', () => {
  it('renders summary and grouped opportunity sections', async () => {
    (getOpportunityData as jest.Mock).mockResolvedValue({
      updated_at: '2026-05-23T08:00:00.000Z',
      summary: {
        total: 5,
        strong_watch: 1,
        pullback_candidate: 2,
        risk_high: 1,
      },
      groups: {
        strong_watch: [],
        pullback_candidate: [],
        risk_high: [],
        other: [],
      },
    });

    const page = (await OpportunityPage()) as ReactElement<{ children: ReactElement[] }>;
    const children = page.props.children;

    expect(children.some(child => child.type === OpportunitySummaryBar)).toBe(
      true,
    );
    expect(children.filter(child => child.type === OpportunityGroup).length).toBe(
      4,
    );
  });
});
