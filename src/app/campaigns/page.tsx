'use client'

import { useEffect, useState } from 'react'

interface UnifiedRow {
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

interface Diagnostics {
  total_unified: number
  matched: number
  ads_only: number
  ga4_only: number
  unmatched_ads_campaigns: { campaign_id: string; campaign_name: string }[]
  unmatched_ga4_campaigns: { campaign_id: string; campaign_name: string }[]
  missing_campaign_ids: { source: string; campaign_name: string }[]
  missing_conversions_campaigns: { campaign_id: string; campaign_name: string }[]
}

interface CampaignsResponse {
  generated_at: string
  ga4_campaign_data_available: boolean
  rows: UnifiedRow[]
  diagnostics: Diagnostics
}

const fmtInt = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'))
const fmtMoney = (n: number | null) =>
  n == null ? '—' : `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtPct = (ratio: number) => `${(ratio * 100).toFixed(2)}%`

const STATUS_STYLE: Record<UnifiedRow['match_status'], string> = {
  matched: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  matched_by_name: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ads_only: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  ga4_only: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-white/40">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  )
}

export default function CampaignsPage() {
  const [data, setData] = useState<CampaignsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/campaigns')
      .then(r => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d) })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <main className="min-h-screen bg-black text-white/60 flex items-center justify-center">Loading unified campaigns…</main>
  }
  if (error) {
    return <main className="min-h-screen bg-black text-red-300 flex items-center justify-center p-8">Error: {error}</main>
  }
  if (!data) return null

  const { rows, diagnostics: d } = data

  return (
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Campaigns — Ads × GA4</h1>
          <p className="text-white/40 text-sm mt-1">
            Unified per-campaign view. Generated {new Date(data.generated_at).toLocaleString()}.
          </p>
        </header>

        {/* GA4-side readiness banner */}
        {!data.ga4_campaign_data_available && (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <strong>GA4 campaign data not flowing yet.</strong> Users / sessions / leads / cost-per-lead are blank
            until the n8n GA4 step is switched to request campaign dimensions
            (<code>sessionCampaignName</code> / <code>sessionGoogleAdsCampaignId</code>) and posts to{' '}
            <code>/api/webhook/ga4-campaigns</code>. The Google Ads side below is live now.
          </div>
        )}

        {/* Data-health (mapping diagnostics) */}
        <section className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Unified rows" value={d.total_unified} />
          <StatCard label="Matched" value={d.matched} accent="text-emerald-300" />
          <StatCard label="Ads only" value={d.ads_only} accent="text-sky-300" />
          <StatCard label="GA4 only" value={d.ga4_only} accent="text-fuchsia-300" />
          <StatCard label="Missing conversions" value={d.missing_conversions_campaigns.length} accent="text-red-300" />
        </section>

        {(d.missing_campaign_ids.length > 0 || d.unmatched_ads_campaigns.length > 0) && (
          <details className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm">
            <summary className="cursor-pointer text-white/70 font-medium">
              Mapping log — {d.missing_campaign_ids.length} missing IDs, {d.unmatched_ads_campaigns.length} unmatched Ads, {d.unmatched_ga4_campaigns.length} unmatched GA4
            </summary>
            <div className="mt-3 grid md:grid-cols-3 gap-4 text-white/50">
              <div>
                <div className="text-white/40 uppercase text-[10px] tracking-widest mb-1">Missing campaign IDs</div>
                {d.missing_campaign_ids.length ? d.missing_campaign_ids.map((c, i) => (
                  <div key={i}>{c.source}: {c.campaign_name || '(blank)'}</div>
                )) : <div>None</div>}
              </div>
              <div>
                <div className="text-white/40 uppercase text-[10px] tracking-widest mb-1">Unmatched Ads campaigns</div>
                {d.unmatched_ads_campaigns.length ? d.unmatched_ads_campaigns.map((c, i) => (
                  <div key={i}>{c.campaign_name} ({c.campaign_id})</div>
                )) : <div>None</div>}
              </div>
              <div>
                <div className="text-white/40 uppercase text-[10px] tracking-widest mb-1">Unmatched GA4 campaigns</div>
                {d.unmatched_ga4_campaigns.length ? d.unmatched_ga4_campaigns.map((c, i) => (
                  <div key={i}>{c.campaign_name} ({c.campaign_id || 'no id'})</div>
                )) : <div>None</div>}
              </div>
            </div>
          </details>
        )}

        {/* Unified table */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/40 text-[10px] uppercase tracking-[0.12em] bg-white/[0.03]">
                <th className="text-left font-semibold px-3 py-3">Campaign</th>
                <th className="text-right font-semibold px-3 py-3">Impr.</th>
                <th className="text-right font-semibold px-3 py-3">Clicks</th>
                <th className="text-right font-semibold px-3 py-3">CTR</th>
                <th className="text-right font-semibold px-3 py-3">Cost</th>
                <th className="text-right font-semibold px-3 py-3">Conv.</th>
                <th className="text-right font-semibold px-3 py-3">Users</th>
                <th className="text-right font-semibold px-3 py-3">Sessions</th>
                <th className="text-right font-semibold px-3 py-3">Leads</th>
                <th className="text-right font-semibold px-3 py-3">Cost / Lead</th>
                <th className="text-left font-semibold px-3 py-3">Match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r, i) => (
                <tr key={`${r.campaign_id}-${i}`} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-white/90">{r.campaign_name || '(unnamed)'}</div>
                    <div className="text-white/30 text-[11px]">{r.campaign_id || 'no id'}{r.source ? ` · ${r.source}` : ''}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.impressions)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.clicks)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{fmtPct(r.ctr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtMoney(r.cost)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.conversions)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.users)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.sessions)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(r.leads)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.cost_per_lead == null ? '—' : fmtMoney(r.cost_per_lead)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block rounded-md border px-2 py-0.5 text-[10px] ${STATUS_STYLE[r.match_status]}`}>
                      {r.match_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="text-white/40 text-center py-10">No campaign data yet.</div>
        )}
      </div>
    </main>
  )
}
