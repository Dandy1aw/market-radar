import { NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/supabase/queries';
import { mockDashboard } from '@/lib/mock-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const hasSupabase =
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');

  if (!hasSupabase) {
    return NextResponse.json(mockDashboard);
  }

  try {
    const data = await getDashboardData();
    // If no real data yet (tables empty), fall back to mock
    if (data.index_cards.length === 0 && data.etf_cards.length === 0) {
      return NextResponse.json(mockDashboard);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/dashboard]', error);
    return NextResponse.json(mockDashboard);
  }
}
