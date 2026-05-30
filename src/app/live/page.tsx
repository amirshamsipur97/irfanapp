'use client'

import { useEffect, useState, useCallback } from 'react'

interface RealtimeResp {
  configured: boolean
  error?: string
  active_users_now?: number
  by_page?: Record<string, string | number>[]
  by_country?: Record<string, string | number>[]
  by_device?: Record<string, string | number>[]
}
interface ReportResp {
  configured: boolean
  error?: string
  range_days?: number
  totals?: { page_views: number; users: number; sessions: number; key_events: number; engagement_rate: number; avg_session_duration: number }
  timeseries?: Record<string, number | string>[]
  pages?: Record<string, string | number | boolean>[]
  sections?: { section: string; page_views: number; users: number; sessions: number; key_events: number; legacy: boolean }[]
  devices?: Record<string, string | number>[]
  channels?: Record<string, string | number>[]
}

const n = (v: unknown) => Number(v ?? 0).toLocaleString('en-US')
const dur = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
const pct = (r: number) => `${(r * 100).toFixed(1)}%`

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}>{children}</div>
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <div className="text-[10px] uppercase tracking-[0.15em] font-semibold text-white/40">{label}</div>
      <div className="mt-1 text-2xl font-bold text-white tabular-nums">{value}</div>
    </Card>
  )
}

function SetupGuide() {
  return (
    <Card className="max-w-3xl">
      <h2 className="text-lg font-semibold text-white mb-2">Connect GA4 (direct access)</h2>
      <p className="text-white/50 text-sm mb-4">
        Give this dashboard read-only access to GA4 so it can pull any metric live + realtime, independent of n8n.
      </p>
      <ol className="list-decimal list-inside space-y-2 text-sm text-white/70">
        <li>Google Cloud Console → create a <strong>Service Account</strong> (or reuse one).</li>
        <li>Enable the <strong>Google Analytics Data API</strong> for that project.</li>
        <li>Create a <strong>JSON key</strong> for the service account and download it.</li>
        <li>GA4 → Admin → Property → <strong>Property Access Management</strong> → add the service-account email with the <strong>Viewer</strong> role.</li>
        <li>Add these env vars in Vercel (and <code>.env.local</code>), then redeploy:
          <pre className="mt-2 rounded-lg bg-black/60 border border-white/10 p-3 text-[11px] text-white/60 overflow-x-auto">{`GA4_PROPERTY_ID=519295313
GA4_CLIENT_EMAIL=<name>@<project>.iam.gserviceaccount.com
GA4_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`}</pre>
        </li>
      </ol>
    </Card>
  )
}

