import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * /api/webhook/form-leads
 *
 * Accepts rich form-submission leads from the new "Form Property Database" sheet
 * (project, developer, purpose, property_type, bedrooms_size, timeline, etc.).
 *
 * Maps the rich fields into the existing `leads` table:
 *  - Standard fields go to their columns.
 *  - Property-specific fields are folded into property_interest / preferred_location
 *    so they show up in the dashboard, AND stored verbatim in raw_data for full fidelity.
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[form-leads] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (e) {
    console.error('[form-leads] Invalid JSON:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // n8n sends: { source, generated_at, total_records, data: [...rows] }
  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data) ? body.data as Record<string, unknown>[] :
    Array.isArray(body)       ? body as Record<string, unknown>[] :
    [body]

  const bodySource = typeof body?.source === 'string' ? body.source : 'form_leads'

  // Empty payload is OK — return success with 0
  if (!rawRows.length) {
    return NextResponse.json({ success: true, source: bodySource, total_records: 0 })
  }
  console.log(`[form-leads] Received ${rawRows.length} rows from source: ${bodySource}`)

  // ── 3. Helpers ───────────────────────────────────────────────────────────
  const JUNK = /^(undefined|null|#error!?|#ref!?|#name\?|#value!?)(\s+(undefined|null))*$/i
  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s || JUNK.test(s)) return null
    if (s.startsWith('#ERROR!')) return null
    return s
  }
  const num = (v: unknown) => (v != null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : null)
  const pick = (...keys: unknown[]) => keys.map(k => str(k)).find(v => v != null) ?? null

  const safeDate = (v: unknown): string => {
    if (v == null || v === '') return new Date().toISOString()
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return new Date().toISOString()
    const yr = d.getUTCFullYear()
    if (yr < 2000 || yr > 2100) return new Date().toISOString()
    return d.toISOString()
  }

  // ── 4. Map rows — combine rich property fields into the leads schema ────
  const rows = rawRows.map(r => {
    // Compose property_interest from the rich fields: "Project · Developer · PropertyType (Nbed) – Purpose"
    const project      = str(r.project ?? r.Project ?? r.development)
    const developer    = str(r.developer ?? r.Developer ?? r.builder)
    const propertyType = str(r.property_type ?? r.propertyType ?? r['Property Type'])
    const bedrooms     = str(r.bedrooms_size ?? r.bedrooms ?? r.bedroomSize ?? r['Bedrooms'])
    const purpose      = str(r.purpose ?? r.Purpose ?? r.usage)
    const timeline     = str(r.timeline ?? r.Timeline ?? r.timeframe)

    const propertyParts = [project, developer, propertyType, bedrooms ? `${bedrooms} bed` : null, purpose]
      .filter(Boolean)
    const property_interest = propertyParts.length ? propertyParts.join(' · ') : null

    return {
      lead_id:                  pick(r.lead_id, r.id, r.row_id),
      source:                   pick(r.source, bodySource),
      source_sheet:             pick(r.source_sheet, r.sheet_name, 'form_property_db'),
      full_name:                pick(r.full_name, r.name, r.fullName, r.customer_name,
                                     r.firstName != null && r.lastName != null
                                       ? `${r.firstName} ${r.lastName}`.trim() : null),
      email:                    pick(r.email, r.Email, r.email_address),
      phone:                    pick(r.phone, r.phone_number, r.phoneNumber, r.Phone, r.mobile),
      country:                  pick(r.country, r.Country, r.Nationality),
      city:                     pick(r.city, r.City),
      property_interest,
      budget:                   pick(r.budget, r.Budget, r.price_range),
      preferred_location:       pick(r.preferred_location, r.preferredLocation, r.location, project),
      message:                  pick(r.message, r.notes, r.special_requests, r.comments, r.inquiry, timeline ? `Timeline: ${timeline}` : null),
      language:                 pick(r.language, r.lang) ?? 'en',
      campaign_source:          pick(r.campaign_source, r.campaignSource, r.page_url),
      utm_source:               pick(r.utm_source, r.utmSource),
      utm_medium:               pick(r.utm_medium, r.utmMedium),
      utm_campaign:             pick(r.utm_campaign, r.utmCampaign),
      status:                   pick(r.status) ?? 'new',
      lead_score:               num(r.lead_score ?? r.leadScore ?? r.score),
      lead_quality:             pick(r.lead_quality, r.leadQuality, r.quality),
      buyer_intent:             pick(r.buyer_intent, r.buyerIntent, r.intent),
      recommended_next_action:  pick(r.recommended_next_action, r.nextAction),
      short_summary:            str(r.short_summary ?? r.summary),
      suggested_email_reply:    str(r.suggested_email_reply ?? r.emailReply),
      created_at:               safeDate(r.created_at ?? r.createdAt ?? r.timestamp ?? r.date),
      raw_data:                 r,
    }
  })

  // ── 5. Compute dedup_key ────────────────────────────────────────────────
  const crypto = await import('node:crypto')
  const contentHash = (...parts: (string | null)[]) =>
    crypto.createHash('sha1').update(parts.map(p => (p ?? '').trim().toLowerCase()).join('|')).digest('hex').slice(0, 12)

  type LeadRow = typeof rows[0] & { dedup_key: string }
  const rowsWithKey: LeadRow[] = rows.map(r => {
    let key: string
    if (r.email && r.email.trim()) key = 'E:' + r.email.trim().toLowerCase()
    else if (r.phone && r.phone.trim()) {
      const digits = r.phone.replace(/[^0-9]/g, '')
      key = digits.length >= 4 ? 'P:' + digits.slice(-8) : 'C:form_property_db:' + contentHash(r.full_name, r.message, r.property_interest, r.budget)
    } else {
      key = 'C:form_property_db:' + contentHash(r.full_name, r.message, r.property_interest, r.budget, r.country, r.city)
    }
    return { ...r, dedup_key: key }
  })

  // ── 6. Deduplicate within payload ────────────────────────────────────────
  const seen = new Map<string, LeadRow>()
  for (const row of rowsWithKey) {
    const existing = seen.get(row.dedup_key)
    if (!existing) { seen.set(row.dedup_key, row); continue }
    const existingHasQuality = existing.lead_quality && existing.lead_quality !== 'unknown'
    const newHasQuality      = row.lead_quality && row.lead_quality !== 'unknown'
    if (newHasQuality && !existingHasQuality) seen.set(row.dedup_key, row)
    else if (Number(row.lead_score ?? 0) > Number(existing.lead_score ?? 0)) seen.set(row.dedup_key, row)
  }
  const uniqueRows = Array.from(seen.values())

  // ── 7. Upsert in batches ────────────────────────────────────────────────
  const BATCH = 100
  let upserted = 0
  let skipped = rows.length - uniqueRows.length

  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const batch = uniqueRows.slice(i, i + BATCH)
    const { error } = await analyticsDb
      .from('leads')
      .upsert(batch, { onConflict: 'dedup_key', ignoreDuplicates: false })
    if (error) {
      console.error(`[form-leads] Supabase upsert error (batch ${i}):`, error.message)
      return NextResponse.json({ error: `Database upsert failed: ${error.message}` }, { status: 500 })
    }
    upserted += batch.length
  }

  console.log(`[form-leads] ✅ Upserted ${upserted} leads (${skipped} duplicates collapsed)`)
  return NextResponse.json({
    success: true,
    source: bodySource,
    total_records: upserted,
    duplicates_collapsed: skipped,
  })
}
