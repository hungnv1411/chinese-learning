import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkHealth } from '@/lib/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { status, body } = await checkHealth(() => getSql()`SELECT 1`);
  return NextResponse.json(body, { status });
}
