import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'
import { mergeCampaigns, type AdsRow, type Ga4CampaignRow } from '@/lib/campaignMapping'

/**
 * Unified campaign view: Google Ads × GA4 (campaign-attributed), joined on
 * campaign_id with a normalized-campaign-name fallback. Returns the unified
 * rows plus join diagnostics (unmatched campaigns / missing ids / missing
 * conversions) so the dashboard can surface data-health issues.
 */
export async function GET() {
  const [adsResult, gaResult] = await Promise.all([
    analyticsDb
      .from('google_ads_campaign_data')
      .select('date, campaign_id, campaign_name, campaign_status, clicks, impressions, cost, ctr, average_cpc, conversions')
      .order('cost', { ascending: false })
      .limit(500),
    analyticsDb
      .from('analytics_ga4_campaign')
      .select('date, campaign_id, campaign_name, source, users, sessions, leads, conversions')
      .limit(2000),
  ])

  if (adsResult.error) {
    return NextResponse.json({ error: `ads: ${adsResult.error.message}` }, { status: 500 })
  }
  // analytics_ga4_campaign may not have data yet (n8n change pending) — treat
  // an error/empty as simply "no GA4 campaign data" rather than failing.
  const gaRows = (gaResult.error ? [] : gaResult.data ?? []) as Ga4CampaignRow[]
  const adsRows = (adsResult.data ?? []) as AdsRow[]

  const { rows, diagnostics } = mergeCampaigns(adsRows, gaRows)

  // Server-side log so issues are visible in Vercel logs, not only the UI.
  if (diagnostics.unmatched_ads_campaigns.length || diagnostics.ga4_only ||
      diagnostics.missing_conversions_campaigns.length) {
    console.warn('[campaign-mapping] diagnostics', {
      matched: diagnostics.matched,
      ads_only: diagnostics.ads_only,
      ga4_only: diagnostics.ga4_only,
      missing_ids: diagnostics.missing_campaign_ids.length,
      missing_conversions: diagnostics.missing_conversions_campaigns.length,
    })
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    ga4_campaign_data_available: gaRows.length > 0,
    rows,
    diagnostics,
  })
}
