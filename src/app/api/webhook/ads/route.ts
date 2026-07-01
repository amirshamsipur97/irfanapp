import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * POST /api/webhook/ads
 *
 * Canonical Google Ads ingestion endpoint. Mirrors the existing
 * /api/webhook/google-ads route — accepts the same payload shape and writes
 * to the same `google_ads_campaign_data` table.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source : 'google_ads'

  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data) ? body.data as Record<string, unknown>[] :
    Array.isArray(body)       ? body as Record<string, unknown>[] :
    [body]

  // Empty payload is OK — return success with 0
  if (!rawRows.length) {
    return NextResponse.json({ success: true, source, total_records: 0 })
  }

  const rows = rawRows
    .filter(r => r.campaign_id)
    .map(r => ({
      date:                     String(r.date ?? 'DAILY'),
      campaign_id:              String(r.campaign_id ?? ''),
      campaign_name:            String(r.campaign_name ?? ''),
      campaign_status:          String(r.campaign_status ?? ''),
      clicks:                   Number(r.clicks ?? 0),
      impressions:              Number(r.impressions ?? 0),
      cost:                     Number(r.cost ?? 0),
      ctr:                      Number(r.ctr ?? 0),
      average_cpc:              Number(r.average_cpc ?? 0),
      average_cpm:              Number(r.average_cpm ?? 0),
      interaction_rate:         Number(r.interaction_rate ?? 0),
      video_views:              Number(r.video_views ?? 0),
      advertising_channel_type: String(r.advertising_channel_type ?? ''),
    }))

  if (!rows.length) {
    return NextResponse.json({ success: true, source, total_records: 0, note: 'No rows with campaign_id' })
  }

  const campaignIds = [...new Set(rows.map(r => r.campaign_id))]
  await analyticsDb.from('google_ads_campaign_data').delete().in('campaign_id', campaignIds)

  const { error } = await analyticsDb.from('google_ads_campaign_data').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, source, total_records: rows.length })
}
