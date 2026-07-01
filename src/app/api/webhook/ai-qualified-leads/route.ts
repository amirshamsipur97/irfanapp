import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * /api/webhook/ai-qualified-leads
 *
 * Receives leads that have ALREADY been qualified by an AI step in n8n.
 * Unlike /api/webhook/leads (which lets the dashboard or a downstream
 * scorer fill in lead_score / lead_quality / etc.), this endpoint
 * PRESERVES whatever scoring the upstream AI emitted — it never overwrites.
 *
 * Payload (from n8n):
 *   {
 *     source: "ai_qualified_leads",
 *     generated_at: string,
 *     total_records: number,
 *     data: array,
 *     has_qualified_leads: boolean
 *   }
 *
 * Response:
 *   { success: true, source: "ai_qualified_leads", total_records: number }
 */
export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.warn('[ai-qualified-leads] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (e) {
    console.error('[ai-qualified-leads] Invalid JSON:', e)
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source : 'ai_qualified_leads'
  const hasQualifiedLeads = body.has_qualified_leads === true

  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data) ? body.data as Record<string, unknown>[] :
    Array.isArray(body)       ? body as Record<string, unknown>[] :
    [body]

  console.log(`[ai-qualified-leads] Received ${rawRows.length} rows · has_qualified=${hasQualifiedLeads}`)

  // Empty payload is OK — n8n may pulse "no qualified leads this round"
  if (!rawRows.length) {
    return NextResponse.json({ success: true, source, total_records: 0 })
  }

  // ── 3. Helpers ───────────────────────────────────────────────────────────
  const JUNK = /^(undefined|null|#error!?|#ref!?|#name\?|#value!?)(\s+(undefined|null))*$/i
  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    if (!s || JUNK.test(s) || s.startsWith('#ERROR!')) return null
    return s
  }
  const num = (v: unknown) => {
    if (v == null || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const pick = (...keys: unknown[]) => keys.map(k => str(k)).find(v => v != null) ?? null
  const safeDate = (v: unknown): string => {
    if (v == null || v === '') return new Date().toISOString()
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return new Date().toISOString()
    const yr = d.getUTCFullYear()
    if (yr < 2000 || yr > 2100) return new Date().toISOString()
    return d.toISOString()
  }

  // ── 4. Map rows — preserve AI-assigned scoring fields ────────────────────
  const rows = rawRows.map(r => {
    // Optionally build a richer property_interest if the AI provided sub-fields
    const project      = str(r.project ?? r.Project)
    const developer    = str(r.developer ?? r.Developer)
    const propertyType = str(r.property_type ?? r.propertyType)
    const bedrooms     = str(r.bedrooms_size ?? r.bedrooms)
    const purpose      = str(r.purpose ?? r.Purpose)
    const composed     = [project, developer, propertyType, bedrooms ? `${bedrooms} bed` : null, purpose]
      .filter(Boolean).join(' · ') || null

    return {
      lead_id:                  pick(r.lead_id, r.id, r.row_id),
      source:                   pick(r.source) ?? source,
      source_sheet:             pick(r.source_sheet, r.sheet_name) ?? 'ai_qualified_leads',
      full_name:                pick(r.full_name, r.name, r.fullName, r.customer_name,
                                     r.firstName != null && r.lastName != null
                                       ? `${r.firstName} ${r.lastName}`.trim() : null),
      email:                    pick(r.email, r.Email, r.email_address),
      phone:                    pick(r.phone, r.phone_number, r.phoneNumber, r.Phone, r.mobile),
      country:                  pick(r.country, r.Country),
      city:                     pick(r.city, r.City),
      property_interest:        pick(r.property_interest, r.propertyInterest) ?? composed,
      budget:                   pick(r.budget, r.Budget),
      preferred_location:       pick(r.preferred_location, r.preferredLocation, r.location, project),
      message:                  pick(r.message, r.notes, r.special_requests, r.comments),
      language:                 pick(r.language, r.lang) ?? 'en',
      campaign_source:          pick(r.campaign_source, r.page_url),
      utm_source:               pick(r.utm_source, r.utmSource),
      utm_medium:               pick(r.utm_medium, r.utmMedium),
      utm_campaign:             pick(r.utm_campaign, r.utmCampaign),
      status:                   pick(r.status) ?? (hasQualifiedLeads ? 'qualified' : 'new'),
      // ── AI scoring fields — preserved exactly as upstream emitted ──
      lead_score:               num(r.lead_score ?? r.leadScore ?? r.score),
      lead_quality:             pick(r.lead_quality, r.leadQuality, r.quality),
      buyer_intent:             pick(r.buyer_intent, r.buyerIntent, r.intent),
      recommended_next_action:  pick(r.recommended_next_action, r.nextAction, r.next_action),
      short_summary:            str(r.short_summary ?? r.summary),
      suggested_email_reply:    str(r.suggested_email_reply ?? r.emailReply ?? r.suggested_reply),
      created_at:               safeDate(r.created_at ?? r.createdAt ?? r.timestamp ?? r.date),
      raw_data:                 r,
    }
  })

  // ── 5. Compute dedup_key (deterministic) ────────────────────────────────
  const crypto = await import('node:crypto')
  const contentHash = (...parts: (string | null)[]) =>
    crypto.createHash('sha1').update(parts.map(p => (p ?? '').trim().toLowerCase()).join('|')).digest('hex').slice(0, 12)

  type LeadRow = typeof rows[0] & { dedup_key: string }
  const rowsWithKey: LeadRow[] = rows.map(r => {
    let key: string
    if (r.email && r.email.trim()) key = 'E:' + r.email.trim().toLowerCase()
    else if (r.phone && r.phone.trim()) {
      const digits = r.phone.replace(/[^0-9]/g, '')
      key = digits.length >= 4 ? 'P:' + digits.slice(-8) : 'C:ai_qualified:' + contentHash(r.full_name, r.message, r.property_interest, r.budget)
    } else {
      key = 'C:ai_qualified:' + contentHash(r.full_name, r.message, r.property_interest, r.budget, r.country)
    }
    return { ...r, dedup_key: key }
  })

  // ── 6. Deduplicate within payload — prefer highest score / has quality ──
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
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const batch = uniqueRows.slice(i, i + BATCH)
    const { error } = await analyticsDb
      .from('leads')
      .upsert(batch, { onConflict: 'dedup_key', ignoreDuplicates: false })
    if (error) {
      console.error(`[ai-qualified-leads] Upsert error (batch ${i}):`, error.message)
      return NextResponse.json({ error: `Database upsert failed: ${error.message}` }, { status: 500 })
    }
  }

  console.log(`[ai-qualified-leads] ✅ Stored ${uniqueRows.length} qualified leads`)

  // ── 8. Response in the exact shape requested ────────────────────────────
  return NextResponse.json({
    success: true,
    source: 'ai_qualified_leads',
    total_records: uniqueRows.length,
  })
}
