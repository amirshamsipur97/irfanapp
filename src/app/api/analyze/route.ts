import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CACHE_HOURS = 6

function parseJSON(text: string): Record<string, unknown> | null {
  const clean = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/m, '').trim()
  try { return JSON.parse(clean) } catch { /* fall through */ }
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch { /* fall through */ }
    const truncated = m[0].replace(/,?\s*"[^"]*"\s*:\s*[^,}\]]*$/, '') + '}'
    try { return JSON.parse(truncated) } catch { /* give up */ }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

    // ── 1. Cache check ───────────────────────────────────────────
    if (!forceRefresh) {
      try {
        const { data: cached } = await analyticsDb
          .from('analytics_insights')
          .select('analysis_json, snapshot_json, created_at')
          .order('created_at', { ascending: false })
          .limit(1).single()

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
      } catch { /* non-fatal */ }
    }

    // ── 2. Fetch all three data sources in parallel ───────────────
    const [ga4Result, adsResult, leadsResult] = await Promise.all([
      analyticsDb.from('analytics_ga4').select('*').order('date', { ascending: false }).limit(500),
      analyticsDb.from('google_ads_campaign_data').select('*').order('cost', { ascending: false }).limit(50),
      analyticsDb.from('leads')
        .select('lead_quality,lead_score,buyer_intent,country,property_interest,budget,source_sheet,campaign_source,utm_campaign,inserted_at')
        .order('inserted_at', { ascending: false }).limit(500),
    ])

    if (ga4Result.error || !ga4Result.data?.length) {
      return NextResponse.json({ error: 'No GA4 data found.' }, { status: 404 })
    }

    const rows  = ga4Result.data
    const ads   = adsResult.data ?? []
    const leads = leadsResult.data ?? []

    // ── 3. GA4 aggregations ──────────────────────────────────────
    const totalPageViews   = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
    const totalUsers28     = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
    const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
    const totalEvents      = rows.reduce((s, r) => s + (r.event_count || 0), 0)
    const totalGA4Leads    = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

    const topPages = Object.entries(
      rows.reduce((acc: Record<string, number>, r) => {
        const p = (r.page_location || '').replace('https://irfaninvest.com', '') || '/'
        acc[p] = (acc[p] || 0) + (r.screen_page_views || r.page_views || 0)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const topGA4Countries = Object.entries(
      rows.reduce((acc: Record<string, number>, r) => {
        acc[r.country] = (acc[r.country] || 0) + (r.active_28_day_users || 0)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 4)

    // ── 4. Google Ads aggregations ───────────────────────────────
    const adsTotalSpend    = ads.reduce((s, r) => s + Number(r.cost), 0)
    const adsTotalClicks   = ads.reduce((s, r) => s + Number(r.clicks), 0)
    const adsImpressions   = ads.reduce((s, r) => s + Number(r.impressions), 0)
    const adsOverallCtr    = adsImpressions > 0 ? (adsTotalClicks / adsImpressions * 100) : 0
    const adsOverallCpc    = adsTotalClicks > 0 ? adsTotalSpend / adsTotalClicks : 0
    const adsCPL           = leads.length > 0 ? adsTotalSpend / leads.length : 0
    const enabledCampaigns = ads.filter(r => r.campaign_status === 'ENABLED')
    const pausedCampaigns  = ads.filter(r => r.campaign_status === 'PAUSED')

    const topAdsBySpend = ads.filter(r => Number(r.cost) > 0).slice(0, 4)
      .map(r => `${r.campaign_name}(${r.campaign_status},$${Number(r.cost).toFixed(0)},${r.advertising_channel_type},CTR:${(Number(r.ctr)*100).toFixed(2)}%)`)

    const channelBreakdown = Object.entries(
      ads.reduce((acc: Record<string, number>, r) => {
        acc[r.advertising_channel_type] = (acc[r.advertising_channel_type] || 0) + Number(r.cost)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).map(([ch, cost]) => `${ch}:$${cost.toFixed(0)}`)

    // ── 5. Leads aggregations ────────────────────────────────────
    const leadsTotal   = leads.length
    const leadsHot     = leads.filter(l => ['hot','high'].includes((l.lead_quality ?? '').toLowerCase())).length
    const leadsWarm    = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'warm').length
    const leadsCold    = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'cold').length
    const leadsInvalid = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'invalid').length
    const validScores  = leads.map(l => Number(l.lead_score)).filter(n => n > 0 && !isNaN(n))
    const avgLeadScore = validScores.length ? (validScores.reduce((s, n) => s + n, 0) / validScores.length).toFixed(1) : '0'
    const highIntent   = leads.filter(l => (l.buyer_intent ?? '').toLowerCase() === 'high').length
    const today        = new Date().toISOString().slice(0, 10)
    const leadsToday   = leads.filter(l => (l.inserted_at ?? '').slice(0, 10) === today).length

    // Top countries from leads
    const leadsCountryMap = leads.reduce((acc: Record<string, number>, l) => {
      const c = l.country || 'Unknown'
      acc[c] = (acc[c] || 0) + 1
      return acc
    }, {})
    const topLeadsCountries = Object.entries(leadsCountryMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([c, n]) => `${c}:${n}`)

    // Top property interests
    const propMap = leads.reduce((acc: Record<string, number>, l) => {
      const p = l.property_interest || 'Unknown'
      if (p && p !== 'Unknown') acc[p] = (acc[p] || 0) + 1
      return acc
    }, {})
    const topProperties = Object.entries(propMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([p, n]) => `${p}:${n}`)

    // Top lead sources
    const sourceMap = leads.reduce((acc: Record<string, number>, l) => {
      const s = l.source_sheet || l.campaign_source || 'unknown'
      acc[s] = (acc[s] || 0) + 1
      return acc
    }, {})
    const topLeadSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([s, n]) => `${s}:${n}`)

    // UTM campaigns generating leads
    const utmMap = leads.reduce((acc: Record<string, number>, l) => {
      const u = l.utm_campaign || 'organic'
      acc[u] = (acc[u] || 0) + 1
      return acc
    }, {})
    const topUTM = Object.entries(utmMap).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .map(([u, n]) => `${u}:${n}`)

    const snapshot = {
      ga4: { totalPageViews, totalUsers28, totalActiveToday, totalEvents, totalGA4Leads, topPages, topGA4Countries },
      ads: { adsTotalSpend, adsTotalClicks, adsImpressions, adsOverallCtr, adsOverallCpc, adsCPL, enabledCount: enabledCampaigns.length, pausedCount: pausedCampaigns.length },
      leads: { leadsTotal, leadsHot, leadsWarm, leadsCold, leadsInvalid, avgLeadScore, highIntent, leadsToday, topLeadsCountries, topProperties, topLeadSources },
    }

    // ── 6. Build comprehensive prompt ────────────────────────────
    const prompt = `You are a senior digital marketing analyst for irfaninvest.com — Oman luxury real estate (ITC freehold, targeting UK/UAE/Qatar/Oman buyers). Provide a data-driven analysis of all THREE channels.

═══ GA4 WEBSITE DATA (${rows[rows.length-1]?.date} → ${rows[0]?.date}) ═══
Views=${totalPageViews} | Users28d=${totalUsers28} | ActiveToday=${totalActiveToday} | Events=${totalEvents} | GA4Leads=${totalGA4Leads}
Top pages: ${topPages.map(([p,v]) => `${p}:${v}`).join(', ')}
Top countries: ${topGA4Countries.map(([c,u]) => `${c}:${u}`).join(', ')}

═══ GOOGLE ADS DATA ═══
TotalSpend=$${adsTotalSpend.toFixed(0)} | Clicks=${adsTotalClicks.toLocaleString()} | Impressions=${adsImpressions.toLocaleString()}
CTR=${adsOverallCtr.toFixed(2)}% | AvgCPC=$${adsOverallCpc.toFixed(3)} | CostPerLead=$${adsCPL.toFixed(0)}
Active=${enabledCampaigns.length} | Paused=${pausedCampaigns.length} | Channels: ${channelBreakdown.join(' | ')}
Top campaigns: ${topAdsBySpend.join(' | ')}

═══ LEADS CRM DATA (${leadsTotal} leads from Google Sheets) ═══
Hot/High=${leadsHot} | Warm=${leadsWarm} | Cold=${leadsCold} | Invalid=${leadsInvalid}
AvgScore=${avgLeadScore}/100 | HighIntent=${highIntent} | Today=${leadsToday}
Top countries: ${topLeadsCountries.join(', ')}
Property interests: ${topProperties.join(', ')}
Lead sources: ${topLeadSources.join(', ')}
UTM campaigns: ${topUTM.join(', ')}

Reply ONLY with valid JSON (no markdown). leadsAnalysis FIRST to avoid truncation:
{"leadsAnalysis":{"funnelAssessment":"2 sentences on the full funnel: Ads spend → website traffic → lead capture quality","qualityBreakdown":"2 sentences on lead quality distribution and what it means","topOpportunities":[{"title":"","detail":"","impact":"high|medium|low"},{"title":"","detail":"","impact":"high"}],"sourceEffectiveness":"which sources/sheets generate best leads","crossChannelInsight":"1-2 sentences connecting GA4 traffic patterns with lead quality"},"adsAnalysis":{"overallAssessment":"2 sentences","budgetEfficiency":"high|medium|low","topPerformingCampaign":"name","weakestCampaign":"name","costPerLeadAssessment":"1 sentence","recommendations":[{"title":"","detail":"","priority":"urgent|high|medium"},{"title":"","detail":"","priority":"high"}]},"summary":"2-3 sentences covering all three channels","score":0,"topInsights":[{"title":"","detail":"","impact":"high"},{"title":"","detail":"","impact":"high"},{"title":"","detail":"","impact":"medium"}],"seoRecommendations":[{"title":"","detail":"","priority":"urgent|high|medium"},{"title":"","detail":"","priority":"high"},{"title":"","detail":"","priority":"medium"}],"geographicOpportunities":"2 sentences","contentGaps":[{"topic":"","reason":""},{"topic":"","reason":""}],"priorityActions":[{"action":"","timeframe":"48h","impact":"high"},{"action":"","timeframe":"1 week","impact":"high"},{"action":"","timeframe":"1 month","impact":"medium"}],"metrics":{"conversionRate":0,"engagementScore":0,"internationalTraffic":0}}`

    // ── 7. Call Claude ───────────────────────────────────────────
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    console.log('Claude raw length:', rawText.length)

    const analysis = parseJSON(rawText) ?? {
      summary: rawText.slice(0, 200) || 'Analysis unavailable.',
      score: 0, topInsights: [], seoRecommendations: [],
      geographicOpportunities: '', contentGaps: [], priorityActions: [],
      metrics: { conversionRate: 0, engagementScore: 0, internationalTraffic: 0 },
    }

    // ── 8. Save to cache ─────────────────────────────────────────
    try {
      await analyticsDb.from('analytics_insights').insert({
        analysis_json: analysis,
        snapshot_json: snapshot,
      })
    } catch (e) {
      console.error('Cache insert failed (non-fatal):', e)
    }

    return NextResponse.json({ analysis, snapshot, lastUpdated: new Date().toISOString(), cached: false })

  } catch (err) {
    console.error('Analyze route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
