import { NextRequest, NextResponse } from 'next/server'
import { ga4Client, ga4Configured, GA4_PROPERTY, rowsToObjects } from '@/lib/ga4'
import { categorizePath } from '@/lib/siteMap'

export const dynamic = 'force-dynamic'

/**
 * Rich historical GA4 report — everything the dashboard needs in one call:
 * totals, daily timeseries, top pages (full path + title + sessions + bounce +
 * avg duration), device split, and acquisition channels/sources.
 *
 * Query: ?days=28 (default 28; GA4 "NdaysAgo" .. "today").
 */
export async function GET(req: NextRequest) {
  if (!ga4Configured) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }
  const client = ga4Client()!
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 28, 1), 365)
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }]

  try {
    const [totals, timeseries, pages, devices, channels] = await Promise.all([
      client.runReport({
        property: GA4_PROPERTY, dateRanges,
        metrics: [
          { name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' },
          { name: 'keyEvents' }, { name: 'engagementRate' }, { name: 'averageSessionDuration' },
        ],
      }),
      client.runReport({
        property: GA4_PROPERTY, dateRanges,
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ dimension: { dimensionName: 'date' } }],
      }),
      client.runReport({
        property: GA4_PROPERTY, dateRanges,
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        metrics: [
          { name: 'screenPageViews' }, { name: 'totalUsers' }, { name: 'sessions' },
          { name: 'averageSessionDuration' }, { name: 'bounceRate' }, { name: 'keyEvents' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 50,
      }),
      client.runReport({
        property: GA4_PROPERTY, dateRanges,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
      }),
      client.runReport({
        property: GA4_PROPERTY, dateRanges,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }, { name: 'sessionSource' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'keyEvents' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 20,
      }),
    ])

    const t = totals[0]?.rows?.[0]?.metricValues ?? []

    // Categorize every page by the NEW site map (not the old Webflow structure)
    // and roll metrics up per section.
    const pageRows = rowsToObjects(pages[0]).map(p => {
      const cat = categorizePath(String(p.pagePath ?? '/'))
      return { ...p, section: cat.section, section_label: cat.label, is_legacy: cat.isLegacy }
    })
    const sectionMap = new Map<string, { section: string; page_views: number; users: number; sessions: number; key_events: number; legacy: boolean }>()
    for (const p of pageRows) {
      const m = p as unknown as Record<string, number>
      const s = sectionMap.get(p.section) ?? { section: p.section, page_views: 0, users: 0, sessions: 0, key_events: 0, legacy: true }
      s.page_views += Number(m.screenPageViews) || 0
      s.users += Number(m.totalUsers) || 0
      s.sessions += Number(m.sessions) || 0
      s.key_events += Number(m.keyEvents) || 0
      if (!p.is_legacy) s.legacy = false  // section is legacy only if ALL its pages are legacy
      sectionMap.set(p.section, s)
    }
    const sections = [...sectionMap.values()].sort((a, b) => b.page_views - a.page_views)

    return NextResponse.json({
      configured: true,
      generated_at: new Date().toISOString(),
      range_days: days,
      totals: {
        page_views: Number(t[0]?.value ?? 0),
        users: Number(t[1]?.value ?? 0),
        sessions: Number(t[2]?.value ?? 0),
        key_events: Number(t[3]?.value ?? 0),
        engagement_rate: Number(t[4]?.value ?? 0),
        avg_session_duration: Number(t[5]?.value ?? 0),
      },
      timeseries: rowsToObjects(timeseries[0]),
      pages: pageRows,
      sections,
      devices: rowsToObjects(devices[0]),
      channels: rowsToObjects(channels[0]),
    })
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
