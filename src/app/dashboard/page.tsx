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

interface AdsRow {
  id?: number
  date: string
  campaign_id: string
  campaign_name: string
  campaign_status: string
  clicks: number
  impressions: number
  cost: number
  ctr: number
  average_cpc: number
  average_cpm: number
  interaction_rate: number
  video_views: number
  advertising_channel_type: string
  synced_at?: string
}

interface GA4Store { lastUpdated: string; rows: GA4Row[]; ads: AdsRow[] }

interface Insight { title: string; detail: string; impact: 'high'|'medium'|'low' }
interface Recommendation { title: string; detail: string; priority: 'urgent'|'high'|'medium' }
interface ContentGap { topic: string; reason: string }
interface PriorityAction { action: string; timeframe: string; impact: 'high'|'medium'|'low' }
interface AnalysisMetrics { conversionRate: number; engagementScore: number; internationalTraffic: number }

interface AdsAnalysis {
  overallAssessment: string
  budgetEfficiency: 'high' | 'medium' | 'low'
  topPerformingCampaign: string
  weakestCampaign: string
  recommendations: Recommendation[]
  costPerLeadAssessment: string
}

interface Analysis {
  summary: string
  score: number
  topInsights: Insight[]
  seoRecommendations: Recommendation[]
  geographicOpportunities: string
  contentGaps: ContentGap[]
  priorityActions: PriorityAction[]
  metrics: AnalysisMetrics
  adsAnalysis?: AdsAnalysis
}
interface AnalysisResponse { analysis: Analysis; snapshot: Record<string, unknown>; lastUpdated: string }

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
  const [analysisResp, setAnalysisResp] = useState<AnalysisResponse | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'pages' | 'geo' | 'ads' | 'ai'>('overview')
  const analysis = analysisResp?.analysis ?? null

  const loadData = () =>
    fetch('/api/data').then(r => r.json()).then((d: GA4Store) => setStore(d))

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const runAnalysis = async () => {
    setLoadingAnalysis(true)
    setAnalysisError(null)
    setTab('ai')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 55000)
      const res = await fetch('/api/analyze', { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysisResp(data)
    } catch (e: unknown) {
      const msg = e instanceof Error ? (e.name === 'AbortError' ? 'Request timed out. Please try again.' : e.message) : 'Unknown error'
      setAnalysisError(msg)
    } finally {
      setLoadingAnalysis(false)
    }
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
  const ads  = store.ads ?? []
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
          {(['overview', 'pages', 'geo', 'ads', 'ai'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                tab === t
                  ? 'bg-[#c9a84c] text-[#0a0f1a]'
                  : 'text-[#8a9bbf] hover:text-white'
              }`}
            >
              {t === 'ai' ? '✦ AI Insights'
               : t === 'overview' ? 'Overview'
               : t === 'pages' ? 'Top Pages'
               : t === 'geo' ? 'Geography'
               : '📢 Google Ads'}
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

        {/* ── Google Ads Tab ── */}
        {tab === 'ads' && (() => {
          if (ads.length === 0) return (
            <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl flex flex-col items-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1e2d4a] flex items-center justify-center text-3xl">📢</div>
              <p className="text-white font-semibold">No Google Ads data yet</p>
              <p className="text-[#8a9bbf] text-sm text-center max-w-sm px-4">
                Send campaign data via n8n to <span className="font-mono text-[#c9a84c]">/api/webhook/google-ads</span>
              </p>
            </div>
          )

          // ── Pre-compute ───────────────────────────────────────────
          const totalClicks      = ads.reduce((s, r) => s + Number(r.clicks), 0)
          const totalImpressions = ads.reduce((s, r) => s + Number(r.impressions), 0)
          const totalCost        = ads.reduce((s, r) => s + Number(r.cost), 0)
          const totalVideoViews  = ads.reduce((s, r) => s + Number(r.video_views), 0)
          const overallCtr       = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
          const overallCpc       = totalClicks > 0 ? totalCost / totalClicks : 0
          const overallCpm       = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0

          // Cost by campaign — sorted desc, top 10
          const costByCampaign = [...ads]
            .filter(r => Number(r.cost) > 0)
            .sort((a, b) => Number(b.cost) - Number(a.cost))
            .slice(0, 10)
            .map(r => ({
              name: (r.campaign_name || r.campaign_id).slice(0, 26),
              cost: Number(r.cost),
              status: r.campaign_status,
            }))

          // CTR by campaign — only campaigns with impressions
          const ctrByChannel = [...ads]
            .filter(r => Number(r.impressions) > 0)
            .sort((a, b) => Number(b.ctr) - Number(a.ctr))
            .slice(0, 8)
            .map(r => ({
              name: (r.campaign_name || r.campaign_id).slice(0, 22),
              ctr: parseFloat((Number(r.ctr) * 100).toFixed(3)),
              channel: r.advertising_channel_type,
            }))

          // Channel type breakdown by cost
          const channelCost = Object.entries(
            ads.reduce((acc: Record<string, number>, r) => {
              const ch = r.advertising_channel_type || 'OTHER'
              acc[ch] = (acc[ch] || 0) + Number(r.cost)
              return acc
            }, {})
          ).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)

          const CHANNEL_COLORS: Record<string, string> = {
            VIDEO: '#8b5cf6', SEARCH: '#3b82f6', DEMAND_GEN: '#c9a84c', OTHER: '#0d9488'
          }

          // Status counts
          const statusCount = ads.reduce((acc: Record<string, number>, r) => {
            acc[r.campaign_status] = (acc[r.campaign_status] || 0) + 1
            return acc
          }, {})

          const fmtK = (n: number) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString()

          return (
            <div className="space-y-4">

              {/* ── KPI Row ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Spend',    value: `$${totalCost.toFixed(0)}`,        color: 'text-[#f43f5e]' },
                  { label: 'Total Clicks',   value: fmtK(totalClicks),                 color: 'text-[#c9a84c]' },
                  { label: 'Impressions',    value: fmtK(totalImpressions),             color: 'text-white' },
                  { label: 'Video Views',    value: fmtK(totalVideoViews),              color: 'text-[#8b5cf6]' },
                  { label: 'Avg CTR',        value: `${overallCtr.toFixed(2)}%`,        color: 'text-[#22c55e]' },
                  { label: 'Avg CPC',        value: `$${overallCpc.toFixed(2)}`,        color: 'text-[#3b82f6]' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-4">
                    <p className="text-[#8a9bbf] text-[10px] uppercase tracking-widest font-medium mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* ── Status badges + CPM ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Campaign status cards */}
                <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#8a9bbf] mb-4">Campaign Status</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(statusCount).map(([status, count]) => {
                      const cfg: Record<string, {bg:string;text:string;dot:string}> = {
                        ENABLED:  { bg:'bg-emerald-500/10', text:'text-emerald-400', dot:'bg-emerald-400' },
                        PAUSED:   { bg:'bg-yellow-500/10',  text:'text-yellow-400',  dot:'bg-yellow-400'  },
                        REMOVED:  { bg:'bg-red-500/10',     text:'text-red-400',     dot:'bg-red-400'     },
                      }
                      const c = cfg[status] ?? { bg:'bg-[#1e2d4a]', text:'text-[#8a9bbf]', dot:'bg-[#8a9bbf]' }
                      return (
                        <div key={status} className={`flex items-center gap-2 px-4 py-3 rounded-xl ${c.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${c.dot}`}/>
                          <span className={`text-sm font-semibold ${c.text}`}>{count}</span>
                          <span className="text-xs text-[#8a9bbf]">{status}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#1e2d4a] flex items-center justify-between text-xs">
                    <span className="text-[#8a9bbf]">Avg CPM</span>
                    <span className="text-[#0d9488] font-bold text-base">${overallCpm.toFixed(2)}</span>
                  </div>
                </div>

                {/* Channel breakdown */}
                <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-[#8a9bbf] mb-4">Spend by Channel</h3>
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width={130} height={130}>
                      <PieChart>
                        <Pie data={channelCost} dataKey="value" cx="50%" cy="50%" outerRadius={58} innerRadius={32} paddingAngle={3}>
                          {channelCost.map((entry, i) => (
                            <Cell key={i} fill={CHANNEL_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#0a0f1a', border: '1px solid #1e2d4a', borderRadius: 10, fontSize: 11 }}
                          formatter={(v: number) => [`$${v.toFixed(2)}`, 'Spend']}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {channelCost.map((entry) => {
                        const pct = totalCost > 0 ? (entry.value / totalCost) * 100 : 0
                        const color = CHANNEL_COLORS[entry.name] ?? '#8a9bbf'
                        return (
                          <div key={entry.name}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="font-medium" style={{ color }}>{entry.name}</span>
                              <span className="text-[#8a9bbf]">${entry.value.toFixed(0)}</span>
                            </div>
                            <div className="h-1 bg-[#1e2d4a] rounded-full">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Cost by Campaign (horizontal bar) ── */}
              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Ad Spend by Campaign</h3>
                <p className="text-[#8a9bbf] text-xs mb-4">Top 10 campaigns sorted by total cost</p>
                <ResponsiveContainer width="100%" height={Math.max(240, costByCampaign.length * 38)}>
                  <BarChart data={costByCampaign} layout="vertical" margin={{ left: 4, right: 40, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#8a9bbf', fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `$${v}`} />
                    <YAxis dataKey="name" type="category" width={170} tick={{ fill: '#e2e8f0', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0a0f1a', border: '1px solid #1e2d4a', borderRadius: 12, fontSize: 12 }}
                      cursor={{ fill: '#1e2d4a33' }}
                      formatter={(v: number) => [`$${v.toFixed(2)}`, 'Cost']}
                    />
                    <Bar dataKey="cost" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {costByCampaign.map((entry, i) => (
                        <Cell key={i} fill={
                          entry.status === 'ENABLED' ? '#22c55e' :
                          entry.status === 'PAUSED'  ? GOLD       : '#f43f5e'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-[#8a9bbf]">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block"/>ENABLED</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#c9a84c] inline-block"/>PAUSED</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f43f5e] inline-block"/>REMOVED</span>
                </div>
              </div>

              {/* ── CTR by Campaign ── */}
              {ctrByChannel.length > 0 && (
                <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">CTR by Campaign</h3>
                  <p className="text-[#8a9bbf] text-xs mb-4">Click-through rate % — campaigns with impressions only</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ctrByChannel} margin={{ left: 0, right: 8, top: 0, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e2d4a" />
                      <XAxis dataKey="name" tick={{ fill: '#8a9bbf', fontSize: 9 }} tickLine={false} axisLine={false}
                        angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: '#8a9bbf', fontSize: 10 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{ background: '#0a0f1a', border: '1px solid #1e2d4a', borderRadius: 12, fontSize: 12 }}
                        cursor={{ fill: '#1e2d4a33' }}
                        formatter={(v: number) => [`${v.toFixed(3)}%`, 'CTR']}
                      />
                      <Bar dataKey="ctr" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {ctrByChannel.map((entry, i) => (
                          <Cell key={i} fill={CHANNEL_COLORS[entry.channel] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Full Campaign Table ── */}
              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">All Campaigns</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[#8a9bbf] uppercase tracking-wider border-b border-[#1e2d4a]">
                        <th className="text-left pb-3 pr-3 font-medium">Campaign</th>
                        <th className="text-left pb-3 pr-3 font-medium">Type</th>
                        <th className="text-left pb-3 pr-3 font-medium">Status</th>
                        <th className="text-right pb-3 pr-3 font-medium">Clicks</th>
                        <th className="text-right pb-3 pr-3 font-medium">Impr.</th>
                        <th className="text-right pb-3 pr-3 font-medium">Cost</th>
                        <th className="text-right pb-3 pr-3 font-medium">CTR</th>
                        <th className="text-right pb-3 pr-3 font-medium">CPC</th>
                        <th className="text-right pb-3 font-medium">CPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ads].sort((a, b) => Number(b.cost) - Number(a.cost)).map((row, i) => {
                        const statusCls =
                          row.campaign_status === 'ENABLED' ? 'bg-emerald-500/20 text-emerald-400' :
                          row.campaign_status === 'PAUSED'  ? 'bg-yellow-500/20 text-yellow-400'   :
                          row.campaign_status === 'REMOVED' ? 'bg-red-500/20 text-red-400'         :
                                                              'bg-[#1e2d4a] text-[#8a9bbf]'
                        return (
                          <tr key={i} className="border-b border-[#1e2d4a]/50 last:border-0 hover:bg-[#0a0f1a]/60 transition-colors">
                            <td className="py-3 pr-3">
                              <p className="text-white font-medium max-w-[140px] truncate" title={row.campaign_name}>
                                {row.campaign_name || row.campaign_id}
                              </p>
                              <p className="text-[#8a9bbf] text-[10px] mt-0.5 font-mono">{row.campaign_id}</p>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px]"
                                style={{ background: `${CHANNEL_COLORS[row.advertising_channel_type] ?? '#8a9bbf'}22`,
                                         color: CHANNEL_COLORS[row.advertising_channel_type] ?? '#8a9bbf' }}>
                                {row.advertising_channel_type}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCls}`}>
                                {row.campaign_status}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-right text-white font-semibold">{Number(row.clicks).toLocaleString()}</td>
                            <td className="py-3 pr-3 text-right text-[#8a9bbf]">{fmtK(Number(row.impressions))}</td>
                            <td className="py-3 pr-3 text-right text-[#f43f5e] font-medium">${Number(row.cost).toFixed(2)}</td>
                            <td className="py-3 pr-3 text-right text-[#22c55e]">{(Number(row.ctr) * 100).toFixed(2)}%</td>
                            <td className="py-3 pr-3 text-right text-[#3b82f6]">${Number(row.average_cpc).toFixed(3)}</td>
                            <td className="py-3 text-right text-[#0d9488]">${Number(row.average_cpm).toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )
        })()}

        {/* ── AI Tab ── */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {!analysis && !loadingAnalysis && (
              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl flex flex-col items-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c9a84c] to-[#e8c97e] flex items-center justify-center text-2xl text-[#0a0f1a] font-bold">✦</div>
                <p className="text-white font-semibold text-lg">Claude AI SEO Analysis</p>
                <p className="text-[#8a9bbf] text-sm text-center max-w-sm px-4">Get personalized SEO insights and recommendations based on your real traffic data.</p>
                <button onClick={runAnalysis} disabled={!hasData}
                  className="mt-2 bg-gradient-to-r from-[#c9a84c] to-[#e8c97e] text-[#0a0f1a] px-8 py-3 rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-[#c9a84c]/20 transition-all disabled:opacity-50">
                  Run Analysis
                </button>
              </div>
            )}

            {loadingAnalysis && (
              <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl flex flex-col items-center py-16 gap-4">
                <div className="w-10 h-10 border-2 border-[#c9a84c] border-t-transparent rounded-full animate-spin" />
                <p className="text-white font-medium">Analyzing your data…</p>
                <p className="text-[#8a9bbf] text-xs">Claude is reviewing traffic, pages, and geographic patterns</p>
                <p className="text-[#8a9bbf] text-xs opacity-60">This may take up to 30 seconds</p>
              </div>
            )}

            {analysisError && !loadingAnalysis && (
              <div className="bg-[#0f1629] border border-red-900/50 rounded-2xl flex flex-col items-center py-12 gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">⚠</div>
                <p className="text-red-400 font-medium">Analysis failed</p>
                <p className="text-[#8a9bbf] text-sm text-center max-w-sm">{analysisError}</p>
                <button onClick={runAnalysis}
                  className="mt-2 bg-[#1e2d4a] hover:bg-[#2a3d5a] text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors">
                  Try again
                </button>
              </div>
            )}

            {analysis && !loadingAnalysis && (
              <>
                {/* Score + Summary */}
                <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {/* Score ring */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                          <circle cx="44" cy="44" r="38" fill="none" stroke="#1e2d4a" strokeWidth="8"/>
                          <circle cx="44" cy="44" r="38" fill="none" stroke={GOLD} strokeWidth="8"
                            strokeDasharray={`${2 * Math.PI * 38 * (analysis.score ?? 0) / 100} ${2 * Math.PI * 38}`}
                            strokeLinecap="round"/>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-[#c9a84c]">{analysis.score ?? '—'}</span>
                          <span className="text-[10px] text-[#8a9bbf]">SEO Score</span>
                        </div>
                      </div>
                    </div>
                    {/* Summary */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#c9a84c] to-[#e8c97e] flex items-center justify-center text-xs text-[#0a0f1a] font-bold">✦</div>
                        <h3 className="text-sm font-bold text-white">Executive Summary</h3>
                      </div>
                      <p className="text-[#e2e8f0] text-sm leading-relaxed">{analysis.summary}</p>
                    </div>
                  </div>

                  {/* Mini metrics */}
                  {analysis.metrics && (
                    <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-[#1e2d4a]">
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#c9a84c]">{analysis.metrics.conversionRate ?? 0}%</p>
                        <p className="text-[10px] text-[#8a9bbf] uppercase tracking-wider mt-0.5">Conversion Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#3b82f6]">{analysis.metrics.engagementScore ?? 0}</p>
                        <p className="text-[10px] text-[#8a9bbf] uppercase tracking-wider mt-0.5">Engagement Score</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-[#0d9488]">{analysis.metrics.internationalTraffic ?? 0}%</p>
                        <p className="text-[10px] text-[#8a9bbf] uppercase tracking-wider mt-0.5">Intl. Traffic</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Insights + Recommendations */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Key Insights */}
                  <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-4">Key Insights</h4>
                    <div className="space-y-3">
                      {analysis.topInsights?.map((ins, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-[#0a0f1a] rounded-xl">
                          <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                            ins.impact === 'high' ? 'bg-[#c9a84c]/20 text-[#c9a84c]' :
                            ins.impact === 'medium' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                          }`}>{ins.impact}</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{ins.title}</p>
                            <p className="text-xs text-[#8a9bbf] leading-relaxed">{ins.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SEO Recommendations */}
                  <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#3b82f6] mb-4">SEO Recommendations</h4>
                    <div className="space-y-3">
                      {analysis.seoRecommendations?.map((rec, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-[#0a0f1a] rounded-xl">
                          <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                            rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                            rec.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>{rec.priority}</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{rec.title}</p>
                            <p className="text-xs text-[#8a9bbf] leading-relaxed">{rec.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Priority Actions */}
                <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#22c55e] mb-4">Priority Actions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {analysis.priorityActions?.map((a, i) => (
                      <div key={i} className="bg-[#0a0f1a] rounded-xl p-4 border-t-2" style={{ borderColor: i === 0 ? '#f43f5e' : i === 1 ? '#f59e0b' : '#22c55e' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-[#8a9bbf] bg-[#1e2d4a] px-2 py-0.5 rounded-full">{a.timeframe}</span>
                          <span className={`text-xs font-bold ${a.impact === 'high' ? 'text-[#c9a84c]' : 'text-[#8a9bbf]'}`}>{a.impact} impact</span>
                        </div>
                        <p className="text-sm text-white leading-relaxed">{a.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Gaps + Geo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#f43f5e] mb-4">Content Gaps</h4>
                    <div className="space-y-3">
                      {analysis.contentGaps?.map((g, i) => (
                        <div key={i} className="flex gap-3 items-start p-3 bg-[#0a0f1a] rounded-xl">
                          <span className="text-[#f43f5e] text-lg leading-none flex-shrink-0">!</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{g.topic}</p>
                            <p className="text-xs text-[#8a9bbf]">{g.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5 border-l-2" style={{ borderLeftColor: GOLD }}>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-3">Geographic Strategy</h4>
                    <p className="text-sm text-[#e2e8f0] leading-relaxed">{analysis.geographicOpportunities}</p>
                  </div>
                </div>

                {/* Google Ads Analysis */}
                {analysis.adsAnalysis && (
                  <div className="space-y-4">
                    {/* Ads header + overall */}
                    <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5 border-t-2" style={{ borderTopColor: '#3b82f6' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">📢</div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#3b82f6]">Google Ads Performance Analysis</h4>
                        <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full ${
                          analysis.adsAnalysis.budgetEfficiency === 'high'   ? 'bg-emerald-500/20 text-emerald-400' :
                          analysis.adsAnalysis.budgetEfficiency === 'medium' ? 'bg-yellow-500/20 text-yellow-400'  :
                                                                               'bg-red-500/20 text-red-400'
                        }`}>
                          {analysis.adsAnalysis.budgetEfficiency?.toUpperCase()} EFFICIENCY
                        </span>
                      </div>
                      <p className="text-sm text-[#e2e8f0] leading-relaxed mb-4">{analysis.adsAnalysis.overallAssessment}</p>

                      {/* Top / Weakest campaign */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Top Performing</p>
                          <p className="text-sm text-white font-semibold">{analysis.adsAnalysis.topPerformingCampaign}</p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                          <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-1">Needs Attention</p>
                          <p className="text-sm text-white font-semibold">{analysis.adsAnalysis.weakestCampaign}</p>
                        </div>
                      </div>

                      {/* Cost per lead */}
                      <div className="mt-3 p-3 bg-[#0a0f1a] rounded-xl border-l-2 border-[#c9a84c]">
                        <p className="text-[10px] uppercase tracking-widest text-[#c9a84c] font-bold mb-1">Cost Per Lead Assessment</p>
                        <p className="text-xs text-[#e2e8f0] leading-relaxed">{analysis.adsAnalysis.costPerLeadAssessment}</p>
                      </div>
                    </div>

                    {/* Ads recommendations */}
                    {analysis.adsAnalysis.recommendations?.length > 0 && (
                      <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-2xl p-5">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-[#3b82f6] mb-4">Google Ads Recommendations</h4>
                        <div className="space-y-3">
                          {analysis.adsAnalysis.recommendations.map((rec, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-[#0a0f1a] rounded-xl">
                              <span className={`mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                                rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                rec.priority === 'high'   ? 'bg-orange-500/20 text-orange-400' :
                                                           'bg-blue-500/20 text-blue-400'
                              }`}>{rec.priority}</span>
                              <div>
                                <p className="text-sm font-semibold text-white mb-0.5">{rec.title}</p>
                                <p className="text-xs text-[#8a9bbf] leading-relaxed">{rec.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={runAnalysis} className="text-xs text-[#8a9bbf] hover:text-[#c9a84c] transition-colors flex items-center gap-1">
                    ↻ Re-run analysis
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
