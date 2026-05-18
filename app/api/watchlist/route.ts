import { NextResponse } from 'next/server';
import { getWatchlistRows } from '@/lib/supabase/watchlist';
import { requireAdmin } from '@/lib/auth';
import type { Market } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const market = searchParams.get('market') as Market | null;
  try {
    const rows = await getWatchlistRows(market ?? undefined);
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[GET /api/watchlist]', err);
    return NextResponse.json({ error: 'Failed to load watchlist' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  let body: { symbol?: string; name?: string; market?: Market; asset_type?: string; category?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const symbol = body.symbol?.trim().toUpperCase();
  const market = body.market;
  const asset_type = body.asset_type;
  if (!symbol || !market || !asset_type) {
    return NextResponse.json({ error: 'symbol, market, asset_type are required' }, { status: 400 });
  }
  if (!['US', 'CN'].includes(market)) {
    return NextResponse.json({ error: 'market must be US or CN' }, { status: 400 });
  }
  if (!['index', 'etf', 'stock', 'sector'].includes(asset_type)) {
    return NextResponse.json({ error: 'invalid asset_type' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from('watchlist')
    .insert({
      symbol,
      name: body.name ?? null,
      market,
      asset_type,
      category: body.category ?? null,
      enabled: true,
    })
    .select()
    .single();

  if (error) {
    console.error('[POST /api/watchlist]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ row: data }, { status: 201 });
}
