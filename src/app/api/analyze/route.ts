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
  const adsSection = ads.length > 0 ? `

GOOGLE ADS DATA:
- Total Spend: $${adsTotalSpend.toFixed(2)} | Total Clicks: ${adsTotalClicks.toLocaleString()} | Impressions: ${adsTotalImpressions.toLocaleString()}
- Overall CTR: ${adsOverallCtr.toFixed(3)}% | Avg CPC: $${adsOverallCpc.toFixed(3)} | Video Views: ${adsTotalVideoViews.toLocaleString()}
- Cost per Lead: $${adsCostPerLead.toFixed(2)} | Active Campaigns: ${enabledCampaigns.length} | Paused: ${pausedCampaigns.length}
- Channel Spend: ${channelBreakdown.join(', ')}
- Top Campaigns by Spend: ${topAdsBySpend.join(' | ')}` : '\nGOOGLE ADS DATA: Not available yet.'

  const prompt = `You are an expert digital marketing analyst for luxury real estate. Analyze both GA4 website analytics AND Google Ads performance for irfaninvest.com — a luxury real estate investment website in Oman (ITC zones, freehold properties targeting UK, UAE, Qatar buyers).

GA4 WEBSITE DATA:
- Date Range: ${rows[rows.length-1]?.date} to ${rows[0]?.date}
- Page Views: ${totalPageViews} | Active Users 28d: ${totalUsers28} | Active Today: ${totalActiveToday}
- Events: ${totalEvents} | Leads Generated: ${totalLeads}
- Top Pages: ${topPages.map(([p,v])=>`${p}(${v})`).join(', ')}
- Top Countries: ${topCountries.map(([c,u])=>`${c}(${u})`).join(', ')}
${adsSection}

Return ONLY valid JSON, no markdown, no code blocks:
{"summary":"2-3 sentence executive summary covering both organic traffic and paid ads performance","score":<0-100>,"topInsights":[{"title":"","detail":"","impact":"high|medium|low"}],"seoRecommendations":[{"title":"","detail":"","priority":"urgent|high|medium"}],"geographicOpportunities":"2-3 sentences about geographic targeting opportunities","contentGaps":[{"topic":"","reason":""}],"priorityActions":[{"action":"","timeframe":"48h|1 week|1 month","impact":"high|medium|low"}],"metrics":{"conversionRate":<number>,"engagementScore":<number>,"internationalTraffic":<integer>},"adsAnalysis":{"overallAssessment":"2-3 sentences on paid ads efficiency and ROI","budgetEfficiency":"high|medium|low","topPerformingCampaign":"campaign name","weakestCampaign":"campaign name","recommendations":[{"title":"","detail":"","priority":"urgent|high|medium"}],"costPerLeadAssessment":"1-2 sentences on cost per lead performance"}}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
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
