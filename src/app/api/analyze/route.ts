import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

export const maxDuration = 60

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

  // ── 2. Fetch GA4 + Google Ads data in parallel ────────────────
  const [ga4Result, adsResult] = await Promise.all([
    analyticsDb.from('analytics_ga4').select('*').order('date', { ascending: false }).limit(500),
    analyticsDb.from('google_ads_campaign_data').select('*').order('cost', { ascending: false }).limit(50),
  ])

  if (ga4Result.error || !ga4Result.data?.length) {
    return NextResponse.json({ error: 'No GA4 data found.' }, { status: 404 })
  }

  const rows = ga4Result.data
  const ads  = adsResult.data ?? []

  // ── 3. Build GA4 snapshot ─────────────────────────────────────
  const totalPageViews    = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers28      = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
  const totalActiveToday  = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents       = rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads        = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

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

  // ── 4. Build Google Ads snapshot ─────────────────────────────
  const adsTotalSpend       = ads.reduce((s, r) => s + Number(r.cost), 0)
  const adsTotalClicks      = ads.reduce((s, r) => s + Number(r.clicks), 0)
  const adsTotalImpressions = ads.reduce((s, r) => s + Number(r.impressions), 0)
  const adsTotalVideoViews  = ads.reduce((s, r) => s + Number(r.video_views), 0)
  const adsOverallCtr       = adsTotalImpressions > 0 ? (adsTotalClicks / adsTotalImpressions * 100) : 0
  const adsOverallCpc       = adsTotalClicks > 0 ? adsTotalSpend / adsTotalClicks : 0
  const adsCostPerLead      = totalLeads > 0 ? adsTotalSpend / totalLeads : 0

  const enabledCampaigns = ads.filter(r => r.campaign_status === 'ENABLED')
  const pausedCampaigns  = ads.filter(r => r.campaign_status === 'PAUSED')

  const topAdsBySpend = ads
    .filter(r => Number(r.cost) > 0)
    .slice(0, 5)
    .map(r => `${r.campaign_name}(${r.campaign_status},spend:$${Number(r.cost).toFixed(0)},clicks:${r.clicks},CTR:${(Number(r.ctr)*100).toFixed(2)}%,channel:${r.advertising_channel_type})`)

  const channelBreakdown = Object.entries(
    ads.reduce((acc: Record<string, number>, r) => {
      acc[r.advertising_channel_type] = (acc[r.advertising_channel_type] || 0) + Number(r.cost)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([ch, cost]) => `${ch}:$${cost.toFixed(0)}`)

  const snapshot = {
    totalPageViews, totalUsers28, totalActiveToday, totalEvents, totalLeads, topPages, topCountries,
    ads: { adsTotalSpend, adsTotalClicks, adsTotalImpressions, adsOverallCtr, adsOverallCpc, adsCostPerLead }
  }

  // ── 5. Call Claude ────────────────────────────────────────────
  const adsSection = ads.length > 0
    ? `\nADS: spend=$${adsTotalSpend.toFixed(0)} clicks=${adsTotalClicks} impr=${adsTotalImpressions} CTR=${adsOverallCtr.toFixed(2)}% CPC=$${adsOverallCpc.toFixed(2)} CPL=$${adsCostPerLead.toFixed(0)} active=${enabledCampaigns.length} paused=${pausedCampaigns.length} channels=${channelBreakdown.join('|')} top=${topAdsBySpend.slice(0,3).join('|')}`
    : '\nADS: no data'

  const prompt = `Analyze irfaninvest.com — Oman luxury real estate (ITC/freehold, targeting UK/UAE/Qatar buyers).

GA4: ${rows[rows.length-1]?.date} to ${rows[0]?.date} | views=${totalPageViews} users28d=${totalUsers28} today=${totalActiveToday} events=${totalEvents} leads=${totalLeads}
pages=${topPages.map(([p,v])=>`${p}:${v}`).join(',')}
countries=${topCountries.map(([c,u])=>`${c}:${u}`).join(',')}
${adsSection}

Reply ONLY with this JSON (no markdown):
{"summary":"2-3 sentences","score":<0-100>,"topInsights":[{"title":"","detail":"","impact":"high|medium|low"}],"seoRecommendations":[{"title":"","detail":"","priority":"urgent|high|medium"}],"geographicOpportunities":"2 sentences","contentGaps":[{"topic":"","reason":""}],"priorityActions":[{"action":"","timeframe":"48h|1 week|1 month","impact":"high|medium|low"}],"metrics":{"conversionRate":<num>,"engagementScore":<num>,"internationalTraffic":<int>},"adsAnalysis":{"overallAssessment":"2 sentences","budgetEfficiency":"high|medium|low","topPerformingCampaign":"","weakestCampaign":"","recommendations":[{"title":"","detail":"","priority":"urgent|high|medium"}],"costPerLeadAssessment":"1 sentence"}}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1800,
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

  // ── 6. Save to cache ──────────────────────────────────────────
  await analyticsDb.from('analytics_insights').insert({
    analysis_json: analysis,
    snapshot_json: snapshot,
  })

  return NextResponse.json({ analysis, snapshot, lastUpdated: new Date().toISOString(), cached: false })
}
