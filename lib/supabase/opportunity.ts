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
import { getLatestOpportunityDecisionData } from './opportunity-ingestion';


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

export async function getOpportunityData(): Promise<OpportunityApiResponse> {
  const persisted = await getLatestOpportunityDecisionData();
  return persisted ?? getSeedOpportunityData();
}
