import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await analyticsDb
    .from('ga4_data')
    .select('*')
    .order('date', { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    lastUpdated: data?.[0]?.synced_at ?? null,
    rows: data ?? [],
  })
}
