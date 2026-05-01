import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function GET() {
  const [ga4Result, adsResult] = await Promise.all([
    analyticsDb
      .from('analytics_ga4')
      .select('*')
      .order('date', { ascending: false })
      .limit(500),
    analyticsDb
      .from('google_ads_campaign_data')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(200),
  ])

  if (ga4Result.error) {
    return NextResponse.json({ error: ga4Result.error.message }, { status: 500 })
  }

  return NextResponse.json({
    lastUpdated: ga4Result.data?.[0]?.synced_at ?? null,
    rows: ga4Result.data ?? [],
    ads: adsResult.data ?? [],
  })
}
