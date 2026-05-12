import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * GET /api/calls
 *
 * Returns voice/call activity:
 *   - All leads that have any voice data (voice_source, call_status, vapi_call_id, or call_summary)
 *   - The call_attempts log for history
 *   - Aggregated stats for the Calls tab KPIs
 *
 * Query params:
 *   page         — default 1
 *   limit        — default 30, max 100
 *   voice_source — filter: inbound | outbound_campaign | manual
 *   call_status  — filter: initiated | completed | booked | not_interested | no_answer | failed
 *   search       — substring match on full_name/phone/email
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)))
  const voiceSource = searchParams.get('voice_source')
  const callStatus  = searchParams.get('call_status')
  const search      = searchParams.get('search')

  const from = (page - 1) * limit
  const to   = from + limit - 1

  // ── Main query: leads with ANY voice activity ────────────────────────────
  let q = analyticsDb.from('leads').select(`
    id, lead_id, full_name, email, phone, country, city,
    property_interest, budget, preferred_location, message,
    lead_quality, lead_score, buyer_intent,
    voice_source, call_status, call_attempt_count,
    last_called_at, next_call_at, vapi_call_id,
    call_summary, call_transcript, interest_status,
    appointment_requested, appointment_time, appointment_status,
    follow_up_priority, assigned_sales_manager,
    inserted_at, source_sheet
  `, { count: 'exact' })
    .or('voice_source.not.is.null,call_status.not.is.null,vapi_call_id.not.is.null,call_summary.not.is.null')

  if (voiceSource) q = q.eq('voice_source', voiceSource)
  if (callStatus)  q = q.eq('call_status', callStatus)
  if (search) {
    const s = search.replace(/[%_]/g, '\\$&')
    q = q.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%`)
  }

  q = q.order('last_called_at', { ascending: false, nullsFirst: false })
       .order('inserted_at',    { ascending: false })
       .range(from, to)

  const { data: calls, error: callsErr, count } = await q
  if (callsErr) {
    console.error('[api/calls] Error:', callsErr.message)
    return NextResponse.json({ error: callsErr.message }, { status: 500 })
  }

  // ── Stats query (separate, lightweight) ──────────────────────────────────
  const [{ data: statsRows }, { data: attemptsToday }] = await Promise.all([
    analyticsDb
      .from('leads')
      .select('voice_source, call_status, appointment_status, interest_status')
      .or('voice_source.not.is.null,call_status.not.is.null,vapi_call_id.not.is.null'),
    analyticsDb
      .from('call_attempts')
      .select('id, started_at, call_status', { count: 'exact' })
      .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1),
  ])

  const stats = {
    total:          statsRows?.length ?? 0,
    inbound:        statsRows?.filter(r => r.voice_source === 'inbound').length ?? 0,
    outbound:       statsRows?.filter(r => r.voice_source && r.voice_source !== 'inbound').length ?? 0,
    booked:         statsRows?.filter(r => r.call_status === 'booked' || r.appointment_status === 'confirmed').length ?? 0,
    interested:     statsRows?.filter(r => r.interest_status === 'interested').length ?? 0,
    not_interested: statsRows?.filter(r => r.interest_status === 'not_interested' || r.call_status === 'not_interested').length ?? 0,
    no_answer:      statsRows?.filter(r => r.call_status === 'no_answer' || r.call_status === 'failed').length ?? 0,
    attempts_24h:   attemptsToday?.length ?? 0,
  }

  return NextResponse.json({
    calls: calls ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
    stats,
  })
}
