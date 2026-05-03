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
    const prompt = `تو یک مشاور تجاری ارشد هستی که باید یک گزارش فارسی ساده و غیرفنی برای مدیرعامل یک شرکت مشاور سرمایه‌گذاری ملکی در عمان (irfaninvest.com) تهیه کنی.

داده‌های لید امروز:
- کل لیدها: ${total} نفر
- لیدهای داغ/عالی: ${hot} نفر
- لیدهای گرم: ${warm} نفر
- لیدهای سرد: ${cold} نفر
- لیدهای نامعتبر: ${invalid} نفر
- میانگین امتیاز: ${avgScore} از ۱۰۰
- لیدهای با نیت خرید بالا: ${highIntent} نفر
- لیدهای امروز: ${leadsToday} نفر
- کشورهای برتر: ${topCountries}
- علاقه‌مندی ملکی: ${topProperties}
${hotLeadSummaries ? `- خلاصه لیدهای مهم: ${hotLeadSummaries}` : ''}

گزارش فارسی را با این ساختار بنویس (ONLY return JSON, no markdown):
{
  "executive_summary": "۲-۳ جمله خلاصه وضعیت کلی به فارسی ساده",
  "quality_analysis": "تحلیل ۲-۳ جمله‌ای از کیفیت لیدها به فارسی",
  "priority_leads": "توضیح ۱-۲ جمله‌ای درباره کدام لیدها مهم‌تر هستند",
  "sales_action": "چه کاری تیم فروش باید فوری انجام دهد (۱-۲ جمله)",
  "immediate_actions": [
    {"action": "اقدام اول", "reason": "دلیل", "timeframe": "امروز/۲۴ ساعت/این هفته"},
    {"action": "اقدام دوم", "reason": "دلیل", "timeframe": "۴۸ ساعت"},
    {"action": "اقدام سوم", "reason": "دلیل", "timeframe": "این هفته"}
  ],
  "market_insight": "یک بینش مختصر درباره بازار هدف بر اساس این لیدها",
  "score_interpretation": "توضیح ساده درباره معنی امتیاز میانگین ${avgScore}"
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
