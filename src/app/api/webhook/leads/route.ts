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

  // ── 4. Compute dedup_key for each row (must match Supabase UNIQUE INDEX) ─
  const computeDedupKey = (email: string | null, phone: string | null): string | null => {
    if (email && email.trim()) return 'E:' + email.trim().toLowerCase()
    if (phone && phone.trim()) {
      const digits = phone.replace(/[^0-9]/g, '')
      if (digits.length >= 4) return 'P:' + digits.slice(-8)
    }
    return null  // No contact info — let DB insert without dedup
  }

  type LeadRow = typeof rows[0] & { dedup_key: string | null }
  const rowsWithKey: LeadRow[] = rows.map(r => ({
    ...r,
    dedup_key: computeDedupKey(r.email, r.phone),
  }))

  // Split: rows with dedup_key (upsert) vs rows without (plain insert)
  const withKey = rowsWithKey.filter(r => r.dedup_key !== null)
  const noKey   = rowsWithKey.filter(r => r.dedup_key === null)

  // ── 5. Track date-cleaning stats ──────────────────────────────────────────
  let dateCleaned = 0
  rows.forEach((row, i) => {
    const raw = rawRows[i]
    const originalDate = raw?.created_at ?? raw?.createdAt ?? raw?.date ?? raw?.timestamp
    if (originalDate != null && originalDate !== '') {
      const d = new Date(String(originalDate))
      if (isNaN(d.getTime()) || d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) {
        dateCleaned++
      }
    }
  })

  // ── 6. Deduplicate WITHIN payload (same key may appear from multiple sheets) ──
  const seen = new Map<string, LeadRow>()
  for (const row of withKey) {
    const existing = seen.get(row.dedup_key!)
    if (!existing) { seen.set(row.dedup_key!, row); continue }
    // Prefer row with quality data
    const existingHasQuality = existing.lead_quality && existing.lead_quality !== 'unknown'
    const newHasQuality      = row.lead_quality && row.lead_quality !== 'unknown'
    if (newHasQuality && !existingHasQuality) seen.set(row.dedup_key!, row)
    else if (newHasQuality === existingHasQuality && Number(row.lead_score ?? 0) > Number(existing.lead_score ?? 0)) {
      seen.set(row.dedup_key!, row)
    }
  }
  const dedupedWithKey = Array.from(seen.values())

  // ── 7. Upsert keyed rows + insert no-key rows ─────────────────────────────
  const BATCH = 100
  let upserted = 0
  let skipped  = 0

  for (let i = 0; i < dedupedWithKey.length; i += BATCH) {
    const batch = dedupedWithKey.slice(i, i + BATCH)
    const { error, count } = await analyticsDb
      .from('leads')
      .upsert(batch, { onConflict: 'dedup_key', ignoreDuplicates: false, count: 'exact' })
    if (error) {
      console.error('[leads webhook] Upsert error:', error.message)
      return NextResponse.json({
        success: false, error: `Database upsert failed: ${error.message}`,
        upserted, skipped, dateCleaned,
      }, { status: 500 })
    }
    upserted += count ?? batch.length
  }

  for (let i = 0; i < noKey.length; i += BATCH) {
    const batch = noKey.slice(i, i + BATCH)
    const { error } = await analyticsDb.from('leads').insert(batch)
    if (error) {
      console.error('[leads webhook] Insert no-contact error:', error.message)
      return NextResponse.json({
        success: false, error: `No-contact insert failed: ${error.message}`,
        upserted, dateCleaned,
      }, { status: 500 })
    }
    upserted += batch.length
  }

  skipped = withKey.length - dedupedWithKey.length

  console.log(`[leads webhook] ✅ Upserted=${upserted} | Skipped duplicates in payload=${skipped} | Date cleaned=${dateCleaned}`)
  return NextResponse.json({
    success: true,
    count: upserted,
    skipped,
    dateCleaned,
    received: rows.length,
    note: skipped > 0 ? `${skipped} duplicate(s) in payload merged into latest version` : undefined,
  })
}
