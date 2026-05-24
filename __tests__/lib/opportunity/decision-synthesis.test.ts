import { synthesizeOpportunityDecision } from '@/lib/opportunity/decision-synthesis';
import { seedCoreWatchlist, seedIndicators } from '@/lib/opportunity/seed';
import type { OpportunityCompanyEvent } from '@/lib/opportunity/types';

const mockEvent: OpportunityCompanyEvent = {
  id: 1,
  symbol: 'MU',
  company_name: 'Micron Technology',
  theme: 'HBM / memory cycle',
  event_type: 'competition',
  event_direction: 'positive',
  importance_score: 78,
  event_summary: 'Samsung HBM delay tightens supply.',
  evidence_news_ids: [1],
  published_at: '2026-05-24T00:00:00Z',
  raw_payload: {
    positive_factors: ['Supply tightens near-term'],
    negative_factors: [],
    uncertainty: ['Certification timing unclear'],
  },
  created_at: '2026-05-24T00:00:00Z',
};

describe('synthesizeOpportunityDecision', () => {
  it('calls chat once and returns parsed watch_conditions and risk_factors', async () => {
    const chat = jest.fn().mockResolvedValue(JSON.stringify({
      watch_conditions: ['关注三星认证进展是否改变HBM供需格局'],
      risk_factors: ['20日已涨18%，短期获利了结压力大'],
    }));
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    const result = await synthesizeOpportunityDecision(
      { target: muTarget, events: [mockEvent], indicator: muIndicator },
      chat,
    );

    expect(chat).toHaveBeenCalledTimes(1);
    expect(result?.watch_conditions).toEqual(['关注三星认证进展是否改变HBM供需格局']);
    expect(result?.risk_factors).toEqual(['20日已涨18%，短期获利了结压力大']);
  });

  it('returns null when chat returns unparseable JSON', async () => {
    const chat = jest.fn().mockResolvedValue('not json at all ###');
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    const result = await synthesizeOpportunityDecision(
      { target: muTarget, events: [], indicator: muIndicator },
      chat,
    );

    expect(result).toBeNull();
  });

  it('prompt includes target symbol and event summary', async () => {
    const chat = jest.fn().mockResolvedValue(JSON.stringify({
      watch_conditions: ['条件'],
      risk_factors: ['风险'],
    }));
    const muTarget = seedCoreWatchlist.find(t => t.symbol === 'MU')!;
    const muIndicator = seedIndicators.find(i => i.symbol === 'MU')!;

    await synthesizeOpportunityDecision(
      { target: muTarget, events: [mockEvent], indicator: muIndicator },
      chat,
    );

    const promptContent: string = chat.mock.calls[0][0][0].content;
    expect(promptContent).toContain('MU');
    expect(promptContent).toContain('Samsung HBM delay tightens supply.');
  });
});
