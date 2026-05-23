import {
  seedCompanyEvents,
  seedContext,
  seedCoreWatchlist,
  seedIndicators,
  seedRawNews,
} from '@/lib/opportunity/seed';
import {
  buildOpportunityCards,
  groupOpportunityCards,
} from '@/lib/opportunity/decision';
import type { OpportunityApiResponse } from '@/lib/opportunity/types';


export function getSeedOpportunityData(): OpportunityApiResponse {
  const cards = buildOpportunityCards({
    coreTargets: seedCoreWatchlist,
    context: seedContext,
    events: seedCompanyEvents,
    indicators: seedIndicators,
    rawNews: seedRawNews,
  });

  return groupOpportunityCards(cards);
}

// MVP always uses seed data. Supabase mapping will be added once the
// opportunity_decision table and ingestion pipeline exist.
export async function getOpportunityData(): Promise<OpportunityApiResponse> {
  return getSeedOpportunityData();
}
