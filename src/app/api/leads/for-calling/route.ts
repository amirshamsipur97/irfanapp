import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * GET /api/leads/for-calling
 *
 * Returns leads that are eligible for outbound calling, with safety filters:
 *   - Has valid phone number (>=8 digits)
 *   - call_attempt_count < max_attempts (default 3)
 *   - call_status NOT IN (booked, not_interested, do_not_call)
 *   - lead_quality NOT IN (invalid)
 *   - next_call_at IS NULL OR <= now (cooldown respected)
 *
 * Query params:
 *   limit          — max records (default 10, cap 50)
 *   max_attempts   — call_attempt_count cap (default 3)
 *   quality        — comma-separated qualities to include (default: hot,high,warm,cold)
 *   country        — filter by country (substring)
 *   exclude_status — comma-separated call_status to skip (default: booked,not_interested,do_not_call)
 *   business_hours — if "1", only return leads when current time is in Oman business hours (Sun-Thu, 9:00-18:00 GMT+4)
 */
export async function GET(req: NextRequest) {
  // Webhook secret optional but recommended
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.WEBHOOK_SECRET && secret && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const limit         = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)))
  const maxAttempts   = Math.max(1, parseInt(searchParams.get('max_attempts') ?? '3', 10))
  const qualityList   = (searchParams.get('quality') ?? 'hot,high,warm,cold')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  const country       = searchParams.get('country')
  const excludeStatus = (searchParams.get('exclude_status') ?? 'booked,not_interested,do_not_call')
    .split(',').map(s => s.trim()).filter(Boolean)
  const businessHoursOnly = searchParams.get('business_hours') === '1'

  // ── Oman business hours check (GMT+4, Sun-Thu, 9:00-18:00) ───────────────
  if (businessHoursOnly) {
    const now = new Date()
    const omanHour = (now.getUTCHours() + 4) % 24
    const omanDay  = now.getUTCDay()  // 0=Sun, 6=Sat
    const isWorkDay = omanDay >= 0 && omanDay <= 4  // Sun-Thu
    const isWorkHour = omanHour >= 9 && omanHour < 18
    if (!isWorkDay || !isWorkHour) {
      return NextResponse.json({
        success: true,
        outside_business_hours: true,
        oman_time: `${omanHour}:${String(now.getUTCMinutes()).padStart(2,'0')}`,
        oman_day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][omanDay],
        leads: [],
        count: 0,
      })
    }
  }

  // ── Build query ──────────────────────────────────────────────────────────
  let query = analyticsDb.from('leads').select(`
    id, lead_id, dedup_key, full_name, email, phone, country, city,
    property_interest, budget, preferred_location, message,
    lead_quality, lead_score, buyer_intent, status,
    call_status, call_attempt_count, last_called_at, next_call_at,
    vapi_call_id, voice_source, phone_valid, recommended_next_action
  `)
    .eq('phone_valid', true)
    .lt('call_attempt_count', maxAttempts)
    .neq('lead_quality', 'invalid')

  if (qualityList.length > 0) {
    query = query.in('lead_quality', qualityList)
  }
  if (excludeStatus.length > 0) {
    // Need OR: call_status IS NULL OR NOT IN (excludeStatus)
    query = query.or(
      `call_status.is.null,call_status.not.in.(${excludeStatus.join(',')})`
    )
  }
  if (country) {
    query = query.ilike('country', `%${country}%`)
  }
  // Cooldown: next_call_at IS NULL OR <= now
  query = query.or(
    `next_call_at.is.null,next_call_at.lte.${new Date().toISOString()}`
  )

  // Prioritize: hot/high first, then by score desc, then never-called first
  query = query
    .order('call_attempt_count', { ascending: true, nullsFirst: true })
    .order('lead_score', { ascending: false, nullsFirst: false })
    .order('inserted_at', { ascending: false })
    .limit(limit)

  const { data, error } = await query
  if (error) {
    console.error('[for-calling] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    count: data?.length ?? 0,
    leads: data ?? [],
    filters: {
      limit, maxAttempts, qualityList, country, excludeStatus,
      businessHoursOnly,
    },
  })
}
