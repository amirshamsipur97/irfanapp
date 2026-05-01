import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { analyticsDb } from '@/lib/supabase'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const CACHE_HOURS = 6

function parseJSON(text: string): Record<string, unknown> | null {
  // Strip markdown code fences
  const clean = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```$/m, '').trim()
  // Try direct parse
  try { return JSON.parse(clean) } catch { /* fall through */ }
  // Extract first {...} block
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) {
    try { return JSON.parse(m[0]) } catch { /* fall through */ }
    // Last resort: try truncating at last complete key-value
    const truncated = m[0].replace(/,?\s*"[^"]*"\s*:\s*[^,}\]]*$/, '') + '}'
    try { return JSON.parse(truncated) } catch { /* give up */ }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

    // ── 1. Return cached result if fresh ────────────────────────
    if (!forceRefresh) {
      try {
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
      } catch (cacheErr) {
        console.warn('Cache read failed (non-fatal):', cacheErr)
      }
    }

    // ── 2. Fetch GA4 + Ads data ──────────────────────────────────
    const [ga4Result, adsResult] = await Promise.all([
      analyticsDb.from('analytics_ga4').select('*').order('date', { ascending: false }).limit(500),
      analyticsDb.from('google_ads_campaign_data').select('*').order('cost', { ascending: false }).limit(50),
    ])

    if (ga4Result.error || !ga4Result.data?.length) {
      return NextResponse.json({ error: 'No GA4 data found.' }, { status: 404 })
    }

    const rows = ga4Result.data
    const ads  = adsResult.data ?? []

    // ── 3. GA4 aggregations ──────────────────────────────────────
    const totalPageViews   = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
    const totalUsers28     = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
    const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
    const totalEvents      = rows.reduce((s, r) => s + (r.event_count || 0), 0)
    const totalLeads       = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

    const topPages = Object.entries(
      rows.reduce((acc: Record<string, number>, r) => {
        const p = (r.page_location || '').replace('https://irfaninvest.com', '') || '/'
        acc[p] = (acc[p] || 0) + (r.screen_page_views || r.page_views || 0)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 6)

    const topCountries = Object.entries(
      rows.reduce((acc: Record<string, number>, r) => {
        acc[r.country] = (acc[r.country] || 0) + (r.active_28_day_users || 0)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // ── 4. Ads aggregations ──────────────────────────────────────
    const adsTotalSpend       = ads.reduce((s, r) => s + Number(r.cost), 0)
    const adsTotalClicks      = ads.reduce((s, r) => s + Number(r.clicks), 0)
    const adsTotalImpressions = ads.reduce((s, r) => s + Number(r.impressions), 0)
    const adsOverallCtr       = adsTotalImpressions > 0 ? (adsTotalClicks / adsTotalImpressions * 100) : 0
    const adsOverallCpc       = adsTotalClicks > 0 ? adsTotalSpend / adsTotalClicks : 0
    const adsCostPerLead      = totalLeads > 0 ? adsTotalSpend / totalLeads : 0
    const enabledCampaigns    = ads.filter(r => r.campaign_status === 'ENABLED')
    const pausedCampaigns     = ads.filter(r => r.campaign_status === 'PAUSED')

    const topAdsBySpend = ads
      .filter(r => Number(r.cost) > 0).slice(0, 3)
      .map(r => `${r.campaign_name}(${r.campaign_status},$${Number(r.cost).toFixed(0)},${r.advertising_channel_type})`)

    const channelBreakdown = Object.entries(
      ads.reduce((acc: Record<string, number>, r) => {
        acc[r.advertising_channel_type] = (acc[r.advertising_channel_type] || 0) + Number(r.cost)
        return acc
      }, {})
    ).sort((a, b) => b[1] - a[1]).map(([ch, cost]) => `${ch}:$${cost.toFixed(0)}`)

    const snapshot = {
      totalPageViews, totalUsers28, totalActiveToday, totalEvents, totalLeads,
      topPages, topCountries,
      ads: { adsTotalSpend, adsTotalClicks, adsTotalImpressions, adsOverallCtr, adsOverallCpc, adsCostPerLead },
    }

    // ── 5. Build prompt ──────────────────────────────────────────
    const adsLine = ads.length > 0
      ? `\nADS: spend=$${adsTotalSpend.toFixed(0)} clicks=${adsTotalClicks} impr=${adsTotalImpressions} CTR=${adsOverallCtr.toFixed(2)}% CPC=$${adsOverallCpc.toFixed(2)} CPL=$${adsCostPerLead.toFixed(0)} active=${enabledCampaigns.length} paused=${pausedCampaigns.length} channels=${channelBreakdown.join('|')} top=${topAdsBySpend.join('|')}`
      : '\nADS: no data'

    const prompt = `Analyze irfaninvest.com — Oman luxury real estate (ITC/freehold, UK/UAE/Qatar buyers).
GA4: ${rows[rows.length - 1]?.date} to ${rows[0]?.date} | views=${totalPageViews} users28d=${totalUsers28} today=${totalActiveToday} events=${totalEvents} leads=${totalLeads}
pages=${topPages.map(([p, v]) => `${p}:${v}`).join(',')}
countries=${topCountries.map(([c, u]) => `${c}:${u}`).join(',')}${adsLine}

Reply ONLY with valid JSON (no markdown, no backticks):
{"summary":"2-3 sentences","score":0,"topInsights":[{"title":"","detail":"","impact":"high"}],"seoRecommendations":[{"title":"","detail":"","priority":"high"}],"geographicOpportunities":"2 sentences","contentGaps":[{"topic":"","reason":""}],"priorityActions":[{"action":"","timeframe":"1 week","impact":"high"}],"metrics":{"conversionRate":0,"engagementScore":0,"internationalTraffic":0},"adsAnalysis":{"overallAssessment":"2 sentences","budgetEfficiency":"medium","topPerformingCampaign":"","weakestCampaign":"","recommendations":[{"title":"","detail":"","priority":"high"}],"costPerLeadAssessment":"1 sentence"}}`

    // ── 6. Call Claude ───────────────────────────────────────────
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1600,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0]?.type === 'text' ? message.content[0].text : ''
    console.log('Claude raw length:', rawText.length)

    const analysis = parseJSON(rawText) ?? {
      summary: rawText.slice(0, 200) || 'Analysis unavailable.',
      score: 0,
      topInsights: [],
      seoRecommendations: [],
      geographicOpportunities: '',
      contentGaps: [],
      priorityActions: [],
      metrics: { conversionRate: 0, engagementScore: 0, internationalTraffic: 0 },
    }

    // ── 7. Save to cache (non-fatal) ─────────────────────────────
    try {
      await analyticsDb.from('analytics_insights').insert({
        analysis_json: analysis,
        snapshot_json: snapshot,
      })
    } catch (insertErr) {
      console.error('Cache insert failed (non-fatal):', insertErr)
    }

    return NextResponse.json({
      analysis,
      snapshot,
      lastUpdated: new Date().toISOString(),
      cached: false,
    })

  } catch (err) {
    console.error('Analyze route error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
