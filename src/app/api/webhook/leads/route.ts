import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[leads webhook] Unauthorized — bad or missing x-webhook-secret')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (e) {
    console.error('[leads webhook] Invalid JSON body:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // n8n sends: { source, generated_at, total_records, data: [...rows] }
  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data)   ? (body.data as Record<string, unknown>[])
    : Array.isArray(body)       ? (body as Record<string, unknown>[])
    : [body]

  if (!rawRows.length) {
    console.warn('[leads webhook] Empty payload received')
    return NextResponse.json({ error: 'No rows in payload' }, { status: 400 })
  }

  const bodySource = typeof body?.source === 'string' ? body.source : 'n8n'

  console.log(`[leads webhook] Received ${rawRows.length} leads from source: ${bodySource}`)

  // ── 3. Map rows ───────────────────────────────────────────────────────────
  const rows = rawRows.map(r => {
    const str  = (v: unknown) => (v != null && v !== '' ? String(v) : null)
    const num  = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
    const date = (v: unknown) => {
      if (!v) return null
      const d = new Date(String(v))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }

    return {
      lead_id:                  str(r.lead_id   ?? r.id ?? r.row_id),
      source:                   str(r.source    ?? bodySource),
      source_sheet:             str(r.source_sheet ?? r.sheet_name ?? r.sheet),
      full_name:                str(r.full_name ?? r.name ?? r.fullName),
      email:                    str(r.email),
      phone:                    str(r.phone     ?? r.phone_number ?? r.phoneNumber),
      country:                  str(r.country),
      city:                     str(r.city),
      property_interest:        str(r.property_interest ?? r.propertyInterest ?? r.property_type),
      budget:                   str(r.budget),
      preferred_location:       str(r.preferred_location ?? r.preferredLocation ?? r.location),
      message:                  str(r.message   ?? r.notes ?? r.comments),
      language:                 str(r.language  ?? r.lang),
      campaign_source:          str(r.campaign_source ?? r.campaignSource),
      utm_source:               str(r.utm_source   ?? r.utmSource),
      utm_medium:               str(r.utm_medium   ?? r.utmMedium),
      utm_campaign:             str(r.utm_campaign ?? r.utmCampaign),
      status:                   str(r.status),
      lead_score:               num(r.lead_score   ?? r.leadScore   ?? r.score),
      lead_quality:             str(r.lead_quality ?? r.leadQuality ?? r.quality),
      buyer_intent:             str(r.buyer_intent ?? r.buyerIntent ?? r.intent),
      recommended_next_action:  str(r.recommended_next_action ?? r.nextAction ?? r.next_action),
      short_summary:            str(r.short_summary ?? r.summary),
      suggested_email_reply:    str(r.suggested_email_reply ?? r.emailReply ?? r.suggested_reply),
      created_at:               date(r.created_at ?? r.createdAt ?? r.date ?? r.timestamp),
      raw_data:                 r,
    }
  })

  // ── 4. Upsert into Supabase ───────────────────────────────────────────────
  // Insert in batches of 100 to stay within Supabase limits
  const BATCH = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await analyticsDb.from('leads').insert(batch)
    if (error) {
      console.error(`[leads webhook] Supabase insert error (batch ${i}–${i + batch.length}):`, error.message)
      return NextResponse.json(
        { error: `Database insert failed: ${error.message}` },
        { status: 500 }
      )
    }
    inserted += batch.length
  }

  console.log(`[leads webhook] ✅ Inserted ${inserted} leads successfully`)
  return NextResponse.json({ success: true, count: inserted })
}
