import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * GA4 campaign-attributed data → analytics_ga4_campaign.
 *
 * Populated by n8n once the GA4 query requests campaign dimensions
 * (sessionCampaignName / sessionGoogleAdsCampaignId / sessionSource) plus
 * sessions + users + keyEvents. This is the GA4 side of the Ads<->GA4 join;
 * until that n8n change lands this endpoint simply has no data to receive.
 *
 * Expected payload (same envelope as the other webhooks):
 *   { source, generated_at, total_records, data: [
 *     { date, campaign_name, campaign_id, source, users, sessions, leads, conversions }
 *   ]}
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const rawRows: Record<string, unknown>[] = body?.data ?? (Array.isArray(body) ? body : [body])

  if (!rawRows.length) {
    return NextResponse.json({ error: 'No rows in payload' }, { status: 400 })
  }

  const rows = rawRows
    .filter(r => r.date)
    .map(r => ({
      date:          String(r.date),
      campaign_name: String(r.campaign_name ?? ''),
      campaign_id:   String(r.campaign_id ?? ''),
      source:        String(r.source ?? ''),
      users:         Number(r.users ?? 0),
      sessions:      Number(r.sessions ?? 0),
      leads:         Number(r.leads ?? r.generate_lead_events ?? 0),
      conversions:   Number(r.conversions ?? 0),
    }))

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid rows (missing date)' }, { status: 400 })
  }

  // Replace data for the dates present in this batch (idempotent re-sync).
  const dates = [...new Set(rows.map(r => r.date))]
  await analyticsDb.from('analytics_ga4_campaign').delete().in('date', dates)

  const { error } = await analyticsDb.from('analytics_ga4_campaign').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, count: rows.length })
}
