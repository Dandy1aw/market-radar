import { createClient } from '@supabase/supabase-js';
import type { ChartApiResponse, ChartCandle, ChartMa } from '@/types';

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function toNullableNumber(value: unknown): number | null {
  return value != null ? Number(value) : null;
}

export async function getChartData(
  symbol: string,
  limit: number,
): Promise<ChartApiResponse | null> {
  const supabase = createAdminClient();

  const [priceRes, watchlistRes] = await Promise.all([
    supabase
      .from('market_price_daily')
      .select('trade_date, open, high, low, close, volume')
      .eq('symbol', symbol)
      .order('trade_date', { ascending: false })
      .limit(limit),
    supabase
      .from('watchlist')
      .select('name')
      .eq('symbol', symbol)
      .maybeSingle(),
  ]);

  if (priceRes.error) throw priceRes.error;
  if (!priceRes.data || priceRes.data.length === 0) return null;

  const priceRows = priceRes.data as Record<string, unknown>[];
  const dates = priceRows.map(row => row.trade_date as string);

  const maRes = await supabase
    .from('market_indicator_daily')
    .select('trade_date, ma20, ma60, ma250')
    .eq('symbol', symbol)
    .in('trade_date', dates);

  if (maRes.error) throw maRes.error;

  const maByDate = Object.fromEntries(
    ((maRes.data ?? []) as Record<string, unknown>[]).map(row => [
      row.trade_date,
      row,
    ]),
  );
  const sortedRows = [...priceRows].reverse();

  const candles: ChartCandle[] = sortedRows.map(row => ({
    date: row.trade_date as string,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  }));

  const ma: ChartMa[] = sortedRows.map(row => {
    const maRow = maByDate[row.trade_date as string] as
      | Record<string, unknown>
      | undefined;

    return {
      date: row.trade_date as string,
      ma20: toNullableNumber(maRow?.ma20),
      ma60: toNullableNumber(maRow?.ma60),
      ma250: toNullableNumber(maRow?.ma250),
    };
  });

  const watchlistRow = watchlistRes.data as { name?: string } | null;

  return {
    symbol,
    name: watchlistRow?.name ?? symbol,
    candles,
    ma,
  };
}
