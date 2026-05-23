import { createClient } from '@supabase/supabase-js';
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

function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder'),
  );
}

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

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
  if (!hasSupabaseConfig()) {
    return getSeedOpportunityData();
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('opportunity_decision')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data || data.length === 0) {
    return getSeedOpportunityData();
  }

  return getSeedOpportunityData();
}
