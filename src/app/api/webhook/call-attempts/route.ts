import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * POST /api/webhook/call-attempts
 *
 * Records a new outbound call attempt and updates the lead's call tracking.
 * Called immediately after Vapi creates the outbound call (BEFORE call ends).
 *
 * Body:
 *   {
 *     lead_id: string,
 *     call_id (or vapi_call_id): string,
 *     phone: string,
 *     call_status: "initiated" | "ringing" | "in_progress" (default "initiated"),
 *     last_called_at: ISO datetime (default now),
 *     call_attempt_count: number (default existing+1),
 *     voice_source: "outbound_campaign" | "manual" (default "outbound_campaign")
 *   }
 *
 * Effects:
 *   1. Inserts a row in call_attempts table (audit log)
 *   2. Updates leads row by lead_id: sets vapi_call_id, call_status, last_called_at, call_attempt_count
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
  const phone        = (body.phone ?? '') as string
  const call_status  = (body.call_status ?? 'initiated') as string
  const voice_source = (body.voice_source ?? 'outbound_campaign') as string
  const lastCalledAt = (body.last_called_at ?? new Date().toISOString()) as string

  if (!lead_id) {
    return NextResponse.json({ error: 'Missing lead_id' }, { status: 400 })
  }

  console.log(`[call-attempts] Recording attempt for lead=${lead_id} call=${vapi_call_id} status=${call_status}`)

  // ── 1. Look up current lead to get attempt count ─────────────────────────
  const { data: existingLead } = await analyticsDb
    .from('leads')
    .select('id, call_attempt_count')
    .eq('lead_id', lead_id)
    .maybeSingle()

  const attemptNumber =
    typeof body.call_attempt_count === 'number'
      ? body.call_attempt_count
      : ((existingLead?.call_attempt_count ?? 0) + 1)

  // ── 2. Insert into call_attempts (audit log) ─────────────────────────────
  const { error: logErr } = await analyticsDb.from('call_attempts').insert({
    lead_id,
    vapi_call_id,
    phone,
    call_status,
    voice_source,
    attempt_number: attemptNumber,
    started_at: lastCalledAt,
    raw_data: body,
  })

  if (logErr) {
    console.error('[call-attempts] Log insert failed:', logErr.message)
    // Non-fatal, continue with lead update
  }

  // ── 3. Update lead's call tracking fields ────────────────────────────────
  if (existingLead) {
    const { error: updErr } = await analyticsDb
      .from('leads')
      .update({
        vapi_call_id,
        call_status,
        last_called_at: lastCalledAt,
        call_attempt_count: attemptNumber,
        voice_source,
      })
      .eq('lead_id', lead_id)

    if (updErr) {
      console.error('[call-attempts] Lead update failed:', updErr.message)
      return NextResponse.json({
        success: false,
        error: `Lead update failed: ${updErr.message}`,
      }, { status: 500 })
    }
  } else {
    console.warn(`[call-attempts] Lead with lead_id=${lead_id} not found — only attempt logged`)
  }

  return NextResponse.json({
    success: true,
    lead_id,
    vapi_call_id,
    attempt_number: attemptNumber,
    lead_updated: !!existingLead,
  })
}
