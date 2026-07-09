import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health — public liveness/readiness probe (no data exposed).
 * Used for uptime monitoring; returns DB reachability and key config flags.
 */
export async function GET() {
  const started = Date.now()
  let db = 'ok'
  try {
    const { error } = await analyticsDb.from('leads').select('id', { count: 'exact', head: true }).limit(1)
    if (error) db = 'error'
  } catch {
    db = 'unreachable'
  }
  return NextResponse.json({
    status: db === 'ok' ? 'healthy' : 'degraded',
    db,
    db_latency_ms: Date.now() - started,
    auth_configured: Boolean(process.env.DASHBOARD_PASSWORD && process.env.AUTH_SECRET),
    service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    version: '1.0.0',
    time: new Date().toISOString(),
  })
}
