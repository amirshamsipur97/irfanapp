import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CACHE_HOURS = 6

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  // ── 1. Return cached result if fresh ──────────────────────────
  if (!forceRefresh) {
    const { data: cached } = await analyticsDb
      .from('analytics_insights')
      .select('analysis_json, snapshot_json, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      const ageHours = (Date.now() - new Date(cached.created_at).getTime()) / 36e5
      if (ageHours < CACHE_HOURS) {
        return NextResponse.json({
          analysis: cached.analysis_json,
          snapshot: cached.snapshot_json,
          lastUpdated: cached.created_at,
          cached: true,
        })
      }
    }
  }

  // ── 2. Fetch GA4 data ─────────────────────────────────────────
  const { data: rows, error } = await analyticsDb
    .from('analytics_ga4')
    .select('*')
    .order('date', { ascending: false })
    .limit(500)

  if (error || !rows?.length) {
    return NextResponse.json({ error: 'No GA4 data found.' }, { status: 404 })
  }

  // ── 3. Build snapshot ─────────────────────────────────────────
  const totalPageViews = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers28   = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
  const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents    = rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads     = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

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

  const snapshot = { totalPageViews, totalUsers28, totalActiveToday, totalEvents, totalLeads, topPages, topCountries }

  // ── 4. Call Claude ────────────────────────────────────────────
  const prompt = `You are an expert SEO analyst for real estate websites. Analyze GA4 data for irfaninvest.com — a luxury real estate investment website in Oman (ITC zones, freehold properties).

DATA:
- Date Range: ${rows[rows.length-1]?.date} to ${rows[0]?.date}
- Page Views: ${totalPageViews} | Active Users 28d: ${totalUsers28} | Active Today: ${totalActiveToday}
- Events: ${totalEvents} | Leads: ${totalLeads}

TOP PAGES: ${topPages.map(([p,v])=>`${p}(${v})`).join(', ')}
TOP COUNTRIES: ${topCountries.map(([c,u])=>`${c}(${u})`).join(', ')}

Return ONLY valid JSON, no markdown, no code blocks:
{"summary":"2-3 sentence executive summary","score":<0-100>,"topInsights":[{"title":"","detail":"","impact":"high|medium|low"}],"seoRecommendations":[{"title":"","detail":"","priority":"urgent|high|medium"}],"geographicOpportunities":"2-3 sentences","contentGaps":[{"topic":"","reason":""}],"priorityActions":[{"action":"","timeframe":"48h|1 week|1 month","impact":"high|medium|low"}],"metrics":{"conversionRate":<number>,"engagementScore":<number>,"internationalTraffic":<integer>}}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let analysis
  try {
    analysis = JSON.parse(clean)
  } catch {
    const match = clean.match(/\{[\s\S]*\}/)
    analysis = match ? JSON.parse(match[0]) : { summary: clean, score: 0 }
  }

  // ── 5. Save to cache ──────────────────────────────────────────
  await analyticsDb.from('analytics_insights').insert({
    analysis_json: analysis,
    snapshot_json: snapshot,
  })

  return NextResponse.json({ analysis, snapshot, lastUpdated: new Date().toISOString(), cached: false })
}
