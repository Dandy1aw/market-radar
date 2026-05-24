import { NextResponse } from 'next/server';
import { getChartData } from '@/lib/supabase/chart';
import { hasSupabaseConfig } from '@/lib/supabase/env';
import { getMockChartData } from '@/lib/mock-chart';

export const dynamic = 'force-dynamic';

const RANGE_LIMITS: Record<string, number> = {
  '3m': 63,
  '6m': 126,
  '1y': 252,
  '3y': 756,
};

export async function GET(
  req: Request,
  ctx: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') ?? '3m';
  const limit = RANGE_LIMITS[range];

  if (!limit) {
    return NextResponse.json(
      { error: 'range must be 3m, 6m, 1y, or 3y' },
      { status: 400 },
    );
  }

  const upperSymbol = symbol.toUpperCase();
  if (!hasSupabaseConfig()) {
    const mockData = getMockChartData(upperSymbol, limit);
    if (!mockData) {
      return NextResponse.json(
        { error: 'No data found for symbol' },
        { status: 404 },
      );
    }
    return NextResponse.json(mockData);
  }

  try {
    const data = await getChartData(upperSymbol, limit);
    if (!data) {
      return NextResponse.json(
        { error: 'No data found for symbol' },
        { status: 404 },
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/chart]', err);
    return NextResponse.json(
      { error: 'Failed to load chart data' },
      { status: 500 },
    );
  }
}
