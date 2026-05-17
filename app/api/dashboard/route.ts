import { NextResponse } from 'next/server';
import { mockDashboard } from '@/lib/mock-data';

// M1: mock data, M2: Supabase
export async function GET() {
  return NextResponse.json(mockDashboard);
}
