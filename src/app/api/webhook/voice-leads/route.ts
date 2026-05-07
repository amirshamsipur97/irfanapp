import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * POST /api/webhook/voice-leads
 *
 * Receives leads originating from inbound Vapi voice calls.
 * Uses the same dedup_key strategy as the regular leads webhook so a
 * caller who already exists in the CRM is updated rather than duplicated.
 *
 * Body shape (single lead, from "Prepare Inbound Lead Data" node in n8n):
 *   {
 *     lead_id: string,
 *     full_name, email, phone, country, city,
 *     property_interest, budget, preferred_location, message,
 *     call_transcript, call_summary, call_status,
 *     phone_valid, voice_source: "inbound",
 *     appointment_requested, appointment_time, appointment_status,
 *     ...
 *   }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // Accept both single object and { data: [...] } envelope
  const items: Record<string, unknown>[] =
    Array.isArray(body?.data) ? (body.data as Record<string, unknown>[])
    : Array.isArray(body)     ? (body as Record<string, unknown>[])
    : [body]

  if (!items.length) {
    return NextResponse.json({ error: 'Empty payload' }, { status: 400 })
  }

  const JUNK = /^(undefined|null)(\s+(undefined|null))*$/i
  const str = (v: unknown): string | null => {
    if (v == null) return null
    const s = String(v).trim()
    return !s || JUNK.test(s) ? null : s
  }
  const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
  const bool = (v: unknown) => v === true || v === 'true' || v === 1 ? true : v === false || v === 'false' || v === 0 ? false : null
  const safeDate = (v: unknown) => {
    if (v == null || v === '') return null
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return null
    const yr = d.getUTCFullYear()
    return (yr < 2000 || yr > 2100) ? null : d.toISOString()
  }
  const computeDedupKey = (email: string | null, phone: string | null): string | null => {
    if (email && email.trim()) return 'E:' + email.trim().toLowerCase()
    if (phone && phone.trim()) {
      const digits = phone.replace(/[^0-9]/g, '')
      if (digits.length >= 4) return 'P:' + digits.slice(-8)
    }
    return null
  }

  const rows = items.map(r => {
    const email = str(r.email ?? r.Email ?? r.email_address)
    const phone = str(r.phone ?? r.phone_number ?? r.Phone ?? r.mobile)
    const dedup_key = computeDedupKey(email, phone) ?? `N:voice_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    const phoneDigits = phone ? phone.replace(/[^0-9]/g, '') : ''

    return {
      lead_id:                  str(r.lead_id ?? r.id) ?? `voice_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      dedup_key,
      source:                   'vapi_inbound_call',
      source_sheet:             str(r.source_sheet) ?? 'vapi_inbound_call',
      voice_source:             str(r.voice_source) ?? 'inbound',
      full_name:                str(r.full_name ?? r.name),
      email,
      phone,
      country:                  str(r.country),
      city:                     str(r.city),
      property_interest:        str(r.property_interest),
      budget:                   str(r.budget),
      preferred_location:       str(r.preferred_location),
      message:                  str(r.message),
      language:                 str(r.language) ?? 'en',
      lead_score:               num(r.lead_score),
      lead_quality:             str(r.lead_quality),
      buyer_intent:             str(r.buyer_intent),
      recommended_next_action:  str(r.recommended_next_action),
      short_summary:            str(r.short_summary ?? r.call_summary),
      suggested_email_reply:    str(r.suggested_email_reply),
      call_transcript:          str(r.call_transcript),
      call_summary:             str(r.call_summary),
      call_status:              str(r.call_status) ?? 'completed',
      phone_valid:              bool(r.phone_valid) ?? phoneDigits.length >= 8,
      appointment_requested:    bool(r.appointment_requested) ?? false,
      appointment_time:         safeDate(r.appointment_time),
      appointment_status:       str(r.appointment_status),
      status:                   str(r.status) ?? 'new',
      created_at:               safeDate(r.created_at) ?? new Date().toISOString(),
      raw_data:                 r,
    }
  })

  console.log(`[voice-leads] Upserting ${rows.length} inbound voice lead(s)`)

  // ── Upsert by dedup_key — preserves history if same person calls again ──
  const { error, count } = await analyticsDb
    .from('leads')
    .upsert(rows, { onConflict: 'dedup_key', count: 'exact' })

  if (error) {
    console.error('[voice-leads] Upsert error:', error.message)
    return NextResponse.json({
      success: false,
      error: `Database upsert failed: ${error.message}`,
    }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    count: count ?? rows.length,
    received: items.length,
  })
}
