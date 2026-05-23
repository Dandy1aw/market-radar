import { NextResponse } from 'next/server';
import {
  getOpportunityData,
  getSeedOpportunityData,
} from '@/lib/supabase/opportunity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await getOpportunityData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[/api/opportunity]', error);
    const data = getSeedOpportunityData();
    return NextResponse.json(data);
  }
}
