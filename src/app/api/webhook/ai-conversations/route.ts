import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * POST /api/webhook/ai-conversations
 *
 * Stores ALL user conversations with the AI agent — including tests, general
 * questions, and exploratory messages. NOT every conversation is a lead.
 *
 * Qualified conversations are sent separately to /api/webhook/ai-qualified-leads
 * and land in the `leads` table.
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

  const source = typeof body.source === 'string' ? body.source : 'ai_conversations'

  const rawRows: Record<string, unknown>[] =
    Array.isArray(body?.data) ? body.data as Record<string, unknown>[] :
    Array.isArray(body)       ? body as Record<string, unknown>[] :
    [body]

  // Empty payload is OK
  if (!rawRows.length) {
    return NextResponse.json({ success: true, source, total_records: 0 })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  const JUNK = /^(undefined|null|#error!?)(\s+(undefined|null))*$/i
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
  const bool = (v: unknown) =>
    v === true || v === 1 || ['true', '1', 'yes', 'qualified'].includes(String(v ?? '').toLowerCase())
  const pick = (...keys: unknown[]) => keys.map(k => str(k)).find(v => v != null) ?? null

  const safeDate = (v: unknown): string => {
    if (v == null || v === '') return new Date().toISOString()
    const d = new Date(String(v))
    if (isNaN(d.getTime())) return new Date().toISOString()
    const yr = d.getUTCFullYear()
    if (yr < 2000 || yr > 2100) return new Date().toISOString()
    return d.toISOString()
  }

  // ── Map rows to ai_conversations schema ─────────────────────────────────
  const rows = rawRows.map((r, idx) => {
    const userName  = pick(r.user_name, r.name, r.full_name, r.fullName)
    const userEmail = pick(r.user_email, r.email, r.Email)
    const userPhone = pick(r.user_phone, r.phone, r.phone_number, r.mobile)
    const hasContact = Boolean(userEmail || userPhone)

    return {
      conversation_id:    pick(r.conversation_id, r.id, r.session_id) ?? `conv_${Date.now()}_${idx}`,
      session_id:         pick(r.session_id, r.sessionId, r.conversation_id) ?? '',
      user_message:       str(r.user_message ?? r.message ?? r.user_text),
      ai_response:        str(r.ai_response ?? r.response ?? r.ai_text),
      full_transcript:    Array.isArray(r.full_transcript) || (r.full_transcript && typeof r.full_transcript === 'object')
                            ? r.full_transcript : null,
      started_at:         safeDate(r.started_at ?? r.created_at ?? r.timestamp ?? r.date),
      last_at:            safeDate(r.last_at ?? r.ended_at ?? r.updated_at ?? r.started_at ?? r.created_at),
      message_count:      num(r.message_count) ?? 1,
      language:           pick(r.language, r.lang) ?? 'en',
      summary:            pick(r.summary, r.short_summary, r.conversation_summary),
      lead_score:         num(r.lead_score),
      lead_status:        pick(r.lead_status, r.lead_quality, r.status),
      intent:             pick(r.intent, r.user_intent),
      urgency:            pick(r.urgency, r.priority),
      project_interest:   pick(r.project_interest, r.mentioned_project, r.project),
      investment_intent:  pick(r.investment_intent, r.purpose),
      qualified:          bool(r.qualified ?? r.is_qualified),
      mentioned_developer: pick(r.mentioned_developer, r.developer),
      page_url:           pick(r.page_url, r.url),
      source:             pick(r.source) ?? 'ai_chat',
      utm_source:         pick(r.utm_source),
      utm_medium:         pick(r.utm_medium),
      utm_campaign:       pick(r.utm_campaign),
      duration_seconds:   num(r.duration_seconds ?? r.duration),
      has_contact_info:   hasContact,
      user_name:          userName,
      user_email:         userEmail,
      user_phone:         userPhone,
      raw_data:           r,
    }
  })

  // ── Upsert in batches (conversation_id is the UNIQUE key) ───────────────
  const BATCH = 100
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await analyticsDb
      .from('ai_conversations')
      .upsert(batch, { onConflict: 'conversation_id', ignoreDuplicates: false })
    if (error) {
      console.error(`[ai-conversations] Upsert error (batch ${i}):`, error.message)
      return NextResponse.json({ error: `Database upsert failed: ${error.message}` }, { status: 500 })
    }
    upserted += batch.length
  }

  console.log(`[ai-conversations] ✅ Stored ${upserted} conversations`)
  return NextResponse.json({ success: true, source, total_records: upserted })
}
