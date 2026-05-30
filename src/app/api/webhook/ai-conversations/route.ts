import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * AI Conversations dataset (Pipeline B). Receives EVERY analyzed AI chat
 * conversation with its qualification, kept SEPARATE from the leads DB.
 * n8n posts: { source, generated_at, total_records, data: [...conversations] }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const rawRows: Record<string, unknown>[] = body?.data ?? (Array.isArray(body) ? body : [body])
  if (!rawRows.length) {
    return NextResponse.json({ error: 'No rows in payload' }, { status: 400 })
  }

  const truthy = (v: unknown) =>
    v === true || v === 1 || ['true', '1', 'yes', 'qualified'].includes(String(v ?? '').toLowerCase())

  const rows = rawRows
    .filter(r => r.conversation_id || r.session_id)
    .map(r => ({
      conversation_id:   String(r.conversation_id ?? r.session_id ?? ''),
      session_id:        String(r.session_id ?? ''),
      started_at:        String(r.started_at ?? r.timestamp ?? ''),
      last_at:           String(r.last_at ?? ''),
      message_count:     Number(r.message_count ?? 0),
      language:          String(r.language ?? ''),
      summary:           String(r.summary ?? r.short_summary ?? ''),
      lead_score:        Number(r.lead_score ?? 0),
      lead_status:       String(r.lead_status ?? r.lead_quality ?? ''),
      intent:            String(r.intent ?? ''),
      urgency:           String(r.urgency ?? ''),
      project_interest:  String(r.project_interest ?? ''),
      investment_intent: String(r.investment_intent ?? ''),
      qualified:         truthy(r.qualified),
    }))

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid conversation rows (missing conversation_id/session_id)' }, { status: 400 })
  }

  // Replace conversations present in this batch (idempotent re-sync).
  const ids = [...new Set(rows.map(r => r.conversation_id).filter(Boolean))]
  if (ids.length) {
    await analyticsDb.from('ai_conversations').delete().in('conversation_id', ids)
  }

  const { error } = await analyticsDb.from('ai_conversations').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const qualified = rows.filter(r => r.qualified).length
  return NextResponse.json({ success: true, count: rows.length, qualified })
}
