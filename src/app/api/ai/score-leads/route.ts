import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

export const maxDuration = 60

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function scoreLead(lead: Record<string, unknown>) {
  const prompt = `You are a lead qualification expert for irfaninvest.com, a luxury real estate investment consultancy in Oman.

Analyze this lead and return ONLY valid JSON (no markdown):
{
  "lead_score": <0-100 integer>,
  "lead_quality": <"hot"|"warm"|"cold"|"invalid">,
  "buyer_intent": <"high"|"medium"|"low"|"none">,
  "short_summary": "<1-2 sentence summary>",
  "recommended_next_action": "<specific sales action>",
  "suggested_email_reply": "<ready-to-send email reply>"
}

Lead:
- Name: ${lead.full_name ?? 'unknown'}
- Email: ${lead.email ?? 'none'}
- Phone: ${lead.phone ?? 'none'}
- Country: ${lead.country ?? 'unknown'}
- Property interest: ${lead.property_interest ?? 'not specified'}
- Budget: ${lead.budget ?? 'not specified'}
- Message: ${lead.message ?? 'none'}`

  const msg = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text : ''
  const clean = raw.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/m, '').trim()
  const m = clean.match(/\{[\s\S]*\}/)
  return m ? JSON.parse(m[0]) : null
}

// GET /api/ai/score-leads?limit=20 — score unscored leads
export async function GET(req: NextRequest) {
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10))

  const { data: leads, error } = await analyticsDb
    .from('leads')
    .select('id, full_name, email, phone, country, city, property_interest, budget, message, utm_source, utm_campaign')
    .or('lead_score.is.null,lead_score.eq.0')
    .not('full_name', 'is', null)
    .order('inserted_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!leads?.length) return NextResponse.json({ message: 'No unscored leads found', scored: 0 })

  let scored = 0
  const results: { id: number; status: string; quality?: string; score?: number }[] = []

  await Promise.allSettled(
    leads.map(async (lead) => {
      try {
        const analysis = await scoreLead(lead as Record<string, unknown>)
        if (!analysis) { results.push({ id: lead.id, status: 'failed' }); return }

        await analyticsDb.from('leads').update({
          lead_score:              analysis.lead_score,
          lead_quality:            analysis.lead_quality,
          buyer_intent:            analysis.buyer_intent,
          short_summary:           analysis.short_summary,
          recommended_next_action: analysis.recommended_next_action,
          suggested_email_reply:   analysis.suggested_email_reply,
        }).eq('id', lead.id)

        scored++
        results.push({ id: lead.id, status: 'scored', quality: analysis.lead_quality, score: analysis.lead_score })
      } catch (e) {
        results.push({ id: lead.id, status: 'error' })
        console.error(`[score-leads] Failed for id ${lead.id}:`, e)
      }
    })
  )

  return NextResponse.json({ scored, total: leads.length, results })
}
