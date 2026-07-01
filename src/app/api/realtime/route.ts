import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

interface Ga4Row {
  date: string
  country: string | null
  city: string | null
  page_location: string | null
  active_1_day_users: number | null
  active_28_day_users: number | null
  screen_page_views: number | null
  page_views: number | null
}

export async function GET() {
  // ── 1. Try true realtime first ─────────────────────────────────────────
  const rtRes = await analyticsDb
    .from('analytics_ga4_realtime')
    .select('*')
    .order('active_users', { ascending: false })
    .limit(500)

  const rows = rtRes.data ?? []

  if (rows.length > 0) {
    // Real realtime data exists — return as before
    const totalActive = rows.reduce((s, r) => s + (r.active_users ?? 0), 0)
    const totalViews  = rows.reduce((s, r) => s + (r.views_30min ?? 0), 0)
    const syncedAt    = rows[0]?.synced_at ?? null

    const byCountry = Object.values(
      rows.reduce((acc: Record<string, { country: string; active_users: number; cities: Set<string> }>, r) => {
        const key = r.country || 'Unknown'
        if (!acc[key]) acc[key] = { country: key, active_users: 0, cities: new Set() }
        acc[key].active_users += r.active_users ?? 0
        if (r.city && r.city !== 'Unknown') acc[key].cities.add(r.city)
        return acc
      }, {})
    ).map(c => ({ country: c.country, active_users: c.active_users, city_count: c.cities.size }))
     .sort((a, b) => b.active_users - a.active_users)

    const byCity = Object.values(
      rows.reduce((acc: Record<string, { city: string; country: string; active_users: number; views: number }>, r) => {
        const key = `${r.country}|${r.city}`
        if (!acc[key]) acc[key] = { city: r.city || 'Unknown', country: r.country || 'Unknown', active_users: 0, views: 0 }
        acc[key].active_users += r.active_users ?? 0
        acc[key].views        += r.views_30min ?? 0
        return acc
      }, {})
    ).sort((a, b) => b.active_users - a.active_users)

    return NextResponse.json({
      mode: 'live',
      syncedAt,
      totalActive,
      totalViews,
      byCountry,
      byCity,
      raw: rows,
    })
  }

  // ── 2. Fallback — use today's GA4 daily data as approximate "recent" ──
  // active_1_day_users gives a near-realtime signal even if the realtime
  // pipeline isn't wired up yet.
  const today = new Date().toISOString().slice(0, 10)
  const yest  = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const dailyRes = await analyticsDb
    .from('analytics_ga4')
    .select('date, country, city, page_location, active_1_day_users, active_28_day_users, screen_page_views, page_views')
    .gte('date', yest)
    .order('date', { ascending: false })
    .limit(200)

  const dailyRows = (dailyRes.data ?? []) as Ga4Row[]
  // Prefer today's rows; if none, fall back to yesterday
  const todayRows = dailyRows.filter(r => r.date === today)
  const useRows   = todayRows.length > 0 ? todayRows : dailyRows.filter(r => r.date === yest)
  const dateUsed  = todayRows.length > 0 ? today : yest

  if (useRows.length === 0) {
    return NextResponse.json({
      mode: 'empty',
      syncedAt: null,
      totalActive: 0,
      totalViews: 0,
      byCountry: [],
      byCity: [],
      raw: [],
      note: 'No GA4 data available — connect n8n GA4 ingestion or set up GA4 Realtime API.',
    })
  }

  // Aggregate fallback (using active_1_day_users as "active")
  const totalActive = useRows.reduce((s, r) => s + (r.active_1_day_users ?? 0), 0)
  const totalViews  = useRows.reduce((s, r) => s + (r.screen_page_views ?? r.page_views ?? 0), 0)

  const byCountry = Object.values(
    useRows.reduce((acc: Record<string, { country: string; active_users: number; cities: Set<string> }>, r) => {
      const key = r.country || 'Unknown'
      if (!acc[key]) acc[key] = { country: key, active_users: 0, cities: new Set() }
      acc[key].active_users += r.active_1_day_users ?? 0
      if (r.city && r.city !== 'Unknown') acc[key].cities.add(r.city)
      return acc
    }, {})
  ).map(c => ({ country: c.country, active_users: c.active_users, city_count: c.cities.size }))
   .sort((a, b) => b.active_users - a.active_users)
   .filter(c => c.active_users > 0)

  const byCity = Object.values(
    useRows.reduce((acc: Record<string, { city: string; country: string; active_users: number; views: number }>, r) => {
      const key = `${r.country}|${r.city}`
      if (!acc[key]) acc[key] = { city: r.city || 'Unknown', country: r.country || 'Unknown', active_users: 0, views: 0 }
      acc[key].active_users += r.active_1_day_users ?? 0
      acc[key].views        += r.screen_page_views ?? r.page_views ?? 0
      return acc
    }, {})
  ).sort((a, b) => b.active_users - a.active_users)
   .filter(c => c.active_users > 0)

  return NextResponse.json({
    mode: 'fallback_daily',
    syncedAt: dateUsed + 'T00:00:00Z',
    fallbackDate: dateUsed,
    totalActive,
    totalViews,
    byCountry,
    byCity,
    raw: [],
    note: dateUsed === today
      ? "Showing today's GA4 daily approximation — set up realtime pipeline for live data"
      : "Showing yesterday's GA4 data — today's sync hasn't run yet",
  })
}
