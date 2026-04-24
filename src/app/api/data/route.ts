import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await analyticsDb
    .from('analytics_ga4')
    .select('*')
    .order('date', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    lastUpdated: data?.[0]?.synced_at ?? null,
    rows: data ?? [],
  })
}