export default function LivePage() {
  const [rt, setRt] = useState<RealtimeResp | null>(null)
  const [rep, setRep] = useState<ReportResp | null>(null)
  const [loaded, setLoaded] = useState(false)

  const loadRealtime = useCallback(() => {
    fetch('/api/ga4/realtime').then(r => r.json()).then(setRt).catch(() => {})
  }, [])
  const loadReport = useCallback(() => {
    fetch('/api/ga4/report?days=28').then(r => r.json()).then(setRep).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  useEffect(() => {
    loadRealtime(); loadReport()
    const a = setInterval(loadRealtime, 15_000)  // realtime → 15s
    const b = setInterval(loadReport, 60_000)    // historical → 60s
    return () => { clearInterval(a); clearInterval(b) }
  }, [loadRealtime, loadReport])

  if (!loaded) {
    return <main className="min-h-screen bg-black text-white/50 flex items-center justify-center">Loading GA4…</main>
  }

  const notConfigured = rep?.configured === false || rt?.configured === false
  if (notConfigured) {
    return (
      <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold tracking-tight mb-6">Live Analytics — GA4</h1>
          <SetupGuide />
        </div>
      </main>
    )
  }

  const totals = rep?.totals
  return (
    <main className="min-h-screen bg-black text-white px-4 md:px-8 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Live Analytics — GA4</h1>
            <p className="text-white/40 text-sm mt-1">Direct GA4 Data + Realtime API · last {rep?.range_days ?? 28} days</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
            </span>
            <span className="text-emerald-300 text-sm font-semibold tabular-nums">{n(rt?.active_users_now)}</span>
            <span className="text-emerald-300/70 text-xs">active now</span>
          </div>
        </header>

        {(rt?.error || rep?.error) && (
          <Card className="border-red-500/30 bg-red-500/10 text-red-200 text-sm">
            GA4 API error: {rt?.error || rep?.error}
          </Card>
        )}

        {/* Realtime breakdown */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Active now · by page</h3>
            <ul className="space-y-1.5 text-sm">
              {(rt?.by_page ?? []).slice(0, 8).map((r, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-white/70 truncate">{String(r.unifiedScreenName || '—')}</span>
                  <span className="text-white/90 tabular-nums">{n(r.activeUsers)}</span>
                </li>
              ))}
              {!rt?.by_page?.length && <li className="text-white/30">No active users right now</li>}
            </ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-3">Active now · by country</h3>
            <ul className="space-y-1.5 text-sm">
              {(rt?.by_country ?? []).slice(0, 8).map((r, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-white/70 truncate">{String(r.country || '—')}</span>
                  <span className="text-white/90 tabular-nums">{n(r.activeUsers)}</span>
                </li>
              ))}
              {!rt?.by_country?.length && <li className="text-white/30">—</li>}
            </ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-3">Active now · by device</h3>
            <ul className="space-y-1.5 text-sm">
              {(rt?.by_device ?? []).map((r, i) => (
                <li key={i} className="flex justify-between gap-3 capitalize">
                  <span className="text-white/70">{String(r.deviceCategory || '—')}</span>
                  <span className="text-white/90 tabular-nums">{n(r.activeUsers)}</span>
                </li>
              ))}
              {!rt?.by_device?.length && <li className="text-white/30">—</li>}
            </ul>
          </Card>
        </section>

        {/* Totals */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Stat label="Page views" value={n(totals?.page_views)} />
          <Stat label="Users" value={n(totals?.users)} />
          <Stat label="Sessions" value={n(totals?.sessions)} />
          <Stat label="Key events" value={n(totals?.key_events)} />
          <Stat label="Engagement" value={pct(totals?.engagement_rate ?? 0)} />
          <Stat label="Avg. session" value={dur(totals?.avg_session_duration ?? 0)} />
        </section>

        {/* Sections — grouped by the NEW site map */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">By site section <span className="text-white/30 font-normal">· new site map</span></h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(rep?.sections ?? []).map((s, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">{s.section}</span>
                  {s.legacy && <span className="rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">legacy</span>}
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums">{n(s.page_views)} <span className="text-white/30 text-xs font-normal">views</span></div>
                <div className="text-white/40 text-[11px] tabular-nums">{n(s.users)} users · {n(s.sessions)} sessions</div>
              </div>
            ))}
            {!rep?.sections?.length && <div className="text-white/30 text-sm">No page data in range.</div>}
          </div>
        </Card>

        {/* Top pages — full paths */}
        <Card>
          <h3 className="text-sm font-semibold mb-3">Top pages</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-[10px] uppercase tracking-[0.12em]">
                  <th className="text-left font-semibold py-2 pr-3">Page</th>
                  <th className="text-right font-semibold py-2 px-3">Views</th>
                  <th className="text-right font-semibold py-2 px-3">Users</th>
                  <th className="text-right font-semibold py-2 px-3">Sessions</th>
                  <th className="text-right font-semibold py-2 px-3">Avg. time</th>
                  <th className="text-right font-semibold py-2 px-3">Bounce</th>
                  <th className="text-right font-semibold py-2 pl-3">Leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(rep?.pages ?? []).map((p, i) => (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white/90 font-medium">{String(p.pagePath || '/')}</span>
                        <span className="rounded bg-white/5 text-white/50 border border-white/10 px-1.5 py-0.5 text-[9px]">{String(p.section || 'Other')}</span>
                        {p.is_legacy === true && <span className="rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[9px] uppercase tracking-wider">legacy</span>}
                      </div>
                      <div className="text-white/30 text-[11px] truncate max-w-[420px]">{String(p.pageTitle || '')}</div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{n(p.screenPageViews)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{n(p.totalUsers)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{n(p.sessions)}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-white/60">{dur(Number(p.averageSessionDuration ?? 0))}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-white/60">{pct(Number(p.bounceRate ?? 0))}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{n(p.keyEvents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Devices + channels */}
        <section className="grid md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold mb-3">Devices</h3>
            <ul className="space-y-1.5 text-sm">
              {(rep?.devices ?? []).map((d, i) => (
                <li key={i} className="flex justify-between gap-3 capitalize">
                  <span className="text-white/70">{String(d.deviceCategory || '—')}</span>
                  <span className="text-white/90 tabular-nums">{n(d.totalUsers)} users · {n(d.sessions)} sessions</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold mb-3">Acquisition · channel / source</h3>
            <ul className="space-y-1.5 text-sm">
              {(rep?.channels ?? []).slice(0, 10).map((c, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-white/70 truncate">{String(c.sessionDefaultChannelGroup || '—')} · {String(c.sessionSource || '')}</span>
                  <span className="text-white/90 tabular-nums">{n(c.totalUsers)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </main>
  )
}
