import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

/**
 * GET /api/conversations
 * Returns AI conversation data + aggregates for the dashboard.
 */
export async function GET() {
  const { data: rows, error } = await analyticsDb
    .from('ai_conversations')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const all = rows ?? []
  const total = all.length

  // ── Aggregates ─────────────────────────────────────────────────────────
  const uniqueSessions = new Set(all.map(r => r.session_id || r.conversation_id).filter(Boolean)).size
  const qualifiedCount = all.filter(r => r.qualified === true).length
  const withContact    = all.filter(r => r.has_contact_info === true).length

  // By language
  const byLanguage = Object.entries(
    all.reduce((acc: Record<string, number>, r) => {
      const lang = r.language || 'unknown'
      acc[lang] = (acc[lang] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([language, count]) => ({ language, count }))

  // Top mentioned projects — server-side cleanup of AI-explanation noise
  // The n8n agent sometimes writes long sentences into project_interest. Strip those out
  // so the API never serves trash to the UI.
  const isExplanation = (s: string): boolean => {
    if (!s) return true
    const t = s.trim()
    if (t.length > 60) return true
    if (t.split(/\s+/).length > 6) return true
    if (/[.!?]$/.test(t)) return true
    return /(the conversation|lacks any|no clear|not qualified|no information|no specific|does not (contain|indicate|show)|no meaningful|no buying|no investment|no relevant|no identifying|devoid of|no substance|no inquiries|no intent)/i.test(t)
  }
  const byProject = Object.entries(
    all.reduce((acc: Record<string, number>, r) => {
      const p = r.project_interest
      if (p && p !== 'unknown' && !isExplanation(p)) acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([project, count]) => ({ project, count }))

  // By intent
  const byIntent = Object.entries(
    all.reduce((acc: Record<string, number>, r) => {
      const intent = r.intent || 'unknown'
      acc[intent] = (acc[intent] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([intent, count]) => ({ intent, count }))

  // Volume over time (by day)
  const byDay = Object.entries(
    all.reduce((acc: Record<string, number>, r) => {
      const day = (r.started_at || '').slice(0, 10)
      if (!day) return acc
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }))

  // Lead score distribution buckets
  const scoreBuckets = { '0-19': 0, '20-49': 0, '50-79': 0, '80-100': 0 }
  all.forEach(r => {
    const s = Number(r.lead_score ?? 0)
    if (s >= 80) scoreBuckets['80-100']++
    else if (s >= 50) scoreBuckets['50-79']++
    else if (s >= 20) scoreBuckets['20-49']++
    else scoreBuckets['0-19']++
  })

  return NextResponse.json({
    total,
    uniqueSessions,
    qualifiedCount,
    withContact,
    byLanguage,
    byProject,
    byIntent,
    byDay,
    scoreBuckets,
    recent: all.slice(0, 50),
  })
}
