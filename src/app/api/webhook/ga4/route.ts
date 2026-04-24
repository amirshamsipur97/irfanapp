import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // n8n sends: { source, generated_at, total_records, data: [...rows] }
  const rawRows: Record<string, unknown>[] = body?.data ?? (Array.isArray(body) ? body : [body])

  if (!rawRows.length) {
    return NextResponse.json({ error: 'No rows in payload' }, { status: 400 })
  }

  const rows = rawRows
    .filter(r => r.date)
    .map(r => ({
      date: String(r.date),
      country: String(r.country ?? 'Unknown'),
      city: String(r.city ?? 'Unknown'),
      page_location: String(r.page_location ?? ''),
      active_28_day_users: Number(r.active_28_day_users ?? 0),
      active_1_day_users: Number(r.active_1_day_users ?? 0),
      total_users: Number(r.total_users ?? 0),
      screen_page_views: Number(r.screen_page_views ?? 0),
      event_count: Number(r.event_count ?? 0),
      sessions_per_user: Number(r.sessions_per_user ?? 0),
      checkouts: Number(r.checkouts ?? 0),
      generate_lead_events: Number(r.generate_lead_events ?? 0),
    }))

  // Replace all data for the dates in this batch
  const dates = [...new Set(rows.map(r => r.date))]
  await analyticsDb.from('analytics_ga4').delete().in('date', dates)

  const { error } = await analyticsDb.from('analytics_ga4').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rows.length })
}
