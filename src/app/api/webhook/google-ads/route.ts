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
    return NextResponse.json({ error: 'No valid campaign rows (missing campaign_id)' }, { status: 400 })
  }

  // Replace data for all campaign_ids present in this batch
  const campaignIds = [...new Set(rows.map(r => r.campaign_id))]
  await analyticsDb.from('google_ads_campaign_data').delete().in('campaign_id', campaignIds)

  const { error } = await analyticsDb.from('google_ads_campaign_data').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rows.length })
}
