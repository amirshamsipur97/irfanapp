import { NextRequest, NextResponse } from 'next/server'
import { supabase, GA4Row } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // Handle all n8n send formats:
  // 1. Array of items: [{date,country,...}, ...]
  // 2. n8n wrapped: [{json: {date,...}}, ...]
  // 3. Aggregate output: {data: [{date,...}, ...]}
  // 4. Single item: {date, country, ...}
  let items: Record<string, unknown>[]

  if (Array.isArray(body)) {
    items = body
  } else if (body?.data && Array.isArray(body.data)) {
    items = body.data
  } else {
    items = [body]
  }

  const rows: GA4Row[] = items
    .map((item) => {
      const d = (item?.json ?? item) as Record<string, unknown>
      return {
        date: String(d.date ?? ''),
        country: String(d.country ?? d.Country ?? ''),
        city: String(d.city ?? d.City ?? ''),
        page_location: String(d.pageLocation ?? d.page_location ?? d.PageLocation ?? ''),
        active_28_day_users: Number(d.active28DayUsers ?? d.activeUsers ?? d.active_28_day_users ?? 0),
        checkouts: Number(d.checkouts ?? d.Checkouts ?? 0),
        page_views: Number(d.pageViews ?? d.screenPageViews ?? d.page_views ?? 0),
      }
    })
    .filter(r => r.date !== '')

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid rows parsed', received: body }, { status: 400 })
  }

  const dates = [...new Set(rows.map(r => r.date))]
  await supabase.from('ga4_analytics').delete().in('date', dates)

  const { error } = await supabase.from('ga4_analytics').insert(rows)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: rows.length })
}
