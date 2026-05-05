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
    // Clean string — returns null for empty, "undefined", "undefined undefined", "null"
    const JUNK = /^(undefined|null)(\s+(undefined|null))*$/i
    const str = (v: unknown): string | null => {
      if (v == null) return null
      const s = String(v).trim()
      if (!s || JUNK.test(s)) return null
      return s
    }
    const num  = (v: unknown) => (v != null && v !== '' ? Number(v) : null)

    // Validates a timestamp and returns a safe ISO string.
    // Rejects: null/empty, NaN dates, years outside 2000–2100.
    // Falls back to now() so Postgres never sees an invalid timestamptz.
    const safeDate = (v: unknown, fallbackToNow = true): string | null => {
      if (v == null || v === '') return fallbackToNow ? new Date().toISOString() : null
      const d = new Date(String(v))
      if (isNaN(d.getTime())) return fallbackToNow ? new Date().toISOString() : null
      const yr = d.getUTCFullYear()
      if (yr < 2000 || yr > 2100) return fallbackToNow ? new Date().toISOString() : null
      return d.toISOString()
    }
    // Try multiple field name variants — return first non-null value
    const pick = (...keys: unknown[]) => keys.map(k => str(k)).find(v => v != null) ?? null

    return {
      lead_id:                  pick(r.lead_id,   r.id,         r.row_id),
      source:                   pick(r.source,    bodySource),
      source_sheet:             pick(r.source_sheet, r.sheet_name, r.sheet),
      full_name:                pick(r.full_name, r.name,       r.fullName, r.full_Name,
                                     r.firstName != null && r.lastName != null
                                       ? `${r.firstName} ${r.lastName}`.trim() : null),
      email:                    pick(r.email,     r.Email,      r.email_address),
      phone:                    pick(r.phone,     r.phone_number, r.phoneNumber, r.Phone, r.mobile),
      country:                  pick(r.country,  r.Country),
      city:                     pick(r.city,     r.City),
      property_interest:        pick(r.property_interest, r.propertyInterest, r.property_type, r.propertyType),
      budget:                   pick(r.budget,   r.Budget),
      preferred_location:       pick(r.preferred_location, r.preferredLocation, r.location),
      message:                  pick(r.message,  r.notes, r.comments, r.inquiry),
      language:                 pick(r.language, r.lang),
      campaign_source:          pick(r.campaign_source, r.campaignSource),
      utm_source:               pick(r.utm_source,   r.utmSource),
      utm_medium:               pick(r.utm_medium,   r.utmMedium),
      utm_campaign:             pick(r.utm_campaign, r.utmCampaign),
      status:                   pick(r.status,   r.Status),
      lead_score:               num(r.lead_score   ?? r.leadScore   ?? r.score),
      lead_quality:             pick(r.lead_quality, r.leadQuality, r.quality),
      buyer_intent:             pick(r.buyer_intent, r.buyerIntent, r.intent),
      recommended_next_action:  pick(r.recommended_next_action, r.nextAction, r.next_action),
      short_summary:            str(r.short_summary ?? r.summary),
      suggested_email_reply:    str(r.suggested_email_reply ?? r.emailReply ?? r.suggested_reply),
      created_at:               safeDate(r.created_at ?? r.createdAt ?? r.date ?? r.timestamp),
      raw_data:                 r,
    }
  })

  // ── 4. Track date-cleaning stats ──────────────────────────────────────────
  let dateCleaned = 0
  rows.forEach((row, i) => {
    const raw = rawRows[i]
    const originalDate = raw?.created_at ?? raw?.createdAt ?? raw?.date ?? raw?.timestamp
    if (originalDate != null && originalDate !== '') {
      const d = new Date(String(originalDate))
      if (isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) {
        dateCleaned++
        console.warn(`[leads webhook] Invalid date cleaned for row ${i}: "${originalDate}" → now()`)
      }
    }
  })

  // ── 5. Insert into Supabase in batches of 100 ─────────────────────────────
  const BATCH = 100
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await analyticsDb.from('leads').insert(batch)
    if (error) {
      console.error(`[leads webhook] Supabase insert error (batch ${i}–${i + batch.length}):`, error.message)
      return NextResponse.json({
        success: false,
        error: `Database insert failed: ${error.message}`,
        inserted,
        failed: rows.length - inserted,
        dateCleaned,
      }, { status: 500 })
    }
    inserted += batch.length
  }

  console.log(`[leads webhook] ✅ Inserted ${inserted} leads (${dateCleaned} dates cleaned)`)
  return NextResponse.json({
    success: true,
    count: inserted,
    dateCleaned,
    ...(dateCleaned > 0 && { note: `${dateCleaned} record(s) had invalid created_at — replaced with current timestamp` }),
  })
}
