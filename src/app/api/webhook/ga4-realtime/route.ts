import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // ── Auth ──
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Parse body ──
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // n8n sends: { source, generated_at, data: [...rows] }
  // Each row from GA4 Realtime API has: city, country, activeUsers, screenPageViews,
  // unifiedPagePathScreen (or pagePath), deviceCategory, source
  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data) ? body.data as Record<string, unknown>[] :
    Array.isArray(body)       ? body as Record<string, unknown>[] :
    [body]

  const source = typeof body.source === 'string' ? body.source : 'google_analytics_4_realtime'

  // Empty payload is OK — return success with 0 (matches other webhook endpoints)
  if (!rawRows.length) {
    return NextResponse.json({ success: true, source, total_records: 0 })
  }

  const str = (v: unknown, fb = 'Unknown') => {
    if (v == null) return fb
    const s = String(v).trim()
    return s || fb
  }
  const num = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const rows = rawRows.map(r => ({
    country:      str(r.country ?? r.Country),
    city:         str(r.city ?? r.City),
    page_path:    str(r.page_path ?? r.pagePath ?? r.unifiedPagePathScreen ?? r.pageLocation ?? '', '') || null,
    device:       str(r.device ?? r.deviceCategory ?? '', '') || null,
    source:       str(r.source ?? r.firstUserSource ?? r.sessionSource ?? '', '') || null,
    active_users: num(r.active_users ?? r.activeUsers ?? r.users),
    views_30min:  num(r.views_30min ?? r.screenPageViews ?? r.pageViews),
  }))

  // Realtime is a SNAPSHOT — wipe old and insert fresh
  await analyticsDb.from('analytics_ga4_realtime').delete().gte('id', 0)

  const { error } = await analyticsDb.from('analytics_ga4_realtime').insert(rows)
  if (error) {
    console.error('[ga4-realtime] insert error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: rows.length, synced_at: new Date().toISOString() })
}
