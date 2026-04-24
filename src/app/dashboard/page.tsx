'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

interface GA4Row {
  date: string
  country: string
  city: string
  page_location: string
  active_28_day_users: number
  active_1_day_users: number
  total_users: number
  page_views: number
  screen_page_views: number
  event_count: number
  sessions_per_user: number
  checkouts: number
  generate_lead_events: number
  synced_at?: string
}

interface GA4Store { lastUpdated: string; rows: GA4Row[] }
interface Analysis {
  summary: string
  topInsights: string[]
  seoRecommendations: string[]
  geographicOpportunities: string
  contentGaps: string[]
  priorityActions: string[]
}

const GOLD = '#c9a84c'
const GOLD_LIGHT = '#e8c97e'
const BLUE = '#3b82f6'
const TEAL = '#0d9488'
const PIE_COLORS = [GOLD, BLUE, TEAL, '#8b5cf6', '#f43f5e']

const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString()

function KpiCard({ label, value, sub, color = 'text-gold' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5 flex flex-col gap-1">
      <p className="text-[#8a9bbf] text-xs uppercase tracking-widest font-medium">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[#8a9bbf] text-xs mt-1">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number}[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#0a0f1a] border border-[#1e2d4a] rounded-xl p-3 text-sm shadow-xl">
      <p className="text-[#8a9bbf] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.name === 'pageViews' ? GOLD : BLUE }} className="font-semibold">
          {p.name === 'pageViews' ? 'Page Views' : 'Active Users'}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [store, setStore] = useState<GA4Store | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [tab, setTab] = useState<'overview' | 'pages' | 'geo' | 'ai'>('overview')

  const loadData = () =>
    fetch('/api/data').then(r => r.json()).then((d: GA4Store) => setStore(d))

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const runAnalysis = async () => {
    setLoadingAnalysis(true)
    setTab('ai')
    const res = await fetch('/api/analyze')
    const data = await res.json()
    setAnalysis(data.analysis)
    setLoadingAnalysis(false)
  }

  if (!store) return (
    <div className="flex items-center justify-center h-screen bg-[#0a0f1a]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#8a9bbf] text-sm">Loading analytics…</p>
      </div>
    </div>
  )

  const rows = store.rows
  const hasData = rows.length > 0

  // ── Aggregations ──────────────────────────────────────────────
  const totalViews = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers28 = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
  const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents = rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

  // By date (for area chart)
  const byDate = Object.entries(
    rows.reduce((acc: Record<string, { pageViews: number; users: number }>, r) => {
      const d = r.date.slice(5)
      if (!acc[d]) acc[d] = { pageViews: 0, users: 0 }
      acc[d].pageViews += r.screen_page_views || r.page_views || 0
      acc[d].users += r.active_1_day_users || 0
      return acc
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))

  // Top pages
  const topPages = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      const p = (r.page_location || '').replace('https://irfaninvest.com', '') || '/'
      acc[p] = (acc[p] || 0) + (r.screen_page_views || r.page_views || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([page, views]) => ({
    page: page.length > 35 ? page.slice(0, 35) + '…' : page,
    views,
  }))

  // Countries
  const countries = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.country] = (acc[r.country] || 0) + (r.active_28_day_users || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

  const totalCountryUsers = countries.reduce((s, c) => s + c.value, 0)

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[#0a0f1a]/95 backdrop-blur border-b border-[#1e2d4a] px-4 md:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#c9a84c]" />
              <h1 className="text-lg font-bold text-white tracking-tight">irfaninvest.com</h1>
            </div>
            <p className="text-[#8a9bbf] text-xs mt-0.5 ml-4">Real Estate Analytics Dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            {store.lastUpdated && (
              <span className="hidden sm:block text-[#8a9bbf] text-xs">
                Synced {new Date(store.lastUpdated).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loadingAnalysis || !hasData}
              className="flex items-center gap-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c97e] text-[#0a0f1a] px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-[#c9a84c]/20"
            >
              {loadingAnalysis
                ? <><span className="w-3 h-3 border-2 border-[#0a0f1a] border-t-transparent rounded-full animate-spin" />Analyzing…</>
                : <>✦ Claude AI Analysis</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Page Views" value={fmt(totalViews)} sub="Last 30 days" color="text-white" />
          <KpiCard label="Active Today" value={fmt(totalActiveToday)} sub="Last 24h" color="text-[#c9a84c]" />
          <KpiCard label="Active (28d)" value={fmt(totalUsers28)} sub="Monthly audience" color="text-[#c9a84c]" />
          <KpiCard label="Events" value={fmt(totalEvents)} sub="User interactions" color="text-[#3b82f6]" />
          <KpiCard label="Leads" value={fmt(totalLeads)} sub="generate_lead events" color="text-[#22c55e]" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-[#0f1629] border border-[#1e2d4a] rounded-xl p-1 w-fit">
          {(['overview', 'pages', 'geo', 'ai'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-[#c9a84c] text-[#0a0f1a]'
                  : 'text-[#8a9bbf] hover:text-white'
              }`}
            >
              {t === 'ai' ? '✦ AI Insights' : t === 'overview' ? 'Overview' : t === 'pages' ? 'Top Pages' : 'Geography'}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Area Chart */}
            <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Traffic Over Time</h3>
                <div className="flex items-center gap-4 text-xs text-[#8a9bbf]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#c9a84c] inline-block"/>Page Views</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block"/>Active Users</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={byDate}>
                  <defs>
                    <linearGradient id="gViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={GOLD} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={GOLD} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={BLUE} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={BLUE} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                  <XAxis dataKey="date" tick={{ fill: '#8a9bbf', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8a9bbf', fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="pageViews" stroke={GOLD} strokeWidth={2} fill="url(#gViews)" dot={false} />
                  <Area type="monotone" dataKey="users" stroke={BLUE} strokeWidth={2} fill="url(#gUsers)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Country + Recent */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Traffic by Country</h3>
                <div className="space-y-3">
                  {countries.map((c, i) => {
                    const pct = totalCountryUsers ? Math.round((c.value / totalCountryUsers) * 100) : 0
                    return (
                      <div key={c.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white font-medium">{c.name}</span>
                          <span className="text-[#8a9bbf]">{pct}% · {c.value.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-[#1e2d4a] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-2">
                  {[...rows].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 6).map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e2d4a] last:border-0">
                      <div>
                        <p className="text-xs text-white font-medium truncate max-w-[180px]">
                          {(r.page_location || '').replace('https://irfaninvest.com','') || '/'}
                        </p>
                        <p className="text-[10px] text-[#8a9bbf]">{r.country} · {r.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#c9a84c] font-semibold">{r.screen_page_views || r.page_views || 0} views</p>
                        <p className="text-[10px] text-[#8a9bbf]">{r.active_1_day_users || 0} active</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Pages Tab ── */}
        {tab === 'pages' && (
          <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Top Pages by Views</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={topPages} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#8a9bbf', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="page" type="category" width={180} tick={{ fill: '#e2e8f0', fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#0a0f1a', border: '1px solid #1e2d4a', borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: '#1e2d4a' }}
                />
                <Bar dataKey="views" fill={GOLD} radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Geography Tab ── */}
        {tab === 'geo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5 flex flex-col items-center">
              <h3 className="text-sm font-semibold text-white mb-2 self-start">Audience Distribution</h3>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={countries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={3}>
                    {countries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0a0f1a', border: '1px solid #1e2d4a', borderRadius: 12, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Country Breakdown</h3>
              <div className="space-y-4">
                {countries.map((c, i) => {
                  const pct = totalCountryUsers ? Math.round((c.value / totalCountryUsers) * 100) : 0
                  return (
                    <div key={c.name} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-white">{c.name}</span>
                          <span className="text-sm text-[#c9a84c] font-semibold">{pct}%</span>
                        </div>
                        <div className="h-1 bg-[#1e2d4a] rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIE_COLORS[i] }} />
                        </div>
                      </div>
                      <span className="text-xs text-[#8a9bbf] w-16 text-right">{c.value.toLocaleString()} users</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── AI Tab ── */}
        {tab === 'ai' && (
          <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-6">
            {!analysis && !loadingAnalysis && (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#e8c97e] flex items-center justify-center text-2xl text-[#0a0f1a] font-bold">✦</div>
                <p className="text-white font-semibold">Claude AI SEO Analysis</p>
                <p className="text-[#8a9bbf] text-sm text-center max-w-sm">Get personalized SEO recommendations for irfaninvest.com based on your real traffic data.</p>
                <button onClick={runAnalysis} disabled={!hasData}
                  className="mt-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c97e] text-[#0a0f1a] px-6 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-[#c9a84c]/20 transition-all">
                  Run Analysis
                </button>
              </div>
            )}
            {loadingAnalysis && (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="w-8 h-8 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                <p className="text-[#8a9bbf] text-sm">Claude is analyzing your data…</p>
              </div>
            )}
            {analysis && !loadingAnalysis && (
              <div className="space-y-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#e8c97e] flex items-center justify-center text-sm text-[#0a0f1a] font-bold flex-shrink-0">✦</div>
                  <p className="text-[#e2e8f0] text-sm leading-relaxed">{analysis.summary}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { title: 'Key Insights', items: analysis.topInsights, color: GOLD },
                    { title: 'SEO Recommendations', items: analysis.seoRecommendations, color: BLUE },
                    { title: 'Priority Actions', items: analysis.priorityActions, color: '#22c55e' },
                    { title: 'Content Gaps', items: analysis.contentGaps, color: '#f43f5e' },
                  ].map(({ title, items, color }) => (
                    <div key={title} className="bg-[#0a0f1a] rounded-xl p-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>{title}</h4>
                      <ul className="space-y-2">
                        {items?.map((item, i) => (
                          <li key={i} className="flex gap-2 text-sm text-[#e2e8f0]">
                            <span style={{ color }} className="flex-shrink-0 mt-0.5">›</span>{item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {analysis.geographicOpportunities && (
                  <div className="bg-[#0a0f1a] rounded-xl p-4 border-l-2" style={{ borderColor: GOLD }}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#c9a84c] mb-2">Geographic Opportunities</h4>
                    <p className="text-sm text-[#e2e8f0]">{analysis.geographicOpportunities}</p>
                  </div>
                )}
                <button onClick={runAnalysis}
                  className="text-xs text-[#8a9bbf] hover:text-[#c9a84c] transition-colors">
                  ↻ Re-run analysis
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
