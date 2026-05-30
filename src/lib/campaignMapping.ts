// ──────────────────────────────────────────────────────────────────────────
// Campaign mapping — unify Google Ads + GA4 (campaign-attributed) data.
//
// WHY a code-side merge (not only the SQL `campaign_unified` view): we also
// need the join *diagnostics* (unmatched campaigns / missing ids / missing
// conversions) for the dashboard's data-health panel, and a name-based
// fallback that the strict id-join in SQL can't express cleanly.
//
// Matching strategy (see /api/campaigns):
//   1. Primary key  → campaign_id  (campaign NAMES are not unique — e.g. two
//      different ids are both named "Oman Properties", so id must win).
//   2. Fallback key → normalized campaign_name, for GA4 rows that only carry
//      the campaign name (no sessionGoogleAdsCampaignId).
//
// Note: until the n8n Ads node is switched to per-day rows (segments.date),
// Ads data is campaign-level aggregate (date = "DAILY"/"CUSTOM_PERIOD"), so
// this merge is a per-campaign rollup. Once Ads sends real dates this same
// logic keys on (date + campaign) without changes to the dashboard.
// ──────────────────────────────────────────────────────────────────────────

export interface AdsRow {
  date: string
  campaign_id: string
  campaign_name: string
  campaign_status?: string
  clicks: number
  impressions: number
  cost: number
  ctr: number
  average_cpc?: number
  conversions?: number
}

export interface Ga4CampaignRow {
  date: string
  campaign_id: string
  campaign_name: string
  source?: string
  users: number
  sessions: number
  leads: number
  conversions?: number
}

export interface UnifiedRow {
  date: string
  campaign_name: string
  campaign_id: string
  impressions: number
  clicks: number
  ctr: number
  cost: number
  conversions: number
  users: number | null
  sessions: number | null
  leads: number | null
  source: string | null
  cost_per_lead: number | null
  match_status: 'matched' | 'matched_by_name' | 'ads_only' | 'ga4_only'
}

export interface MappingDiagnostics {
  total_unified: number
  matched: number
  ads_only: number
  ga4_only: number
  unmatched_ads_campaigns: { campaign_id: string; campaign_name: string }[]
  unmatched_ga4_campaigns: { campaign_id: string; campaign_name: string }[]
  missing_campaign_ids: { source: 'google_ads' | 'ga4'; campaign_name: string }[]
  missing_conversions_campaigns: { campaign_id: string; campaign_name: string }[]
}

const NOT_SET = new Set(['', '(not set)', '(not provided)', 'null', 'undefined'])

/** lowercase + trim + collapse internal whitespace; '' when effectively empty. */
export function normalizeCampaignName(name: string | null | undefined): string {
  const n = (name ?? '').toLowerCase().trim().replace(/\s+/g, ' ')
  return NOT_SET.has(n) ? '' : n
}

export function isValidId(id: string | null | undefined): boolean {
  const v = (id ?? '').trim().toLowerCase()
  return v.length > 0 && !NOT_SET.has(v)
}

interface GaAgg {
  campaign_id: string
  campaign_name: string
  source: string
  users: number
  sessions: number
  leads: number
  conversions: number
  consumed: boolean
}

function emptyAgg(row: Ga4CampaignRow): GaAgg {
  return {
    campaign_id: row.campaign_id ?? '',
    campaign_name: row.campaign_name ?? '',
    source: row.source ?? '',
    users: 0, sessions: 0, leads: 0, conversions: 0, consumed: false,
  }
}

/**
 * Merge Ads + GA4-campaign rows into unified per-campaign records plus join
 * diagnostics. Pure + deterministic so it is easy to unit-test.
 */
