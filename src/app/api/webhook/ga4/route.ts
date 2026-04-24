import { NextRequest, NextResponse } from 'next/server'
import { writeData, GA4Row } from '@/lib/storage'

// n8n sends data to POST /api/webhook/ga4
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()

  // n8n sends array of items, each with a "json" field
  const rows: GA4Row[] = (Array.isArray(body) ? body : [body]).map((item: Record<string, unknown>) => {
    const d = (item.json ?? item) as Record<string, unknown>
    return {
      date: String(d.date ?? ''),
      country: String(d.country ?? ''),
      city: String(d.city ?? ''),
      pageLocation: String(d.pageLocation ?? ''),
      active28DayUsers: Number(d.active28DayUsers ?? 0),
      checkouts: Number(d.checkouts ?? 0),
      pageViews: Number(d.pageViews ?? 0),
    }
  })

  writeData(rows)

  return NextResponse.json({ success: true, count: rows.length })
}
