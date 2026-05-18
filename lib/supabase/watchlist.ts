import { createClient } from '@supabase/supabase-js';
import type { Market } from '@/types';

export interface WatchlistRow {
  id: number;
  symbol: string;
  name: string | null;
  market: Market;
  asset_type: 'index' | 'etf' | 'stock' | 'sector';
  category: string | null;
  enabled: boolean;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export function filterEnabledSymbols(rows: WatchlistRow[], market?: Market): WatchlistRow[] {
  return rows.filter(r => r.enabled && (market ? r.market === market : true));
}

export async function getWatchlistRows(market?: Market): Promise<WatchlistRow[]> {
  const supabase = adminClient();
  let query = supabase
    .from('watchlist')
    .select('id, symbol, name, market, asset_type, category, enabled')
    .order('market', { ascending: true })
    .order('asset_type', { ascending: true })
    .order('symbol', { ascending: true });
  if (market) query = query.eq('market', market);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as WatchlistRow[];
}

export async function getEnabledSymbols(market?: Market): Promise<string[]> {
  const rows = await getWatchlistRows(market);
  return filterEnabledSymbols(rows, market).map(r => r.symbol);
}
