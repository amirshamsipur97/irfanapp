import { NextResponse } from 'next/server'
import { ga4Client, ga4Configured, GA4_PROPERTY, rowsToObjects } from '@/lib/ga4'

export const dynamic = 'force-dynamic'

/** True realtime: active users in the last 30 minutes, broken down by page,
 *  country and device. Powers the "LIVE" widget (poll every ~15s). */
export async function GET() {
  if (!ga4Configured) {
    return NextResponse.json({ configured: false }, { status: 200 })
  }
  const client = ga4Client()!

  try {
    const [byPage, byCountry, byDevice, total] = await Promise.all([
      client.runRealtimeReport({
        property: GA4_PROPERTY,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 15,
      }),
      client.runRealtimeReport({
        property: GA4_PROPERTY,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 10,
      }),
      client.runRealtimeReport({
        property: GA4_PROPERTY,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
      }),
      client.runRealtimeReport({
        property: GA4_PROPERTY,
        metrics: [{ name: 'activeUsers' }],
      }),
    ])

    return NextResponse.json({
      configured: true,
      generated_at: new Date().toISOString(),
      active_users_now: Number(total[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0),
      by_page: rowsToObjects(byPage[0]),
      by_country: rowsToObjects(byCountry[0]),
      by_device: rowsToObjects(byDevice[0]),
    })
  } catch (e) {
    return NextResponse.json(
      { configured: true, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
