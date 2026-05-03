import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    // ── 1. Fetch fresh lead stats from Supabase ──────────────────────────
    const { data: leads, error } = await analyticsDb
      .from('leads')
      .select('lead_quality, lead_score, buyer_intent, country, property_interest, budget, recommended_next_action, short_summary, status, inserted_at')
      .order('inserted_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!leads?.length) return NextResponse.json({ error: 'No leads data available' }, { status: 404 })

    // ── 2. Build aggregated stats for the prompt ─────────────────────────
    const total   = leads.length
    const hot     = leads.filter(l => ['hot','high'].includes((l.lead_quality ?? '').toLowerCase())).length
    const warm    = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'warm').length
    const cold    = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'cold').length
    const invalid = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'invalid').length

    const scores        = leads.map(l => Number(l.lead_score)).filter(n => !isNaN(n) && n > 0)
    const avgScore      = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(1) : '0'
    const highIntent    = leads.filter(l => ['high','medium'].includes((l.buyer_intent ?? '').toLowerCase())).length

    const countryCounts = leads.reduce((acc: Record<string, number>, l) => {
      const c = l.country || 'Unknown'
      acc[c] = (acc[c] || 0) + 1
      return acc
    }, {})
    const topCountries  = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([c, n]) => `${c}(${n})`).join(', ')

    const propCounts    = leads.reduce((acc: Record<string, number>, l) => {
      const p = l.property_interest || 'Unknown'
      acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
    const topProperties = Object.entries(propCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([p, n]) => `${p}(${n})`).join(', ')

    const hotLeadSummaries = leads
      .filter(l => ['hot','high','warm'].includes((l.lead_quality ?? '').toLowerCase()))
      .slice(0, 5)
      .map(l => l.short_summary)
      .filter(Boolean)
      .join(' | ')

    const today         = new Date().toISOString().slice(0, 10)
    const leadsToday    = leads.filter(l => (l.inserted_at ?? '').slice(0, 10) === today).length

    // ── 3. Build prompt ──────────────────────────────────────────────────
    const prompt = `You are a senior business advisor preparing a concise, non-technical executive report for the CEO of irfaninvest.com — a luxury real estate investment consultancy in Oman (ITC zones, freehold properties targeting UK, UAE, Qatar buyers).

Current leads data:
- Total leads: ${total}
- Hot/High quality: ${hot}
- Warm: ${warm}
- Cold: ${cold}
- Invalid: ${invalid}
- Average score: ${avgScore}/100
- High buyer intent: ${highIntent}
- New leads today: ${leadsToday}
- Top countries: ${topCountries}
- Property interests: ${topProperties}
${hotLeadSummaries ? `- Priority lead summaries: ${hotLeadSummaries}` : ''}

Return ONLY valid JSON (no markdown):
{
  "executive_summary": "2-3 sentence plain-English overview of the current lead pipeline",
  "quality_analysis": "2-3 sentence analysis of lead quality and what it means for the business",
  "priority_leads": "1-2 sentences on which leads deserve immediate attention and why",
  "sales_action": "1-2 sentences on what the sales team must do right now",
  "immediate_actions": [
    {"action": "First action", "reason": "Why this matters", "timeframe": "Today"},
    {"action": "Second action", "reason": "Why this matters", "timeframe": "Within 48h"},
    {"action": "Third action", "reason": "Why this matters", "timeframe": "This week"}
  ],
  "market_insight": "One insight about the target market based on this lead data",
  "score_interpretation": "Plain-language explanation of what the average score of ${avgScore}/100 means for conversions"
}`

    // ── 4. Call Claude ───────────────────────────────────────────────────
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw   = message.content[0]?.type === 'text' ? message.content[0].text : ''
    const clean = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/m, '').trim()

    let report
    try {
      report = JSON.parse(clean)
    } catch {
      const m = clean.match(/\{[\s\S]*\}/)
      report  = m ? JSON.parse(m[0]) : { executive_summary: clean }
    }

    return NextResponse.json({
      report,
      generatedAt: new Date().toISOString(),
      stats: { total, hot, warm, cold, invalid, avgScore, highIntent, leadsToday },
    })

  } catch (err) {
    console.error('[POST /api/ai/leads-ceo-report] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
