import {
  mapDecisionRowsToOpportunityResponse,
  mapRawNewsForInsert,
} from '@/lib/supabase/opportunity-ingestion';
import { seedCompanyEvents, seedRawNews } from '@/lib/opportunity/seed';
import type { PersistedOpportunityDecision } from '@/lib/opportunity/types';

describe('opportunity ingestion supabase mapping', () => {
  it('maps raw news for database insert', () => {
    const row = mapRawNewsForInsert({
      ...seedRawNews[0],
      source_type: 'company_news',
      content: null,
      fetched_at: '2026-05-24T01:00:00.000Z',
      lang: 'en',
    });

    expect(row.hash).toBe(seedRawNews[0].hash);
    expect(row.raw_json).toEqual(seedRawNews[0].raw_json);
  });

  it('groups persisted decisions into OpportunityApiResponse', () => {
    const rows: PersistedOpportunityDecision[] = [
      {
        id: 1,
        symbol: 'MU',
        market: 'US',
        company_name: 'Micron Technology',
        asset_type: 'stock',
        theme: 'HBM / memory cycle',
        notes: null,
        decision_level: 'strong_watch',
        total_score: 75,
        news_score: 85,
        price_position_score: 55,
        context_signal_score: 78,
        risk_score: 42,
        summary: 'MU remains a strong watch.',
        watch_conditions: ['Confirm demand.'],
        risk_factors: ['Price risk.'],
        evidence_event_ids: [1],
        created_at: '2026-05-24T01:00:00.000Z',
      },
    ];

    const response = mapDecisionRowsToOpportunityResponse(
      rows,
      [seedCompanyEvents[0]],
      [seedRawNews[0]],
    );

    expect(response.summary.total).toBe(1);
    expect(response.groups.strong_watch[0].symbol).toBe('MU');
    expect(response.groups.strong_watch[0].evidence_events).toEqual([
      seedCompanyEvents[0],
    ]);
    expect(response.groups.strong_watch[0].evidence_news).toEqual([
      seedRawNews[0],
    ]);
  });
});