export function mergeCampaigns(
  adsRows: AdsRow[],
  gaRows: Ga4CampaignRow[],
): { rows: UnifiedRow[]; diagnostics: MappingDiagnostics } {
  // Roll GA4 campaign rows up per campaign, indexed by id AND by normalized name.
  const gaById = new Map<string, GaAgg>()
  const gaByName = new Map<string, GaAgg>()

  for (const g of gaRows) {
    const idKey = isValidId(g.campaign_id) ? g.campaign_id.trim() : ''
    const nameKey = normalizeCampaignName(g.campaign_name)
    // Prefer a single shared aggregate so id- and name-lookups hit the same object.
    let agg = (idKey && gaById.get(idKey)) || (nameKey && gaByName.get(nameKey)) || null
    if (!agg) {
      agg = emptyAgg(g)
      if (idKey) gaById.set(idKey, agg)
      if (nameKey) gaByName.set(nameKey, agg)
    } else {
      if (idKey && !gaById.has(idKey)) gaById.set(idKey, agg)
      if (nameKey && !gaByName.has(nameKey)) gaByName.set(nameKey, agg)
    }
    agg.users += Number(g.users) || 0
    agg.sessions += Number(g.sessions) || 0
    agg.leads += Number(g.leads) || 0
    agg.conversions += Number(g.conversions) || 0
    if (!agg.source && g.source) agg.source = g.source
    if (!agg.campaign_id && idKey) agg.campaign_id = idKey
  }

  const rows: UnifiedRow[] = []
  const diag: MappingDiagnostics = {
    total_unified: 0, matched: 0, ads_only: 0, ga4_only: 0,
    unmatched_ads_campaigns: [], unmatched_ga4_campaigns: [],
    missing_campaign_ids: [], missing_conversions_campaigns: [],
  }

  for (const a of adsRows) {
    const idKey = isValidId(a.campaign_id) ? a.campaign_id.trim() : ''
    const nameKey = normalizeCampaignName(a.campaign_name)

    if (!idKey) {
      diag.missing_campaign_ids.push({ source: 'google_ads', campaign_name: a.campaign_name })
    }
    if (a.conversions == null) {
      diag.missing_conversions_campaigns.push({ campaign_id: a.campaign_id, campaign_name: a.campaign_name })
    }

    const byId = idKey ? gaById.get(idKey) : undefined
    const byName = !byId && nameKey ? gaByName.get(nameKey) : undefined
    const ga = byId ?? byName
    let status: UnifiedRow['match_status']
    if (ga) {
      ga.consumed = true
      status = byId ? 'matched' : 'matched_by_name'
      diag.matched++
    } else {
      status = 'ads_only'
      diag.ads_only++
      diag.unmatched_ads_campaigns.push({ campaign_id: a.campaign_id, campaign_name: a.campaign_name })
    }

    const cost = Number(a.cost) || 0
    const leads = ga ? ga.leads : null
    rows.push({
      date: a.date,
      campaign_name: a.campaign_name,
      campaign_id: a.campaign_id,
      impressions: Number(a.impressions) || 0,
      clicks: Number(a.clicks) || 0,
      ctr: Number(a.ctr) || 0,
      cost,
      conversions: Number(a.conversions) || 0,
      users: ga ? ga.users : null,
      sessions: ga ? ga.sessions : null,
      leads,
      source: ga ? ga.source || 'google_ads' : null,
      cost_per_lead: leads && leads > 0 ? Math.round((cost / leads) * 1000) / 1000 : null,
      match_status: status,
    })
  }

  // GA4 campaigns that were never matched by any Ads row → ga4_only.
  const seen = new Set<GaAgg>()
  for (const agg of [...gaById.values(), ...gaByName.values()]) {
    if (seen.has(agg) || agg.consumed) continue
    seen.add(agg)
    diag.ga4_only++
    diag.unmatched_ga4_campaigns.push({ campaign_id: agg.campaign_id, campaign_name: agg.campaign_name })
    if (!isValidId(agg.campaign_id)) {
      diag.missing_campaign_ids.push({ source: 'ga4', campaign_name: agg.campaign_name })
    }
    rows.push({
      date: 'ROLLUP',
      campaign_name: agg.campaign_name,
      campaign_id: agg.campaign_id,
      impressions: 0, clicks: 0, ctr: 0, cost: 0, conversions: 0,
      users: agg.users, sessions: agg.sessions, leads: agg.leads,
      source: agg.source || 'organic',
      cost_per_lead: null,
      match_status: 'ga4_only',
    })
  }

  diag.total_unified = rows.length
  return { rows, diagnostics: diag }
}
