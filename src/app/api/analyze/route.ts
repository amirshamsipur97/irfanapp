import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  const { data: rows, error } = await analyticsDb
    .from('analytics_ga4')
    .select('*')
    .order('date', { ascending: false })
    .limit(500)

  if (error || !rows?.length) {
    return NextResponse.json({ error: 'No data available.' }, { status: 404 })
  }

  const totalPageViews = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers28 = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
  const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents = rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

  const topPages = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      const p = (r.page_location || '').replace('https://irfaninvest.com', '') || '/'
      acc[p] = (acc[p] || 0) + (r.screen_page_views || r.page_views || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8)

  const topCountries = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.country] = (acc[r.country] || 0) + (r.active_28_day_users || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const dateRange = { from: rows[rows.length - 1]?.date, to: rows[0]?.date }

  const prompt = `You are an expert SEO analyst and digital marketing strategist for real estate websites. Analyze the Google Analytics 4 data for irfaninvest.com — a luxury real estate investment website focused on Oman properties (ITC zones, freehold properties for foreigners).

DATA SUMMARY:
- Date Range: ${dateRange.from} to ${dateRange.to}
- Total Page Views: ${totalPageViews}
- Active Users (28-day): ${totalUsers28}
- Active Users (Today): ${totalActiveToday}
- Total Events: ${totalEvents}
- Lead Generation Events: ${totalLeads}

TOP PAGES (by views):
${topPages.map(([p, v], i) => `${i + 1}. ${p} — ${v} views`).join('\n')}

TOP COUNTRIES (by users):
${topCountries.map(([c, u], i) => `${i + 1}. ${c} — ${u} users`).join('\n')}

Return ONLY valid JSON (no markdown, no code blocks, no extra text) in this exact structure:
{
  "summary": "2-3 sentence executive summary of the website performance",
  "score": <overall SEO health score 0-100 as integer>,
  "topInsights": [
    {"title": "insight title", "detail": "1-2 sentence detail", "impact": "high|medium|low"}
  ],
  "seoRecommendations": [
    {"title": "recommendation title", "detail": "specific actionable step", "priority": "urgent|high|medium"}
  ],
  "geographicOpportunities": "2-3 sentences about geographic strategy",
  "contentGaps": [
    {"topic": "missing content topic", "reason": "why this matters for SEO"}
  ],
  "priorityActions": [
    {"action": "specific action", "timeframe": "48h|1 week|1 month", "impact": "high|medium|low"}
  ],
  "metrics": {
    "conversionRate": <leads/users percentage as number>,
    "engagementScore": <events/pageviews ratio as number rounded to 1 decimal>,
    "internationalTraffic": <percentage of non-Oman users as integer>
  }
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  // Strip any markdown code blocks if present
  const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let analysis
  try {
    analysis = JSON.parse(clean)
  } catch {
    // Fallback: try to extract JSON object
    const match = clean.match(/\{[\s\S]*\}/)
    analysis = match ? JSON.parse(match[0]) : { summary: text }
  }

  return NextResponse.json({
    analysis,
    snapshot: { totalPageViews, totalUsers28, totalActiveToday, totalEvents, totalLeads, topPages, topCountries },
    lastUpdated: rows[0]?.synced_at,
  })
}
