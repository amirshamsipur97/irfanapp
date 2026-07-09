import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * GET /api/leads/for-calling
 *
 * Returns leads that are eligible for outbound calling, with safety filters:
 *   - Has a phone that normalizes to valid E.164 (>=8 digits)
 *   - call_attempt_count < max_attempts (default 3)
 *   - call_status NOT IN (booked, not_interested, do_not_call)
 *   - lead_quality != invalid  (quality list only enforced when require_quality=1)
 *   - next_call_at IS NULL OR <= now (cooldown respected)
 *   - source is not a test/probe row (__*, zz*, *test*, *probe*, *delete*, secret*)
 *
 * Query params:
 *   limit          — max records (default 10, cap 50)
 *   max_attempts   — call_attempt_count cap (default 3)
 *   since          — ISO timestamp; only return leads inserted after this (scope to new leads)
 *   require_quality — if "1", restrict to `quality` list (default: any quality except invalid)
 *   quality        — comma-separated qualities to include (used only when require_quality=1)
 *   country        — filter by country (substring)
 *   exclude_status — comma-separated call_status to skip (default: booked,not_interested,do_not_call)
 *   business_hours — if "1", only return leads when current time is in Oman business hours (Sun-Thu, 9:00-18:00 GMT+4)
 *
 * Each returned lead includes `e164_phone`: the cleaned, dial-ready number.
 */

// Normalize a raw phone (+ optional country) into E.164, or null if not dialable.
function toE164(raw: string | null | undefined, country?: string | null): string | null {
  if (!raw) return null
  const s = String(raw).replace(/[^\d+]/g, '')
  if (!s) return null
  if (s.startsWith('+')) {
    const digits = s.slice(1)
    return digits.length >= 8 ? '+' + digits : null
  }
  // No leading '+'. Oman-focused fallback: 8-digit local mobile (starts 7/9).
  if (/^[79]\d{7}$/.test(s)) return '+968' + s
  // Country hints for the most common markets.
  const c = (country || '').toLowerCase()
  if (c.includes('oman') && s.length === 8) return '+968' + s
  // Otherwise assume it already carries a country code.
  if (s.length >= 10) return '+' + s
  return null
}

// Reject obvious test / probe rows by source or lead_id.
function isTestRow(source?: string | null, leadId?: string | null, name?: string | null): boolean {
  const hay = `${source ?? ''} ${leadId ?? ''} ${name ?? ''}`.toLowerCase()
  return (
    hay.includes('__') ||
    /\bzz[_ ]/.test(hay) ||
    hay.startsWith('zz') ||
    hay.includes('test') ||
    hay.includes('probe') ||
    hay.includes('delete') ||
    hay.includes('secret')
  )
}

export async function GET(req: NextRequest) {
  // Webhook secret optional but recommended
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.WEBHOOK_SECRET && secret && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const limit         = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)))
  const maxAttempts   = Math.max(1, parseInt(searchParams.get('max_attempts') ?? '3', 10))
  const since         = searchParams.get('since')
  const requireQuality = searchParams.get('require_quality') === '1'
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
    id, lead_id, source, dedup_key, full_name, email, phone, country, city,
    property_interest, budget, preferred_location, message,
    lead_quality, lead_score, buyer_intent, status,
    call_status, call_attempt_count, last_called_at, next_call_at,
    vapi_call_id, voice_source, phone_valid, recommended_next_action, inserted_at
  `)
    .not('phone', 'is', null)
    .lt('call_attempt_count', maxAttempts)
    // exclude explicitly-invalid quality, but allow NULL (un-qualified form leads)
    .or('lead_quality.is.null,lead_quality.neq.invalid')

  if (requireQuality && qualityList.length > 0) {
    query = query.in('lead_quality', qualityList)
  }
  if (excludeStatus.length > 0) {
    query = query.or(
      `call_status.is.null,call_status.not.in.(${excludeStatus.join(',')})`
    )
  }
  if (country) {
    query = query.ilike('country', `%${country}%`)
  }
  if (since) {
    query = query.gt('inserted_at', since)
  }
  // Cooldown: next_call_at IS NULL OR <= now
  query = query.or(
    `next_call_at.is.null,next_call_at.lte.${new Date().toISOString()}`
  )

  // Prioritize: never-called first, then hot/high by score, then newest
  query = query
    .order('call_attempt_count', { ascending: true, nullsFirst: true })
    .order('lead_score', { ascending: false, nullsFirst: false })
    .order('inserted_at', { ascending: false })
    .limit(limit * 3) // over-fetch; JS filters test rows + undialable phones below

  const { data, error } = await query
  if (error) {
    console.error('[for-calling] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Post-filter: drop test rows + undialable phones, attach e164_phone ────
  const leads = (data ?? [])
    .filter(l => !isTestRow(l.source, l.lead_id, l.full_name))
    .map(l => ({ ...l, e164_phone: toE164(l.phone, l.country) }))
    .filter(l => l.e164_phone !== null)
    .slice(0, limit)

  return NextResponse.json({
    success: true,
    count: leads.length,
    leads,
    filters: {
      limit, maxAttempts, since, requireQuality, qualityList, country,
      excludeStatus, businessHoursOnly,
    },
  })
}
