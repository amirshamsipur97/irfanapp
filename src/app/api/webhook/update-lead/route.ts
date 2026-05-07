import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * POST /api/webhook/update-lead
 *
 * Updates a lead with call result data, typically called from the
 * Vapi Call Ended Webhook branch after extracting call data.
 *
 * Body (any subset):
 *   {
 *     lead_id?: string,                    // preferred match key
 *     vapi_call_id?: string,               // fallback match key
 *     call_status?: "completed" | "interested" | "not_interested" | "no_answer" | "failed" | "booked",
 *     interest_status?: "interested" | "not_interested" | "callback",
 *     call_summary?: string,
 *     call_transcript?: string,
 *     last_called_at?: ISO datetime,
 *     next_call_at?: ISO datetime,         // for retry pacing
 *     appointment_requested?: boolean,
 *     appointment_time?: ISO datetime,
 *     appointment_status?: "pending" | "confirmed" | "cancelled",
 *     budget?: string,
 *     preferred_location?: string,
 *     property_interest?: string,
 *     follow_up_priority?: "high" | "medium" | "low",
 *     assigned_sales_manager?: string,
 *   }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const lead_id      = (body.lead_id ?? body.leadId) as string | undefined
  const vapi_call_id = (body.vapi_call_id ?? body.call_id ?? body.callId) as string | undefined

  if (!lead_id && !vapi_call_id) {
    return NextResponse.json({ error: 'Must provide lead_id or vapi_call_id' }, { status: 400 })
  }

  // ── Build update payload (only valid columns) ────────────────────────────
  const allowedFields = [
    'call_status', 'interest_status', 'call_summary', 'call_transcript',
    'last_called_at', 'next_call_at', 'appointment_requested',
    'appointment_time', 'appointment_status', 'budget', 'preferred_location',
    'property_interest', 'follow_up_priority', 'assigned_sales_manager',
    'vapi_call_id', 'voice_source',
  ] as const

  const update: Record<string, unknown> = {}
  for (const k of allowedFields) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== '') update[k] = body[k]
  }

  // Auto-set retry cooldown based on call_status
  if (body.call_status === 'no_answer' || body.call_status === 'failed') {
    if (!update.next_call_at) {
      // 24h cooldown for retry
      update.next_call_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }
  }
  // If interested+booked, prevent further outbound calls
  if (body.interest_status === 'interested' && body.appointment_status === 'confirmed') {
    update.call_status = 'booked'
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  console.log(`[update-lead] Updating lead=${lead_id ?? '?'} call=${vapi_call_id ?? '?'} fields=${Object.keys(update).join(',')}`)

  // ── Update by lead_id first, fallback to vapi_call_id ────────────────────
  let updateQuery = analyticsDb.from('leads').update(update)
  if (lead_id) {
    updateQuery = updateQuery.eq('lead_id', lead_id)
  } else if (vapi_call_id) {
    updateQuery = updateQuery.eq('vapi_call_id', vapi_call_id)
  }

  const { data, error } = await updateQuery.select('id, lead_id, vapi_call_id, call_status, interest_status, appointment_status')

  if (error) {
    console.error('[update-lead] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    console.warn(`[update-lead] No lead found for lead_id=${lead_id} or vapi_call_id=${vapi_call_id}`)
    return NextResponse.json({
      success: false,
      error: 'Lead not found',
      searched: { lead_id, vapi_call_id },
    }, { status: 404 })
  }

  // ── Update the call_attempts log row too (best-effort) ───────────────────
  if (vapi_call_id) {
    await analyticsDb
      .from('call_attempts')
      .update({
        call_status: body.call_status as string ?? null,
        call_summary: body.call_summary as string ?? null,
        call_transcript: body.call_transcript as string ?? null,
        interest_status: body.interest_status as string ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq('vapi_call_id', vapi_call_id)
      .then(({ error: e }) => { if (e) console.error('[update-lead] call_attempts update:', e.message) })
  }

  return NextResponse.json({
    success: true,
    updated_count: data.length,
    leads: data,
  })
}
