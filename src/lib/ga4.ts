import { BetaAnalyticsDataClient } from '@google-analytics/data'

// ──────────────────────────────────────────────────────────────────────────
// Direct GA4 Data API + Realtime API access for the dashboard.
//
// Auth: a Google Cloud service account that has been granted "Viewer" on the
// GA4 property. Set these env vars (Vercel + .env.local):
//   GA4_PROPERTY_ID   = 519295313
//   GA4_CLIENT_EMAIL  = <name>@<project>.iam.gserviceaccount.com
//   GA4_PRIVATE_KEY   = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
// (Vercel stores the key with literal "\n" — we convert them to real newlines.)
//
// This is independent of the n8n pipeline: it reads live from GA4 on demand,
// so it supports any dimension/metric and true realtime active users.
// ──────────────────────────────────────────────────────────────────────────

const propertyId = process.env.GA4_PROPERTY_ID
const clientEmail = process.env.GA4_CLIENT_EMAIL
const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"|"$/g, '')

export const ga4Configured = Boolean(propertyId && clientEmail && privateKey)
export const GA4_PROPERTY = `properties/${propertyId}`

let cached: BetaAnalyticsDataClient | null = null

export function ga4Client(): BetaAnalyticsDataClient | null {
  if (!ga4Configured) return null
  if (!cached) {
    cached = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail!, private_key: privateKey! },
    })
  }
  return cached
}

/** Shape rows from a runReport response into objects keyed by header name. */
export function rowsToObjects(
  resp: { dimensionHeaders?: { name?: string | null }[] | null;
          metricHeaders?: { name?: string | null }[] | null;
          rows?: { dimensionValues?: ({ value?: string | null } | null)[] | null;
                   metricValues?: ({ value?: string | null } | null)[] | null }[] | null },
): Record<string, string | number>[] {
  const dims = (resp.dimensionHeaders ?? []).map(h => h?.name ?? '')
  const mets = (resp.metricHeaders ?? []).map(h => h?.name ?? '')
  return (resp.rows ?? []).map(r => {
    const o: Record<string, string | number> = {}
    dims.forEach((d, i) => { o[d] = r.dimensionValues?.[i]?.value ?? '' })
    mets.forEach((m, i) => { o[m] = Number(r.metricValues?.[i]?.value ?? 0) })
    return o
  })
}
