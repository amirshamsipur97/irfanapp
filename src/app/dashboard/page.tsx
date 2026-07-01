'use client'

import React, { useEffect, useState } from 'react'
import { categorizePath } from '@/lib/siteMap'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

// ── Interfaces (unchanged) ────────────────────────────────────────────────────
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
interface LeadsOpportunity { title: string; detail: string; impact: 'high'|'medium'|'low' }
interface LeadsAnalysis {
  funnelAssessment: string
  qualityBreakdown: string
  topOpportunities: LeadsOpportunity[]
  sourceEffectiveness: string
  crossChannelInsight: string
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
  leadsAnalysis?: LeadsAnalysis
}
interface AnalysisResponse { analysis: Analysis; snapshot: Record<string, unknown>; lastUpdated: string }

// ── Leads interfaces ──────────────────────────────────────────────────────────
interface Lead {
  id: number; lead_id: string | null; full_name: string | null; email: string | null
  phone: string | null; country: string | null; city: string | null
  property_interest: string | null; budget: string | null; lead_quality: string | null
  lead_score: number | null; buyer_intent: string | null; status: string | null
  recommended_next_action: string | null; short_summary: string | null
  source_sheet: string | null; campaign_source: string | null; language: string | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  preferred_location: string | null; message: string | null
  created_at: string | null; inserted_at: string | null
}
interface LeadsStore { leads: Lead[]; total: number; page: number; totalPages: number }
interface CeoImmediateAction { action: string; reason: string; timeframe: string }
interface CeoReport {
  executive_summary: string; quality_analysis: string; priority_leads: string
  sales_action: string; immediate_actions: CeoImmediateAction[]
  market_insight: string; score_interpretation: string
}
interface CeoReportResponse {
  report: CeoReport; generatedAt: string
  stats: { total: number; hot: number; warm: number; cold: number; avgScore: string; highIntent: number; leadsToday: number }
}

// ── Calls interfaces ──────────────────────────────────────────────────────────
interface Call {
  id: number; lead_id: string | null; full_name: string | null; email: string | null
  phone: string | null; country: string | null; city: string | null
  property_interest: string | null; budget: string | null
  lead_quality: string | null; lead_score: number | null; buyer_intent: string | null
  voice_source: string | null; call_status: string | null; call_attempt_count: number | null
  last_called_at: string | null; next_call_at: string | null; vapi_call_id: string | null
  call_summary: string | null; call_transcript: string | null; interest_status: string | null
  appointment_requested: boolean | null; appointment_time: string | null; appointment_status: string | null
  follow_up_priority: string | null; assigned_sales_manager: string | null
  inserted_at: string | null; source_sheet: string | null
}
interface CallsStats {
  total: number; inbound: number; outbound: number
  booked: number; interested: number; not_interested: number; no_answer: number
  attempts_24h: number
}
interface CallsStore {
  calls: Call[]; total: number; page: number; totalPages: number; stats: CallsStats
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const PURPLE      = '#8B5CF6'
const GOLD        = '#F59E0B'
const GREEN       = '#10B981'
const BLUE        = '#3B82F6'
const TEAL        = '#14B8A6'
const RED         = '#EF4444'
const PIE_COLORS  = [PURPLE, GOLD, BLUE, TEAL, '#F43F5E']
const CHANNEL_COLORS: Record<string, string> = {
  VIDEO: '#8B5CF6', SEARCH: '#3B82F6', DEMAND_GEN: '#F59E0B', OTHER: '#14B8A6',
}

const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000   ? `${(n / 1_000).toFixed(1)}k`
  : n.toLocaleString()

// ── Tooltip ───────────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color?:string}[]; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-black/90 border border-white/10 rounded-xl px-4 py-3 text-xs shadow-2xl backdrop-blur-sm">
      {label && <p className="text-white/40 mb-2 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.color || PURPLE }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = PURPLE }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="relative bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 flex flex-col gap-2 overflow-hidden group hover:border-white/20 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}18 0%, transparent 70%)` }} />
      <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold z-10">{label}</p>
      <p className="text-3xl font-bold text-white z-10 tracking-tight">{value}</p>
      {sub && <p className="text-white/30 text-xs z-10">{sub}</p>}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [store, setStore]               = useState<GA4Store | null>(null)
  const [analysisResp, setAnalysisResp] = useState<AnalysisResponse | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [analysisError, setAnalysisError]     = useState<string | null>(null)
  const [tab, setTab] = useState<'marketing'|'pages'|'geo'|'ads'|'ai'|'form-leads'|'convos'|'qualified'|'combined'|'calls'|'voice'>('marketing')
  const analysis = analysisResp?.analysis ?? null

  // ── Leads state ─────────────────────────────────────────────────────────────
  const [leadsStore, setLeadsStore]       = useState<LeadsStore | null>(null)
  const [leadsLoading, setLeadsLoading]   = useState(false)
  const [leadsError, setLeadsError]       = useState<string | null>(null)
  const [leadsPage, setLeadsPage]         = useState(1)
  const [leadsSearch, setLeadsSearch]     = useState('')
  const [leadsQuality, setLeadsQuality]   = useState('')
  const [leadsCountry, setLeadsCountry]   = useState('')
  const [leadsProperty, setLeadsProperty] = useState('')
  const [leadsSheet, setLeadsSheet]       = useState('')
  const [expandedLead, setExpandedLead]   = useState<number | null>(null)
  const [ceoReport, setCeoReport]         = useState<CeoReportResponse | null>(null)
  const [ceoLoading, setCeoLoading]       = useState(false)
  const [ceoError, setCeoError]           = useState<string | null>(null)
  const [showCeo, setShowCeo]             = useState(false)

  // ── Calls state ─────────────────────────────────────────────────────────────
  const [callsStore, setCallsStore]       = useState<CallsStore | null>(null)
  const [callsLoading, setCallsLoading]   = useState(false)
  const [callsError, setCallsError]       = useState<string | null>(null)
  const [callsPage, setCallsPage]         = useState(1)
  const [callsSource, setCallsSource]     = useState('')
  const [callsStatus, setCallsStatus]     = useState('')
  const [callsSearch, setCallsSearch]     = useState('')
  const [expandedCall, setExpandedCall]   = useState<number | null>(null)

  // ── Realtime state ──────────────────────────────────────────────────────────
  interface RealtimeRow { country: string; city: string; page_path: string | null; device: string | null; source: string | null; active_users: number; views_30min: number; synced_at: string }
  interface RealtimeCountry { country: string; active_users: number; city_count: number }
  interface RealtimeCity { city: string; country: string; active_users: number; views: number }
  interface RealtimeStore {
    mode?: 'live' | 'fallback_daily' | 'empty'
    syncedAt: string | null
    fallbackDate?: string | null
    totalActive: number
    totalViews: number
    byCountry: RealtimeCountry[]
    byCity: RealtimeCity[]
    raw: RealtimeRow[]
    note?: string
  }
  const [realtime, setRealtime] = useState<RealtimeStore | null>(null)

  // ── AI Conversations state ──────────────────────────────────────────────────
  interface ConvoRow {
    id: number; conversation_id: string | null; session_id: string | null
    user_message: string | null; ai_response: string | null; summary: string | null
    language: string | null; project_interest: string | null; mentioned_developer: string | null
    intent: string | null; urgency: string | null; lead_score: number | null
    lead_status: string | null; qualified: boolean | null; has_contact_info: boolean | null
    user_name: string | null; user_email: string | null; user_phone: string | null
    message_count: number | null; duration_seconds: number | null
    started_at: string | null; page_url: string | null
  }
  interface ConvosStore {
    total: number; uniqueSessions: number; qualifiedCount: number; withContact: number
    byLanguage: { language: string; count: number }[]
    byProject:  { project: string; count: number }[]
    byIntent:   { intent: string; count: number }[]
    byDay:      { date: string; count: number }[]
    scoreBuckets: Record<string, number>
    recent: ConvoRow[]
  }
  const [convos, setConvos] = useState<ConvosStore | null>(null)
  const [expandedConvo, setExpandedConvo] = useState<number | null>(null)
  const [convoSort, setConvoSort] = useState<'recent' | 'score' | 'qualified'>('qualified')
  const [convoFilter, setConvoFilter] = useState<'all' | 'qualified' | 'contact' | 'real'>('real')

  const loadData = () =>
    fetch('/api/data').then(r => r.json()).then((d: GA4Store) => setStore(d))

  const loadRealtime = () =>
    fetch('/api/realtime', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: RealtimeStore) => setRealtime(d))
      .catch(() => {})

  const loadConvos = () =>
    fetch('/api/conversations', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: ConvosStore) => setConvos(d))
      .catch(() => {})

  const loadLeads = (p = 1) => {
    setLeadsLoading(true); setLeadsError(null)
    const params = new URLSearchParams({ page: String(p), limit: '40' })
    if (leadsSearch)   params.set('search', leadsSearch)
    if (leadsQuality)  params.set('quality', leadsQuality)
    if (leadsCountry)  params.set('country', leadsCountry)
    if (leadsProperty) params.set('property', leadsProperty)
    if (leadsSheet)    params.set('source_sheet', leadsSheet)
    fetch(`/api/leads?${params}`)
      .then(r => r.json())
      .then((d: LeadsStore) => { setLeadsStore(d); setLeadsPage(p) })
      .catch(e => setLeadsError(e.message))
      .finally(() => setLeadsLoading(false))
  }

  const runCeoReport = async () => {
    setCeoLoading(true); setCeoError(null); setShowCeo(true)
    try {
      const res = await fetch('/api/ai/leads-ceo-report', { method: 'POST' })
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setCeoReport(d)
    } catch (e) {
      setCeoError(e instanceof Error ? e.message : 'Failed')
    } finally { setCeoLoading(false) }
  }

  useEffect(() => {
    loadData()
    const iv = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  // ── Realtime polling — every 30 seconds ─────────────────────────────────
  useEffect(() => {
    loadRealtime()
    const iv = setInterval(loadRealtime, 30 * 1000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (tab === 'combined' || tab === 'form-leads' || tab === 'qualified') loadLeads(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, leadsSearch, leadsQuality, leadsCountry, leadsProperty, leadsSheet])

  useEffect(() => {
    if (tab === 'convos' || tab === 'combined') loadConvos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const loadCalls = (p = 1) => {
    setCallsLoading(true); setCallsError(null)
    const params = new URLSearchParams({ page: String(p), limit: '30' })
    if (callsSearch) params.set('search', callsSearch)
    if (callsSource) params.set('voice_source', callsSource)
    if (callsStatus) params.set('call_status', callsStatus)
    fetch(`/api/calls?${params}`)
      .then(r => r.json())
      .then((d: CallsStore) => { setCallsStore(d); setCallsPage(p) })
      .catch(e => setCallsError(e.message))
      .finally(() => setCallsLoading(false))
  }

  useEffect(() => {
    if (tab === 'calls') loadCalls(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, callsSearch, callsSource, callsStatus])

  const runAnalysis = async () => {
    setLoadingAnalysis(true)
    setAnalysisError(null)
    setTab('ai')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90000)
      const res = await fetch('/api/analyze', { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysisResp(data)
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? (e.name === 'AbortError' ? 'Request timed out. Please try again.' : e.message)
        : 'Unknown error'
      setAnalysisError(msg)
    } finally {
      setLoadingAnalysis(false)
    }
  }

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!store) return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
        </div>
        <p className="text-white/30 text-sm tracking-widest uppercase">Loading analytics</p>
      </div>
    </div>
  )

  const rows    = store.rows
  const ads     = store.ads ?? []
  const hasData = rows.length > 0

  // ── GA4 aggregations ──────────────────────────────────────────────────────
  const totalViews       = rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers28     = rows.reduce((s, r) => s + (r.active_28_day_users || 0), 0)
  const totalActiveToday = rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents      = rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads       = rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)

  const byDate = Object.entries(
    rows.reduce((acc: Record<string, { pageViews: number; users: number }>, r) => {
      const d = r.date.slice(5)
      if (!acc[d]) acc[d] = { pageViews: 0, users: 0 }
      acc[d].pageViews += r.screen_page_views || r.page_views || 0
      acc[d].users     += r.active_1_day_users || 0
      return acc
    }, {})
  ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))

  // Group page views by the NEW site map's sections (legacy Webflow paths are
  // folded into their nearest new section, so the chart reflects the new site).
  const topPages = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      const cat = categorizePath(r.page_location || '/')
      acc[cat.section] = (acc[cat.section] || 0) + (r.screen_page_views || r.page_views || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([page, views]) => ({ page, views }))

  const countries = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.country] = (acc[r.country] || 0) + (r.active_28_day_users || 0)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }))

  const totalCountryUsers = countries.reduce((s, c) => s + c.value, 0)

  const TABS = [
    { id: 'marketing', label: '📊 Marketing' },
    { id: 'pages',     label: 'Top Pages' },
    { id: 'geo',       label: 'Geography' },
    { id: 'ads',       label: '📢 Google Ads' },
    { id: 'form-leads',label: '📝 Form Leads' },
    { id: 'convos',    label: '💬 AI Convos' },
    { id: 'qualified', label: '✦ Qualified AI' },
    { id: 'combined',  label: '👥 Combined' },
    { id: 'calls',     label: '📞 Calls' },
    { id: 'voice',     label: '🎙 Voice' },
    { id: 'ai',        label: '🧠 AI Insights' },
  ] as const

  return (
    <div className="min-h-screen bg-black text-white antialiased">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
              <span className="text-white text-xs font-black">I</span>
            </div>
            <div>
              <span className="font-bold text-sm text-white tracking-tight">irfaninvest</span>
              <span className="text-purple-400 font-bold text-sm">.com</span>
            </div>
            <span className="hidden sm:block text-white/20 text-xs ml-2 border border-white/10 rounded-full px-2 py-0.5">
              Analytics
            </span>
          </div>

          <div className="flex items-center gap-3">
            {store.lastUpdated && (
              <span className="hidden md:flex items-center gap-1.5 text-white/30 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Synced {new Date(store.lastUpdated).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={runAnalysis}
              disabled={loadingAnalysis || !hasData}
              className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all duration-300 hover:scale-105 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}
            >
              <div className="absolute inset-0 opacity-0 hover:opacity-30 transition-opacity"
                style={{ background: 'radial-gradient(circle at 50% 50%, #fff 0%, transparent 70%)' }} />
              {loadingAnalysis
                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing…</>
                : <>✦ AI Analysis</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* ── Page title ──────────────────────────────────────────────────── */}
        <div className="pt-2 pb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Real Estate{' '}
            <span style={{ background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Analytics
            </span>
          </h1>
          <p className="text-white/30 text-sm mt-1">irfaninvest.com · Oman luxury real estate</p>
        </div>

        {/* ── KPI Cards · GA4 + Google Ads combined ─────────────────────── */}
        {(() => {
          const adsTotalClicks      = ads.reduce((s, r) => s + Number(r.clicks ?? 0), 0)
          const adsTotalImpressions = ads.reduce((s, r) => s + Number(r.impressions ?? 0), 0)
          const adsTotalCost        = ads.reduce((s, r) => s + Number(r.cost ?? 0), 0)
          const adsCtr              = adsTotalImpressions > 0 ? (adsTotalClicks / adsTotalImpressions) * 100 : 0
          const costPerLead         = totalLeads > 0 ? (adsTotalCost / totalLeads) : 0
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <KpiCard label="Page Views"    value={fmtNum(totalViews)}       sub="Last 30 days"        accent={PURPLE} />
              <KpiCard label="Users (28d)"   value={fmtNum(totalUsers28)}     sub="Monthly audience"    accent={PURPLE} />
              <KpiCard label="Events"        value={fmtNum(totalEvents)}      sub="User interactions"   accent={BLUE}   />
              <KpiCard label="GA4 Leads"     value={fmtNum(totalLeads)}       sub="generate_lead events" accent={GREEN} />
              <KpiCard label="Ads Clicks"    value={fmtNum(adsTotalClicks)}   sub={`CTR ${adsCtr.toFixed(2)}%`} accent={GOLD}   />
              <KpiCard label="Cost / Lead"   value={costPerLead > 0 ? `$${costPerLead.toFixed(0)}` : '—'} sub={`$${adsTotalCost.toFixed(0)} spent`} accent={'#22D3EE'} />
            </div>
          )
        })()}

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl w-fit flex-wrap">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                tab === t.id
                  ? 'text-white shadow-lg'
                  : 'text-white/40 hover:text-white/70'
              }`}
              style={tab === t.id ? { background: 'linear-gradient(135deg, #7C3AED, #A855F7)' } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            OVERVIEW TAB — Enhanced analytical view
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'marketing' && (() => {
          // ── Build extra GA4 aggregations for this tab only ──
          const byDateFull = Object.entries(
            rows.reduce((acc: Record<string, { pageViews: number; users: number; events: number; leads: number }>, r) => {
              const d = r.date.slice(5)
              if (!acc[d]) acc[d] = { pageViews: 0, users: 0, events: 0, leads: 0 }
              acc[d].pageViews += r.screen_page_views || r.page_views || 0
              acc[d].users     += r.active_1_day_users || 0
              acc[d].events    += r.event_count || 0
              acc[d].leads     += r.generate_lead_events || 0
              return acc
            }, {})
          ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))

          // Day-of-week heatmap data (which day brings most traffic)
          const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          const byDow = Array.from({ length: 7 }, (_, i) => ({ day: dowNames[i], pageViews: 0, users: 0 }))
          rows.forEach(r => {
            const d = new Date(r.date)
            if (!isNaN(d.getTime())) {
              const dow = d.getUTCDay()
              byDow[dow].pageViews += r.screen_page_views || r.page_views || 0
              byDow[dow].users     += r.active_1_day_users || 0
            }
          })

          // Page distribution (donut) — by site section, named (no more "/")
          const pageDistribution = Object.entries(
            rows.reduce((acc: Record<string, number>, r) => {
              const cat = categorizePath(r.page_location || '/')
              acc[cat.section] = (acc[cat.section] || 0) + (r.screen_page_views || r.page_views || 0)
              return acc
            }, {})
          ).map(([name, value]) => ({ name, value })).filter(d => d.value > 0).sort((a, b) => b.value - a.value)

          const totalDistribution = pageDistribution.reduce((s, p) => s + p.value, 0)

          // Top cities
          const topCities = Object.entries(
            rows.reduce((acc: Record<string, { users: number; country: string }>, r) => {
              const key = r.city || 'Unknown'
              if (!acc[key]) acc[key] = { users: 0, country: r.country }
              acc[key].users += r.active_28_day_users || 0
              return acc
            }, {})
          ).sort((a, b) => b[1].users - a[1].users).slice(0, 5).map(([city, v]) => ({ city, ...v }))

          // Engagement funnel
          const avgEventsPerView = totalViews ? (totalEvents / totalViews).toFixed(1) : '0'
          const leadConversionRate = totalUsers28 ? ((totalLeads / totalUsers28) * 100).toFixed(2) : '0'

          // Recent activity with proper labels
          const recentActivity = [...rows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(r => ({
            ...r,
            label: categorizePath(r.page_location || '/').label,
            isLegacy: categorizePath(r.page_location || '/').isLegacy,
          }))

          return (
            <div className="space-y-4">
              {/* ── Traffic Over Time (3 metrics: views + users + events) ── */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Traffic Over Time</h3>
                    <p className="text-white/30 text-xs mt-0.5">Page views, active users & events per day</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-white/40 flex-wrap">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: PURPLE }} /> Page Views</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: GOLD }} /> Active Users</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUE }} /> Events</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={byDateFull}>
                    <defs>
                      <linearGradient id="gPurple" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={PURPLE} stopOpacity={0.3} /><stop offset="95%" stopColor={PURPLE} stopOpacity={0} /></linearGradient>
                      <linearGradient id="gGold"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GOLD}   stopOpacity={0.3} /><stop offset="95%" stopColor={GOLD}   stopOpacity={0} /></linearGradient>
                      <linearGradient id="gBlue"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={BLUE}   stopOpacity={0.2} /><stop offset="95%" stopColor={BLUE}   stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip />} />
                    <Area type="monotone" dataKey="pageViews" name="Page Views"   stroke={PURPLE} strokeWidth={2} fill="url(#gPurple)" dot={false} />
                    <Area type="monotone" dataKey="users"     name="Active Users" stroke={GOLD}   strokeWidth={2} fill="url(#gGold)"   dot={false} />
                    <Area type="monotone" dataKey="events"    name="Events"       stroke={BLUE}   strokeWidth={1.5} fill="url(#gBlue)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Engagement KPI strip ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Events per View</p>
                  <p className="text-2xl font-bold text-white mt-2">{avgEventsPerView}</p>
                  <p className="text-white/30 text-[10px] mt-1">User engagement depth</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Lead Conv. Rate</p>
                  <p className="text-2xl font-bold text-white mt-2">{leadConversionRate}%</p>
                  <p className="text-white/30 text-[10px] mt-1">28-day users → leads</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Top Country</p>
                  <p className="text-2xl font-bold text-white mt-2">{countries[0]?.name ?? '—'}</p>
                  <p className="text-white/30 text-[10px] mt-1">{countries[0] ? `${Math.round((countries[0].value / totalCountryUsers) * 100)}% of audience` : ''}</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Top Page</p>
                  <p className="text-2xl font-bold text-white mt-2">{pageDistribution[0]?.name ?? '—'}</p>
                  <p className="text-white/30 text-[10px] mt-1">{pageDistribution[0] ? `${Math.round((pageDistribution[0].value / totalDistribution) * 100)}% of views` : ''}</p>
                </div>
              </div>

              {/* ── Page Distribution Donut + Day-of-Week ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Donut */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Traffic Distribution by Page</h3>
                  <p className="text-white/30 text-xs mb-4">Share of views per site section</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="55%" height={200}>
                      <PieChart>
                        <Pie data={pageDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name">
                          {pageDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {pageDistribution.slice(0, 6).map((p, i) => {
                        const pct = totalDistribution ? Math.round((p.value / totalDistribution) * 100) : 0
                        return (
                          <div key={p.name} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-white/80 font-medium">{p.name}</span>
                            </span>
                            <span className="text-white/40 tabular-nums">{pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Day-of-Week pattern */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Traffic by Day of Week</h3>
                  <p className="text-white/30 text-xs mb-4">When your audience is most active</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byDow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="pageViews" name="Page Views" fill={PURPLE} radius={[6, 6, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Countries + Cities ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Countries */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Traffic by Country</h3>
                  <p className="text-white/30 text-xs mb-5">Active users (28-day window)</p>
                  <div className="space-y-4">
                    {countries.map((c, i) => {
                      const pct = totalCountryUsers ? Math.round((c.value / totalCountryUsers) * 100) : 0
                      return (
                        <div key={c.name}>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-white font-medium">{c.name}</span>
                            <span className="text-white/40 tabular-nums">{pct}% · {c.value.toLocaleString()}</span>
                          </div>
                          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
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

                {/* Top cities */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Top Cities</h3>
                  <p className="text-white/30 text-xs mb-5">Most engaged urban audiences</p>
                  <div className="space-y-3">
                    {topCities.map((c, i) => (
                      <div key={c.city} className="flex items-center justify-between py-1.5 border-b border-white/[0.05] last:border-0">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: `${PIE_COLORS[i % PIE_COLORS.length]}30`, color: PIE_COLORS[i % PIE_COLORS.length] }}>
                            #{i + 1}
                          </span>
                          <div>
                            <p className="text-xs text-white font-medium">{c.city}</p>
                            <p className="text-[10px] text-white/30">{c.country}</p>
                          </div>
                        </div>
                        <p className="text-xs font-semibold tabular-nums" style={{ color: PURPLE }}>
                          {c.users.toLocaleString()} <span className="text-white/40 font-normal">users</span>
                        </p>
                      </div>
                    ))}
                    {topCities.length === 0 && <p className="text-white/30 text-xs">No city data available</p>}
                  </div>
                </div>
              </div>

              {/* ── Recent activity (with proper page labels!) ── */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Top 10 sessions</span>
                </div>
                <p className="text-white/30 text-xs mb-5">Latest page sessions by date</p>
                <div className="space-y-1">
                  {recentActivity.map((r, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/[0.05] last:border-0 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white font-medium truncate">{r.label}</p>
                          {r.isLegacy && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 flex-shrink-0">
                              Legacy
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/30 mt-0.5 truncate">
                          {r.country}{r.city && r.city !== 'Unknown' ? ` · ${r.city}` : ''} · {r.date}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold tabular-nums" style={{ color: PURPLE }}>
                          {(r.screen_page_views || r.page_views || 0).toLocaleString()} <span className="text-white/40 font-normal">views</span>
                        </p>
                        <p className="text-[10px] text-white/30 tabular-nums">
                          {(r.active_1_day_users || 0).toLocaleString()} active · {(r.event_count || 0).toLocaleString()} events
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            TOP PAGES TAB — Detailed page-level analytics
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'pages' && (() => {
          // ── Aggregate by labelled page (use full label, not just section) ──
          interface PageAgg {
            label: string
            section: string
            isLegacy: boolean
            views: number
            users: number
            events: number
            leads: number
            sessions: number
            pages: Set<string>
          }
          const byLabelMap = rows.reduce((acc: Record<string, PageAgg>, r) => {
            const cat = categorizePath(r.page_location || '/')
            const key = cat.label
            if (!acc[key]) acc[key] = {
              label: cat.label, section: cat.section, isLegacy: cat.isLegacy,
              views: 0, users: 0, events: 0, leads: 0, sessions: 0, pages: new Set(),
            }
            acc[key].views    += r.screen_page_views || r.page_views || 0
            acc[key].users    += r.active_28_day_users || 0
            acc[key].events   += r.event_count || 0
            acc[key].leads    += r.generate_lead_events || 0
            acc[key].sessions += r.sessions_per_user || 0
            acc[key].pages.add(r.page_location || '/')
            return acc
          }, {})
          const byLabel = Object.values(byLabelMap)
            .map(p => ({
              ...p,
              uniqueUrls: p.pages.size,
              eventsPerView: p.views > 0 ? +(p.events / p.views).toFixed(2) : 0,
              leadRate: p.users > 0 ? +((p.leads / p.users) * 100).toFixed(2) : 0,
            }))
            .sort((a, b) => b.views - a.views)

          const topPagesDetailed = byLabel.slice(0, 10)
          const totalPageViews = byLabel.reduce((s, p) => s + p.views, 0)

          // ── Page performance over time (top 5 pages, stacked area) ──
          const top5Labels = byLabel.slice(0, 5).map(p => p.label)
          const pagesOverTime = Object.entries(
            rows.reduce((acc: Record<string, Record<string, number>>, r) => {
              const d = r.date.slice(5)
              const label = categorizePath(r.page_location || '/').label
              if (!top5Labels.includes(label)) return acc
              if (!acc[d]) acc[d] = {}
              acc[d][label] = (acc[d][label] || 0) + (r.screen_page_views || r.page_views || 0)
              return acc
            }, {})
          ).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }))

          // ── Legacy vs New site ──
          const legacyVsNew = byLabel.reduce(
            (acc, p) => {
              if (p.isLegacy) { acc.legacy += p.views; acc.legacyPages += 1 }
              else { acc.current += p.views; acc.currentPages += 1 }
              return acc
            },
            { current: 0, legacy: 0, currentPages: 0, legacyPages: 0 },
          )
          const legacyPct = totalPageViews > 0 ? Math.round((legacyVsNew.legacy / totalPageViews) * 100) : 0

          // ── Engagement scatter — views vs events ──
          const engagementData = byLabel.slice(0, 8).map(p => ({
            label: p.label,
            views: p.views,
            events: p.events,
            eventsPerView: p.eventsPerView,
          }))

          return (
            <div className="space-y-4">
              {/* ── Page-level KPI strip ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Tracked Pages</p>
                  <p className="text-2xl font-bold text-white mt-2 tabular-nums">{byLabel.length}</p>
                  <p className="text-white/30 text-[10px] mt-1">Distinct named pages</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Most Engaging</p>
                  <p className="text-base font-bold text-white mt-2 truncate">
                    {[...byLabel].sort((a, b) => b.eventsPerView - a.eventsPerView)[0]?.label ?? '—'}
                  </p>
                  <p className="text-white/30 text-[10px] mt-1">
                    {[...byLabel].sort((a, b) => b.eventsPerView - a.eventsPerView)[0]?.eventsPerView ?? 0} events/view
                  </p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Legacy Traffic</p>
                  <p className="text-2xl font-bold text-white mt-2 tabular-nums">{legacyPct}%</p>
                  <p className="text-white/30 text-[10px] mt-1">Old Webflow URLs · {legacyVsNew.legacyPages} pages</p>
                </div>
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
                  <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Lead-Driving Page</p>
                  <p className="text-base font-bold text-white mt-2 truncate">
                    {[...byLabel].filter(p => p.leads > 0).sort((a, b) => b.leads - a.leads)[0]?.label ?? 'None yet'}
                  </p>
                  <p className="text-white/30 text-[10px] mt-1">
                    {[...byLabel].filter(p => p.leads > 0).sort((a, b) => b.leads - a.leads)[0]?.leads ?? 0} lead events
                  </p>
                </div>
              </div>

              {/* ── Top pages bar chart ── */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Top Pages by Views</h3>
                    <p className="text-white/30 text-xs mt-0.5">Ranked by total page views across all dates</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: PURPLE }} /> Views</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUE }} /> Events</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={Math.max(280, topPagesDetailed.length * 38)}>
                  <BarChart data={topPagesDetailed} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="label" type="category" width={220} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="views"  name="Views"  fill={PURPLE} radius={[0, 6, 6, 0]} maxBarSize={18} />
                    <Bar dataKey="events" name="Events" fill={BLUE}   radius={[0, 6, 6, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Page trends over time (stacked area) ── */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Top 5 Pages Over Time</h3>
                    <p className="text-white/30 text-xs mt-0.5">Daily page views by top-performing pages</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40 flex-wrap">
                    {top5Labels.map((label, i) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate max-w-[140px]">{label}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={pagesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip />} />
                    {top5Labels.map((label, i) => (
                      <Area
                        key={label}
                        type="monotone"
                        dataKey={label}
                        stackId="1"
                        name={label}
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
                        fill={PIE_COLORS[i % PIE_COLORS.length]}
                        fillOpacity={0.6}
                        strokeWidth={1.5}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* ── Detailed performance table ── */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6 overflow-hidden">
                <h3 className="text-sm font-semibold text-white mb-1">Page Performance Matrix</h3>
                <p className="text-white/30 text-xs mb-5">Detailed metrics per tracked page</p>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-semibold">Page</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Views</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Users 28d</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Events</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Ev/View</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Leads</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byLabel.map((p, i) => {
                        const share = totalPageViews > 0 ? (p.views / totalPageViews) * 100 : 0
                        return (
                          <tr key={p.label} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-white/30 text-[10px] w-6 tabular-nums">#{i + 1}</span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium truncate">{p.label}</span>
                                    {p.isLegacy && (
                                      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20 flex-shrink-0">Legacy</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-white/30 mt-0.5">{p.section}</p>
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              <span className="font-semibold" style={{ color: PURPLE }}>{p.views.toLocaleString()}</span>
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{p.users.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{p.events.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{p.eventsPerView}</td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              {p.leads > 0
                                ? <span className="font-semibold" style={{ color: GREEN }}>{p.leads}</span>
                                : <span className="text-white/20">—</span>}
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${share}%`, background: PURPLE }} />
                                </div>
                                <span className="text-white/60 text-[10px] w-8">{share.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {byLabel.length === 0 && (
                        <tr><td colSpan={7} className="py-8 text-center text-white/30">No page data available yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Engagement comparison + Legacy split ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Events per view comparison */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Engagement Depth</h3>
                  <p className="text-white/30 text-xs mb-4">Events per view — how interactive each page is</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={engagementData} margin={{ left: 8, right: 8, top: 8, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        angle={-30}
                        textAnchor="end"
                        height={50}
                        interval={0}
                      />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="eventsPerView" name="Events/View" fill={BLUE} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Legacy vs new */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Legacy vs New Site</h3>
                  <p className="text-white/30 text-xs mb-4">How much traffic still hits old Webflow URLs</p>

                  <div className="flex items-center gap-4 mb-5">
                    <ResponsiveContainer width="40%" height={160}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'New site', value: legacyVsNew.current },
                            { name: 'Legacy Webflow', value: legacyVsNew.legacy },
                          ]}
                          cx="50%" cy="50%" innerRadius={42} outerRadius={68}
                          paddingAngle={2} dataKey="value" nameKey="name"
                        >
                          <Cell fill={PURPLE} stroke="none" />
                          <Cell fill="#F97316" stroke="none" />
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: PURPLE }} />
                            <span className="text-white font-medium">New site</span>
                          </span>
                          <span className="text-white/60 tabular-nums">{100 - legacyPct}%</span>
                        </div>
                        <p className="text-[10px] text-white/30">{legacyVsNew.current.toLocaleString()} views · {legacyVsNew.currentPages} pages</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
                            <span className="text-white font-medium">Legacy</span>
                          </span>
                          <span className="text-white/60 tabular-nums">{legacyPct}%</span>
                        </div>
                        <p className="text-[10px] text-white/30">{legacyVsNew.legacy.toLocaleString()} views · {legacyVsNew.legacyPages} pages</p>
                      </div>
                    </div>
                  </div>

                  {legacyPct > 5 && (
                    <div className="text-[10px] text-orange-400/70 bg-orange-500/5 border border-orange-500/15 rounded-lg p-2.5">
                      ⚠ {legacyPct}% of traffic still hits old Webflow URLs — consider 301 redirects to the new site map.
                    </div>
                  )}
                  {legacyPct <= 5 && legacyVsNew.legacy > 0 && (
                    <div className="text-[10px] text-green-400/70 bg-green-500/5 border border-green-500/15 rounded-lg p-2.5">
                      ✓ Only {legacyPct}% legacy traffic — migration is healthy.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            GEOGRAPHY TAB
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'geo' && (() => {
          // ── Historic city aggregation with engagement ──
          interface CityAgg { city: string; country: string; users28: number; usersToday: number; views: number; events: number; engagement: number }
          const cityMap = rows.reduce((acc: Record<string, CityAgg>, r) => {
            const key = `${r.country}|${r.city}`
            if (!acc[key]) acc[key] = { city: r.city || 'Unknown', country: r.country || 'Unknown', users28: 0, usersToday: 0, views: 0, events: 0, engagement: 0 }
            acc[key].users28    += r.active_28_day_users || 0
            acc[key].usersToday += r.active_1_day_users || 0
            acc[key].views      += r.screen_page_views || r.page_views || 0
            acc[key].events     += r.event_count || 0
            return acc
          }, {})
          const historicCities = Object.values(cityMap)
            .map(c => ({ ...c, engagement: c.views > 0 ? +(c.events / c.views).toFixed(2) : 0 }))
            .sort((a, b) => b.users28 - a.users28)

          const totalHistoricUsers = historicCities.reduce((s, c) => s + c.users28, 0)
          const mode = realtime?.mode ?? 'empty'
          const lastSyncDate = realtime?.syncedAt ? new Date(realtime.syncedAt) : null
          const minutesAgo = lastSyncDate && mode === 'live'
            ? Math.floor((Date.now() - lastSyncDate.getTime()) / 60000)
            : null
          const isLive = mode === 'live' && minutesAgo != null && minutesAgo <= 5
          const isFallback = mode === 'fallback_daily'
          const isEmpty = mode === 'empty' || !realtime
          const hasAnyData = (realtime?.totalActive ?? 0) > 0 || (realtime?.byCity?.length ?? 0) > 0

          // Visual tokens depend on mode
          const accent = isLive ? '#10B981' : isFallback ? '#F59E0B' : '#6B7280'
          const sectionLabel = isLive
            ? 'Realtime Traffic'
            : isFallback
            ? `Recent Traffic · ${realtime?.fallbackDate ?? 'today'} (daily approximation)`
            : 'Realtime Traffic'
          const sectionSub = isLive
            ? 'Live · last 30 minutes'
            : isFallback
            ? 'Realtime pipeline not connected — showing today\'s GA4 daily as fallback'
            : 'No GA4 data — connect n8n ingestion to start'

          return (
            <div className="space-y-4">
              {/* ════════════════════════════════════════════════════════════
                  REALTIME / RECENT SECTION
              ════════════════════════════════════════════════════════════ */}
              <div
                className="rounded-2xl p-5 md:p-6 border"
                style={{
                  background: isLive
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))'
                    : isFallback
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))'
                    : 'rgba(255,255,255,0.04)',
                  borderColor: isLive ? 'rgba(16,185,129,0.18)' : isFallback ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      {isLive && <span className="absolute inset-0 rounded-full animate-ping" style={{ background: accent }} />}
                      <span className="relative block w-2 h-2 rounded-full" style={{ background: accent }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{sectionLabel}</h3>
                      <p className="text-white/40 text-[10px] mt-0.5">{sectionSub}</p>
                    </div>
                    {/* Mode badge */}
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-bold"
                      style={{ background: `${accent}22`, color: accent }}>
                      {isLive ? 'LIVE' : isFallback ? 'DAILY' : 'OFFLINE'}
                    </span>
                  </div>
                  <button
                    onClick={loadRealtime}
                    className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1.5"
                    title="Refresh now"
                  >
                    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none"><path d="M2 8a6 6 0 1 0 1.5-3.97M2 2v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Refresh
                  </button>
                </div>

                {/* Setup hint when truly empty */}
                {isEmpty && !hasAnyData && (
                  <div className="bg-black/30 border border-white/[0.06] rounded-xl p-4 mb-4 text-xs">
                    <p className="text-white/80 font-semibold mb-2 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      How to enable live traffic
                    </p>
                    <ol className="text-white/55 space-y-1.5 ml-3.5 list-decimal">
                      <li>Confirm n8n GA4 schedule trigger is <span className="text-white">active</span> (every 30 min)</li>
                      <li>Add a 2-min schedule + HTTP node calling <code className="text-purple-300 bg-purple-500/10 px-1 rounded">GA4 runRealtimeReport</code> → POST <code className="text-purple-300 bg-purple-500/10 px-1 rounded">/api/webhook/ga4-realtime</code></li>
                      <li>Or provide a Google Service Account JSON and we&apos;ll poll the GA4 Realtime API directly from Vercel</li>
                    </ol>
                  </div>
                )}

                {/* Fallback note */}
                {isFallback && realtime?.note && (
                  <p className="text-amber-300/80 text-[11px] mb-4 px-2">⚠ {realtime.note}</p>
                )}

                {/* KPIs — labels adapt to mode */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">{isLive ? 'Active Now' : isFallback ? 'Active Today' : 'Active'}</p>
                    <p className="text-3xl font-bold text-white mt-2 tabular-nums">{realtime?.totalActive ?? 0}</p>
                    <p className="text-[10px] mt-1" style={{ color: `${accent}99` }}>{isLive ? 'users in last 30 min' : isFallback ? 'GA4 1-day active users' : 'no data'}</p>
                  </div>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">{isLive ? 'Views / 30 min' : isFallback ? 'Views Today' : 'Page Views'}</p>
                    <p className="text-3xl font-bold text-white mt-2 tabular-nums">{realtime?.totalViews ?? 0}</p>
                    <p className="text-white/30 text-[10px] mt-1">page views</p>
                  </div>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Countries</p>
                    <p className="text-3xl font-bold text-white mt-2 tabular-nums">{realtime?.byCountry.length ?? 0}</p>
                    <p className="text-white/30 text-[10px] mt-1">distinct regions</p>
                  </div>
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <p className="text-white/40 text-[10px] uppercase tracking-[0.15em] font-semibold">Cities</p>
                    <p className="text-3xl font-bold text-white mt-2 tabular-nums">{realtime?.byCity.length ?? 0}</p>
                    <p className="text-white/30 text-[10px] mt-1">unique cities</p>
                  </div>
                </div>

                {/* Live country + city breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: isLive ? 'pulse 2s infinite' : 'none' }} />
                      {isLive ? 'Active by Country' : isFallback ? 'Today\'s Traffic by Country' : 'Active by Country'}
                    </h4>
                    {realtime && realtime.byCountry.length > 0 ? (
                      <div className="space-y-2.5">
                        {realtime.byCountry.slice(0, 8).map((c, i) => {
                          const pct = realtime.totalActive > 0 ? Math.round((c.active_users / realtime.totalActive) * 100) : 0
                          return (
                            <div key={c.country} className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center"
                                style={{ background: `${PIE_COLORS[i % PIE_COLORS.length]}25`, color: PIE_COLORS[i % PIE_COLORS.length] }}>
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-xs">
                                  <span className="text-white font-medium truncate">{c.country}</span>
                                  <span className="text-white/40 tabular-nums">{pct}% · {c.active_users}</span>
                                </div>
                                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden mt-1">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                </div>
                              </div>
                              <span className="text-[10px] text-white/30">{c.city_count} {c.city_count === 1 ? 'city' : 'cities'}</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-white/30 text-xs py-4">{isEmpty ? 'No GA4 data — see setup steps above' : 'No traffic in this window'}</p>
                    )}
                  </div>

                  <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-white mb-3 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: isLive ? 'pulse 2s infinite' : 'none' }} />
                      {isLive ? 'Active by City' : isFallback ? 'Today\'s Traffic by City' : 'Active by City'}
                    </h4>
                    {realtime && realtime.byCity.length > 0 ? (
                      <div className="space-y-2">
                        {realtime.byCity.slice(0, 10).map((c, i) => (
                          <div key={`${c.country}-${c.city}-${i}`} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-white/30 text-[10px] tabular-nums w-4">#{i + 1}</span>
                              <div className="min-w-0">
                                <p className="text-xs text-white font-medium truncate">{c.city}</p>
                                <p className="text-[10px] text-white/30">{c.country}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-xs font-semibold tabular-nums" style={{ color: accent }}>{c.active_users}</p>
                              <p className="text-[10px] text-white/30 tabular-nums">{c.views} views</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-white/30 text-xs py-4">{isEmpty ? 'No GA4 data — see setup steps above' : 'No cities active in this window'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  HISTORIC: Country distribution
              ════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 flex flex-col items-center">
                  <h3 className="text-sm font-semibold text-white mb-1 self-start">Audience Distribution</h3>
                  <p className="text-white/30 text-xs mb-4 self-start">By active users (28d window)</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={countries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3}>
                        {countries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<DarkTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Country Breakdown</h3>
                  <p className="text-white/30 text-xs mb-6">Percentage of monthly audience</p>
                  <div className="space-y-5">
                    {countries.map((c, i) => {
                      const pct = totalCountryUsers ? Math.round((c.value / totalCountryUsers) * 100) : 0
                      return (
                        <div key={c.name} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                          <div className="flex-1">
                            <div className="flex justify-between mb-1.5">
                              <span className="text-sm text-white font-medium">{c.name}</span>
                              <span className="text-sm font-semibold" style={{ color: PIE_COLORS[i] }}>{pct}%</span>
                            </div>
                            <div className="h-1 bg-white/[0.05] rounded-full">
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i] }} />
                            </div>
                          </div>
                          <span className="text-xs text-white/30 w-20 text-right">{c.value.toLocaleString()} users</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════
                  ENHANCED TOP CITIES TABLE
              ════════════════════════════════════════════════════════════ */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Top Cities · Full Breakdown</h3>
                    <p className="text-white/30 text-xs mt-0.5">All cities with engagement metrics from last 30 days</p>
                  </div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{historicCities.length} cities</span>
                </div>
                <div className="overflow-x-auto -mx-2 mt-5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-semibold">City</th>
                        <th className="text-left py-3 px-2 font-semibold">Country</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Live</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Users 28d</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Users 1d</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Page Views</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Events</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Ev/View</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicCities.map((c, i) => {
                        const share = totalHistoricUsers > 0 ? (c.users28 / totalHistoricUsers) * 100 : 0
                        const liveUsers = realtime?.byCity.find(rc => rc.city === c.city && rc.country === c.country)?.active_users ?? 0
                        return (
                          <tr key={`${c.country}-${c.city}-${i}`} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-white/30 text-[10px] w-5 tabular-nums">#{i + 1}</span>
                                <span className="text-white font-medium">{c.city}</span>
                              </div>
                            </td>
                            <td className="py-3 px-2 text-white/60">{c.country}</td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              {liveUsers > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold">
                                  <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                                  {liveUsers}
                                </span>
                              ) : <span className="text-white/20">—</span>}
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              <span className="font-semibold" style={{ color: PURPLE }}>{c.users28.toLocaleString()}</span>
                            </td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{c.usersToday.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{c.views.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{c.events.toLocaleString()}</td>
                            <td className="text-right py-3 px-2 tabular-nums text-white/70">{c.engagement}</td>
                            <td className="text-right py-3 px-2 tabular-nums">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-14 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${share}%`, background: PURPLE }} />
                                </div>
                                <span className="text-white/60 text-[10px] w-8 tabular-nums">{share.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {historicCities.length === 0 && (
                        <tr><td colSpan={9} className="py-8 text-center text-white/30">No city data yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            GOOGLE ADS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'ads' && (() => {
          if (ads.length === 0) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl flex flex-col items-center py-20 gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: 'linear-gradient(135deg, #7C3AED22, #A855F722)', border: '1px solid #8B5CF620' }}>
                📢
              </div>
              <p className="text-white font-semibold">No Google Ads data yet</p>
              <p className="text-white/30 text-sm text-center max-w-sm">
                Send campaign data via n8n to{' '}
                <code className="text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded-md text-xs">/api/webhook/google-ads</code>
              </p>
            </div>
          )

          const totalClicks      = ads.reduce((s, r) => s + Number(r.clicks), 0)
          const totalImpressions = ads.reduce((s, r) => s + Number(r.impressions), 0)
          const totalCost        = ads.reduce((s, r) => s + Number(r.cost), 0)
          const totalVideoViews  = ads.reduce((s, r) => s + Number(r.video_views), 0)
          const overallCtr       = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
          const overallCpc       = totalClicks > 0 ? totalCost / totalClicks : 0
          const overallCpm       = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : 0

          const costByCampaign = [...ads]
            .filter(r => Number(r.cost) > 0)
            .sort((a, b) => Number(b.cost) - Number(a.cost))
            .slice(0, 10)
            .map(r => ({
              name:   (r.campaign_name || r.campaign_id).slice(0, 26),
              cost:   Number(r.cost),
              status: r.campaign_status,
            }))

          const ctrByChannel = [...ads]
            .filter(r => Number(r.impressions) > 0)
            .sort((a, b) => Number(b.ctr) - Number(a.ctr))
            .slice(0, 8)
            .map(r => ({
              name:    (r.campaign_name || r.campaign_id).slice(0, 20),
              ctr:     parseFloat((Number(r.ctr) * 100).toFixed(3)),
              channel: r.advertising_channel_type,
            }))

          const channelCost = Object.entries(
            ads.reduce((acc: Record<string, number>, r) => {
              const ch = r.advertising_channel_type || 'OTHER'
              acc[ch] = (acc[ch] || 0) + Number(r.cost)
              return acc
            }, {})
          ).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })).sort((a, b) => b.value - a.value)

          const statusCount = ads.reduce((acc: Record<string, number>, r) => {
            acc[r.campaign_status] = (acc[r.campaign_status] || 0) + 1
            return acc
          }, {})

          return (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Spend',  value: `$${totalCost.toFixed(0)}`,       accent: RED    },
                  { label: 'Clicks',       value: fmtNum(totalClicks),               accent: GOLD   },
                  { label: 'Impressions',  value: fmtNum(totalImpressions),           accent: PURPLE },
                  { label: 'Video Views',  value: fmtNum(totalVideoViews),            accent: PURPLE },
                  { label: 'Avg CTR',      value: `${overallCtr.toFixed(2)}%`,        accent: GREEN  },
                  { label: 'Avg CPC',      value: `$${overallCpc.toFixed(2)}`,        accent: BLUE   },
                ].map(({ label, value, accent }) => (
                  <KpiCard key={label} label={label} value={value} accent={accent} />
                ))}
              </div>

              {/* Status + Channel pie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Campaign Status</h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(statusCount).map(([status, count]) => {
                      const cfg: Record<string, { bg: string; text: string; dot: string }> = {
                        ENABLED: { bg: 'bg-emerald-500/10 border border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
                        PAUSED:  { bg: 'bg-yellow-500/10 border border-yellow-500/20',   text: 'text-yellow-400',  dot: 'bg-yellow-400'  },
                        REMOVED: { bg: 'bg-red-500/10 border border-red-500/20',          text: 'text-red-400',     dot: 'bg-red-400'     },
                      }
                      const c = cfg[status] ?? { bg: 'bg-white/5 border border-white/10', text: 'text-white/40', dot: 'bg-white/40' }
                      return (
                        <div key={status} className={`flex items-center gap-2 px-4 py-3 rounded-xl ${c.bg}`}>
                          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                          <span className={`text-lg font-bold ${c.text}`}>{count}</span>
                          <span className="text-xs text-white/40">{status}</span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex justify-between text-xs">
                    <span className="text-white/30">Avg CPM</span>
                    <span className="font-bold text-base" style={{ color: TEAL }}>${overallCpm.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Spend by Channel</h3>
                  <div className="flex gap-4 items-center">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={channelCost} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30} paddingAngle={3}>
                          {channelCost.map((entry, i) => (
                            <Cell key={i} fill={CHANNEL_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2.5">
                      {channelCost.map((entry) => {
                        const pct  = totalCost > 0 ? (entry.value / totalCost) * 100 : 0
                        const color = CHANNEL_COLORS[entry.name] ?? '#8a9bbf'
                        return (
                          <div key={entry.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium" style={{ color }}>{entry.name}</span>
                              <span className="text-white/30">${entry.value.toFixed(0)}</span>
                            </div>
                            <div className="h-1 bg-white/[0.05] rounded-full">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cost by campaign */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                <h3 className="text-sm font-semibold text-white mb-1">Ad Spend by Campaign</h3>
                <p className="text-white/30 text-xs mb-5">Top 10 by total cost · green=active, yellow=paused, red=removed</p>
                <ResponsiveContainer width="100%" height={Math.max(240, costByCampaign.length * 38)}>
                  <BarChart data={costByCampaign} layout="vertical" margin={{ left: 4, right: 50, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                    <YAxis dataKey="name" type="category" width={170} tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="cost" name="Cost ($)" radius={[0, 6, 6, 0]} maxBarSize={20}>
                      {costByCampaign.map((entry, i) => (
                        <Cell key={i} fill={entry.status === 'ENABLED' ? GREEN : entry.status === 'PAUSED' ? GOLD : RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* CTR chart */}
              {ctrByChannel.length > 0 && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                  <h3 className="text-sm font-semibold text-white mb-1">CTR by Campaign</h3>
                  <p className="text-white/30 text-xs mb-5">Click-through rate % for campaigns with impressions</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={ctrByChannel} margin={{ left: 0, right: 8, top: 0, bottom: 45 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="ctr" name="CTR %" radius={[4, 4, 0, 0]} maxBarSize={28}>
                        {ctrByChannel.map((entry, i) => (
                          <Cell key={i} fill={CHANNEL_COLORS[entry.channel] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Campaign table */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6">
                <h3 className="text-sm font-semibold text-white mb-5">All Campaigns</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {['Campaign', 'Type', 'Status', 'Clicks', 'Impr.', 'Cost', 'CTR', 'CPC', 'CPM'].map(h => (
                          <th key={h} className={`pb-3 font-semibold text-white/30 uppercase tracking-wider text-[10px] ${h === 'Campaign' || h === 'Type' || h === 'Status' ? 'text-left pr-3' : 'text-right pr-3 last:pr-0'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...ads].sort((a, b) => Number(b.cost) - Number(a.cost)).map((row, i) => {
                        const statusCls =
                          row.campaign_status === 'ENABLED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          row.campaign_status === 'PAUSED'  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'   :
                          row.campaign_status === 'REMOVED' ? 'bg-red-500/10 text-red-400 border border-red-500/20'            :
                                                              'bg-white/5 text-white/40'
                        return (
                          <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 pr-3">
                              <p className="text-white font-medium max-w-[140px] truncate" title={row.campaign_name}>
                                {row.campaign_name || row.campaign_id}
                              </p>
                              <p className="text-white/20 text-[10px] mt-0.5 font-mono">{row.campaign_id}</p>
                            </td>
                            <td className="py-3 pr-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                                style={{
                                  background: `${CHANNEL_COLORS[row.advertising_channel_type] ?? '#8B5CF6'}15`,
                                  color: CHANNEL_COLORS[row.advertising_channel_type] ?? '#8B5CF6',
                                }}>
                                {row.advertising_channel_type}
                              </span>
                            </td>
                            <td className="py-3 pr-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCls}`}>
                                {row.campaign_status}
                              </span>
                            </td>
                            <td className="py-3 pr-3 text-right text-white font-semibold">{Number(row.clicks).toLocaleString()}</td>
                            <td className="py-3 pr-3 text-right text-white/40">{fmtNum(Number(row.impressions))}</td>
                            <td className="py-3 pr-3 text-right font-medium" style={{ color: RED }}>${Number(row.cost).toFixed(2)}</td>
                            <td className="py-3 pr-3 text-right" style={{ color: GREEN }}>{(Number(row.ctr) * 100).toFixed(2)}%</td>
                            <td className="py-3 pr-3 text-right" style={{ color: BLUE }}>${Number(row.average_cpc).toFixed(3)}</td>
                            <td className="py-3 text-right" style={{ color: TEAL }}>${Number(row.average_cpm).toFixed(2)}</td>
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

        {/* ════════════════════════════════════════════════════════════════════
            FORM LEADS TAB — website leads (name/email/phone/project)
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'form-leads' && (() => {
          const allLeads = leadsStore?.leads ?? []
          const formLeads = allLeads.filter(l => (l.source_sheet ?? '').toLowerCase().includes('form_property_db') || (l.source_sheet ?? '').toLowerCase() === 'form_leads' || (l.source ?? '').toLowerCase() === 'form_leads')

          if (!leadsStore) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin mb-3" />
              <p className="text-white/40 text-sm">Loading form leads…</p>
            </div>
          )

          if (formLeads.length === 0) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="text-3xl mb-3">📝</div>
              <p className="text-white font-semibold">No form leads yet</p>
              <p className="text-white/40 text-sm mt-1">Submissions from the website forms will appear here.</p>
            </div>
          )

          const today = new Date().toISOString().slice(0, 10)
          const todayCount = formLeads.filter(l => (l.inserted_at ?? '').slice(0, 10) === today).length

          // Group by project/developer/property/purpose/language — extract from raw_data when available
          const groupBy = (key: string) => {
            const counts: Record<string, number> = {}
            formLeads.forEach(l => {
              type RawData = { project?: string; developer?: string; property_type?: string; purpose?: string; language?: string } | null
              const raw = (l as unknown as { raw_data?: RawData }).raw_data || null
              const val = raw?.[key as keyof RawData] || (key === 'language' ? l.language : null) || 'Unknown'
              const k = String(val).trim() || 'Unknown'
              counts[k] = (counts[k] || 0) + 1
            })
            return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))
          }

          const byProject  = groupBy('project')
          const byDev      = groupBy('developer')
          const byType     = groupBy('property_type')
          const byPurpose  = groupBy('purpose')
          const byLang     = groupBy('language')

          const Pill = ({ data, accent, title }: { data: { name: string; count: number }[]; accent: string; title: string }) => (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
              <h4 className="text-xs font-semibold text-white mb-4">{title}</h4>
              <div className="space-y-2.5">
                {data.length === 0 ? <p className="text-white/30 text-xs">No data yet</p> :
                  data.map((d, i) => {
                    const pct = formLeads.length > 0 ? Math.round((d.count / formLeads.length) * 100) : 0
                    return (
                      <div key={d.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-white truncate max-w-[180px]">{d.name}</span>
                          <span className="text-white/40 tabular-nums">{pct}% · {d.count}</span>
                        </div>
                        <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: i === 0 ? accent : `${accent}80` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )

          return (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Total Form Leads" value={fmtNum(formLeads.length)} sub="All-time submissions" accent={PURPLE} />
                <KpiCard label="New Today" value={fmtNum(todayCount)} sub="Last 24 hours" accent={GREEN} />
                <KpiCard label="With Email" value={fmtNum(formLeads.filter(l => l.email).length)} sub="Reachable by mail" accent={BLUE} />
                <KpiCard label="With Phone" value={fmtNum(formLeads.filter(l => l.phone).length)} sub="Reachable by call" accent={GOLD} />
              </div>

              {/* Distributions grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Pill data={byProject} accent={PURPLE} title="Leads by Project" />
                <Pill data={byDev}     accent={GOLD}   title="Leads by Developer" />
                <Pill data={byType}    accent={BLUE}   title="Leads by Property Type" />
                <Pill data={byPurpose} accent={GREEN}  title="Leads by Purpose" />
                <Pill data={byLang}    accent={'#22D3EE'} title="Leads by Language" />
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h4 className="text-xs font-semibold text-white mb-4">Status</h4>
                  <div className="space-y-2">
                    <p className="text-xs text-white/60">✓ AI pipeline ingesting form leads</p>
                    <p className="text-xs text-white/60">✓ Deduplication active (email/phone)</p>
                    <p className="text-xs text-white/60">✓ Rich fields preserved in raw_data</p>
                  </div>
                </div>
              </div>

              {/* Recent table */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Recent Form Leads</h3>
                    <p className="text-white/30 text-xs mt-0.5">Latest submissions from the website</p>
                  </div>
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{formLeads.length} total</span>
                </div>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-semibold">Name</th>
                        <th className="text-left py-3 px-2 font-semibold">Email · Phone</th>
                        <th className="text-left py-3 px-2 font-semibold">Property Interest</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Budget</th>
                        <th className="text-right py-3 px-2 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formLeads.slice(0, 30).map(l => (
                        <tr key={l.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-2 text-white font-medium">{l.full_name ?? <span className="text-white/30">—</span>}</td>
                          <td className="py-3 px-2 text-white/70">
                            <div className="truncate max-w-[200px]">{l.email ?? <span className="text-white/30">—</span>}</div>
                            <div className="text-[10px] text-white/40">{l.phone ?? '—'}</div>
                          </td>
                          <td className="py-3 px-2 text-white/70">
                            <div className="truncate max-w-[260px]">{l.property_interest ?? <span className="text-white/30">—</span>}</div>
                          </td>
                          <td className="text-right py-3 px-2 tabular-nums text-white/70">{l.budget ?? <span className="text-white/30">—</span>}</td>
                          <td className="text-right py-3 px-2 text-[10px] text-white/40 tabular-nums">{(l.inserted_at ?? l.created_at ?? '').slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            AI CONVERSATIONS TAB — every user chat with the AI agent
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'convos' && (() => {
          if (!convos) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin mb-3" />
              <p className="text-white/40 text-sm">Loading conversations…</p>
            </div>
          )

          if (convos.total === 0) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="text-3xl mb-3">💬</div>
              <p className="text-white font-semibold">No AI conversations yet</p>
              <p className="text-white/40 text-sm mt-1 max-w-md mx-auto">Every chat between users and the AI agent will land here — including tests, general questions, and exploratory messages.</p>
            </div>
          )

          // ── Helper: detect when text is an AI explanation, not a real project name ──
          // The n8n agent currently overflows summary text into project_interest. This
          // defensively filters out those long sentence-like values so the dashboard
          // shows real project mentions only.
          const isExplanation = (s: string | null | undefined): boolean => {
            if (!s) return true
            const t = s.trim()
            if (t.length > 60) return true                       // too long for a project name
            if (t.split(/\s+/).length > 6) return true           // more than 6 words
            if (/[.!?]$/.test(t)) return true                    // ends in sentence punctuation
            const phrases = [
              /the conversation/i, /lacks any/i, /no clear/i, /not qualified/i,
              /no information/i, /no specific/i, /does not (contain|indicate|show)/i,
              /no meaningful/i, /no buying/i, /no investment/i, /no relevant/i,
              /no identifying/i, /no real/i, /no inquiries/i, /no intent/i,
              /devoid of/i, /no substance/i, /not provide/i, /no form of/i,
            ]
            return phrases.some(re => re.test(t))
          }
          const cleanProject = (s: string | null | undefined) => isExplanation(s) ? null : s

          const qualifiedRate = convos.total > 0 ? Math.round((convos.qualifiedCount / convos.total) * 100) : 0
          const contactRate   = convos.total > 0 ? Math.round((convos.withContact   / convos.total) * 100) : 0

          // Filter out AI explanations from project rankings — keep only real mentions
          const realProjects = convos.byProject.filter(p => !isExplanation(p.project))
          const noisyProjectCount = convos.byProject.length - realProjects.length

          // Build the conversation list with filter & sort
          let workingList = convos.recent.map(c => ({ ...c, _realProject: cleanProject(c.project_interest) }))
          if (convoFilter === 'qualified')    workingList = workingList.filter(c => c.qualified === true)
          else if (convoFilter === 'contact') workingList = workingList.filter(c => c.has_contact_info === true)
          else if (convoFilter === 'real')    workingList = workingList.filter(c => c._realProject || c.qualified === true || c.has_contact_info === true)

          // Rank
          if (convoSort === 'score')      workingList.sort((a, b) => Number(b.lead_score ?? 0) - Number(a.lead_score ?? 0))
          else if (convoSort === 'qualified') workingList.sort((a, b) => Number(b.qualified ? 1 : 0) - Number(a.qualified ? 1 : 0) || Number(b.lead_score ?? 0) - Number(a.lead_score ?? 0))
          else workingList.sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))

          return (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Total Conversations" value={fmtNum(convos.total)} sub="All user sessions" accent={PURPLE} />
                <KpiCard label="Unique Sessions" value={fmtNum(convos.uniqueSessions)} sub="Distinct users" accent={BLUE} />
                <KpiCard label="Qualified Rate" value={`${qualifiedRate}%`} sub={`${convos.qualifiedCount} qualified`} accent={GREEN} />
                <KpiCard label="Left Contact Info" value={`${contactRate}%`} sub={`${convos.withContact} with email/phone`} accent={GOLD} />
              </div>

              {/* Data-quality note */}
              {noisyProjectCount > 0 && (
                <div className="bg-orange-500/[0.06] border border-orange-500/[0.18] rounded-2xl px-4 py-3 flex items-start gap-3">
                  <span className="text-orange-400 text-base leading-none mt-0.5">⚠</span>
                  <div className="text-xs">
                    <p className="text-orange-200 font-semibold mb-1">Data quality issue from n8n</p>
                    <p className="text-orange-200/70 leading-relaxed">
                      The AI agent is writing explanation sentences into <code className="bg-orange-500/10 px-1 rounded text-orange-300">project_interest</code> instead of project names —
                      we filtered out <span className="font-semibold">{noisyProjectCount}</span> noisy values.{' '}
                      Fix the prompt in the n8n &quot;Qualify Voice Lead / Qualify Conversation&quot; node so it emits
                      <code className="bg-orange-500/10 px-1 mx-1 rounded text-orange-300">project_interest</code> ONLY when a real project is mentioned, otherwise null.
                    </p>
                  </div>
                </div>
              )}

              {/* Volume + Languages */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 lg:col-span-2">
                  <h3 className="text-sm font-semibold text-white mb-1">Conversation Volume Over Time</h3>
                  <p className="text-white/30 text-xs mb-4">Daily conversation count</p>
                  {convos.byDay.length === 0 ? <p className="text-white/30 text-xs py-8">No daily data yet</p> :
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={convos.byDay}>
                        <defs>
                          <linearGradient id="gConvo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={PURPLE} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={PURPLE} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<DarkTooltip />} />
                        <Area type="monotone" dataKey="count" name="Conversations" stroke={PURPLE} strokeWidth={2} fill="url(#gConvo)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>}
                </div>

                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Conversations by Language</h3>
                  <p className="text-white/30 text-xs mb-4">Top languages used</p>
                  <div className="space-y-2.5">
                    {convos.byLanguage.slice(0, 6).map((l, i) => {
                      const pct = convos.total > 0 ? Math.round((l.count / convos.total) * 100) : 0
                      return (
                        <div key={l.language}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-white">{l.language}</span>
                            <span className="text-white/40 tabular-nums">{pct}% · {l.count}</span>
                          </div>
                          <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Top mentioned projects — filtered to REAL names only */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Top Mentioned Projects</h3>
                <p className="text-white/30 text-xs mb-4">Real project names only (AI explanations filtered out)</p>
                {realProjects.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-white/40 text-xs">No real project mentions yet</p>
                    <p className="text-white/30 text-[10px] mt-1">When users ask about Aida, Maison Shirdel, etc., they will appear here</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(140, realProjects.length * 34)}>
                    <BarChart data={realProjects} layout="vertical" margin={{ left: 8, right: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis dataKey="project" type="category" width={180} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="count" name="Mentions" fill={PURPLE} radius={[0, 6, 6, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Conversation explorer — filter / sort / expand */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Conversation Explorer</h3>
                    <p className="text-white/30 text-xs mt-0.5">Click any row to read the user message, AI response & full summary</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {/* Filter pills */}
                    <div className="flex p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                      {([
                        { id: 'real',      label: 'Signal',    desc: 'with project, intent or contact' },
                        { id: 'qualified', label: 'Qualified', desc: 'only AI-qualified' },
                        { id: 'contact',   label: 'Contact',   desc: 'left email/phone' },
                        { id: 'all',       label: 'All',       desc: 'everything' },
                      ] as const).map(f => (
                        <button
                          key={f.id}
                          onClick={() => setConvoFilter(f.id)}
                          title={f.desc}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${convoFilter === f.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}
                        >{f.label}</button>
                      ))}
                    </div>
                    {/* Sort */}
                    <div className="flex p-0.5 bg-white/[0.04] border border-white/[0.08] rounded-lg">
                      {([
                        { id: 'qualified', label: 'Rank' },
                        { id: 'score',     label: 'Score' },
                        { id: 'recent',    label: 'Recent' },
                      ] as const).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setConvoSort(s.id)}
                          className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${convoSort === s.id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'}`}
                        >{s.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-white/30 mb-3">{workingList.length} shown · {convos.total} total</p>

                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-semibold w-8"></th>
                        <th className="text-left py-3 px-2 font-semibold">User · Contact</th>
                        <th className="text-left py-3 px-2 font-semibold">User Message Preview</th>
                        <th className="text-left py-3 px-2 font-semibold">Project</th>
                        <th className="text-left py-3 px-2 font-semibold">Lang</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Msgs</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Score</th>
                        <th className="text-right py-3 px-2 font-semibold">Status</th>
                        <th className="text-right py-3 px-2 font-semibold">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workingList.length === 0 ? (
                        <tr><td colSpan={9} className="py-10 text-center text-white/30">No conversations match this filter</td></tr>
                      ) : workingList.map(c => {
                        const isOpen = expandedConvo === c.id
                        return (
                          <React.Fragment key={c.id}>
                            <tr
                              className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                              onClick={() => setExpandedConvo(isOpen ? null : c.id)}
                            >
                              <td className="py-3 px-2 text-white/40">
                                <span className={`inline-block transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                              </td>
                              <td className="py-3 px-2">
                                <div className="text-white font-medium truncate max-w-[140px]">{c.user_name ?? <span className="text-white/30">Anonymous</span>}</div>
                                <div className="text-[10px] text-white/40 truncate max-w-[140px]">{c.user_email ?? c.user_phone ?? '—'}</div>
                              </td>
                              <td className="py-3 px-2 text-white/80">
                                <div className="truncate max-w-[300px]" title={c.user_message ?? ''}>{c.user_message ?? <span className="text-white/30">no message captured</span>}</div>
                              </td>
                              <td className="py-3 px-2 text-white/70 truncate max-w-[120px]">{c._realProject ?? <span className="text-white/30">—</span>}</td>
                              <td className="py-3 px-2 text-white/70 uppercase text-[10px]">{c.language ?? '—'}</td>
                              <td className="text-right py-3 px-2 tabular-nums text-white/70">{c.message_count ?? '—'}</td>
                              <td className="text-right py-3 px-2 tabular-nums font-semibold" style={{ color: Number(c.lead_score ?? 0) >= 50 ? GREEN : 'rgba(255,255,255,0.5)' }}>{c.lead_score ?? '—'}</td>
                              <td className="text-right py-3 px-2">
                                {c.qualified ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 text-[10px] font-semibold">
                                    <span className="w-1 h-1 rounded-full bg-green-400" /> Qualified
                                  </span>
                                ) : c.has_contact_info ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 text-[10px] font-semibold">Contact</span>
                                ) : <span className="text-white/30 text-[10px]">—</span>}
                              </td>
                              <td className="text-right py-3 px-2 text-[10px] text-white/40 tabular-nums">{(c.started_at ?? '').slice(0, 10)}</td>
                            </tr>

                            {/* Expanded row — full conversation detail */}
                            {isOpen && (
                              <tr className="bg-white/[0.02]">
                                <td colSpan={9} className="px-4 py-5">
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* User message */}
                                    <div className="bg-black/40 border border-white/[0.06] rounded-xl p-4">
                                      <p className="text-[10px] uppercase tracking-wider text-blue-400 font-semibold mb-2">User Message</p>
                                      <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{c.user_message || <span className="text-white/30">No user message stored</span>}</p>
                                    </div>
                                    {/* AI response */}
                                    <div className="bg-black/40 border border-white/[0.06] rounded-xl p-4">
                                      <p className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold mb-2">AI Response</p>
                                      <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">{c.ai_response || <span className="text-white/30">No AI response stored</span>}</p>
                                    </div>
                                    {/* Summary + meta */}
                                    <div className="bg-black/40 border border-white/[0.06] rounded-xl p-4 space-y-3">
                                      <div>
                                        <p className="text-[10px] uppercase tracking-wider text-green-400 font-semibold mb-2">AI Summary</p>
                                        <p className="text-xs text-white/80 leading-relaxed">{c.summary || <span className="text-white/30">No summary</span>}</p>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-white/[0.06]">
                                        <div><span className="text-white/40">Intent:</span> <span className="text-white">{c.intent ?? '—'}</span></div>
                                        <div><span className="text-white/40">Urgency:</span> <span className="text-white">{c.urgency ?? '—'}</span></div>
                                        <div><span className="text-white/40">Status:</span> <span className="text-white">{c.lead_status ?? '—'}</span></div>
                                        <div><span className="text-white/40">Duration:</span> <span className="text-white">{c.duration_seconds ? `${c.duration_seconds}s` : '—'}</span></div>
                                        <div><span className="text-white/40">Session:</span> <span className="text-white font-mono text-[10px]">{(c.session_id ?? '').slice(0, 16)}…</span></div>
                                        <div><span className="text-white/40">Convo ID:</span> <span className="text-white font-mono text-[10px]">{(c.conversation_id ?? '').slice(0, 16)}…</span></div>
                                      </div>
                                      {c.page_url && (
                                        <div className="pt-2 border-t border-white/[0.06]">
                                          <p className="text-[10px] text-white/40 mb-1">From page:</p>
                                          <a href={c.page_url} target="_blank" rel="noreferrer" className="text-[11px] text-purple-400 hover:text-purple-300 truncate block">{c.page_url}</a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            QUALIFIED AI LEADS TAB — AI conversations turned into real leads
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'qualified' && (() => {
          const allLeads = leadsStore?.leads ?? []
          const qualifiedLeads = allLeads.filter(l => (l.source_sheet ?? '').toLowerCase() === 'ai_qualified_leads' || (l.source ?? '').toLowerCase() === 'ai_qualified_leads')

          if (!leadsStore) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="inline-block w-8 h-8 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin mb-3" />
              <p className="text-white/40 text-sm">Loading qualified leads…</p>
            </div>
          )

          if (qualifiedLeads.length === 0) return (
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-20 text-center">
              <div className="text-3xl mb-3">✦</div>
              <p className="text-white font-semibold">No qualified AI leads yet</p>
              <p className="text-white/40 text-sm mt-1 max-w-md mx-auto">When AI detects buying/investment intent in a conversation, the lead will appear here.</p>
            </div>
          )

          const hotCount     = qualifiedLeads.filter(l => ['hot','high'].includes((l.lead_quality ?? '').toLowerCase())).length
          const warmCount    = qualifiedLeads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'warm').length
          const coldCount    = qualifiedLeads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'cold').length
          const invalidCount = qualifiedLeads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'invalid').length
          const highIntent   = qualifiedLeads.filter(l => ['high','medium'].includes((l.buyer_intent ?? '').toLowerCase())).length

          // Conversion rate vs total AI conversations
          const conversionRate = (convos && convos.total > 0) ? ((qualifiedLeads.length / convos.total) * 100).toFixed(1) : '—'

          // Score buckets
          const scoreBuckets = [
            { name: '0-19 Invalid', count: qualifiedLeads.filter(l => Number(l.lead_score ?? 0) < 20).length, color: '#EF4444' },
            { name: '20-49 Cold',   count: qualifiedLeads.filter(l => { const s = Number(l.lead_score ?? 0); return s >= 20 && s < 50 }).length, color: '#F97316' },
            { name: '50-79 Warm',   count: qualifiedLeads.filter(l => { const s = Number(l.lead_score ?? 0); return s >= 50 && s < 80 }).length, color: '#F59E0B' },
            { name: '80-100 Hot',   count: qualifiedLeads.filter(l => Number(l.lead_score ?? 0) >= 80).length, color: '#10B981' },
          ]

          const intentDist = ['high', 'medium', 'low', 'none'].map(intent => ({
            name: intent,
            count: qualifiedLeads.filter(l => (l.buyer_intent ?? '').toLowerCase() === intent).length,
          }))

          return (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <KpiCard label="Qualified Total" value={fmtNum(qualifiedLeads.length)} sub="AI-detected intent" accent={PURPLE} />
                <KpiCard label="AI Conv. Rate" value={typeof conversionRate === 'string' ? conversionRate + '%' : '—'} sub="vs AI conversations" accent={GREEN} />
                <KpiCard label="Hot" value={fmtNum(hotCount)} sub="score ≥ 80" accent={'#10B981'} />
                <KpiCard label="Warm" value={fmtNum(warmCount)} sub="score 50-79" accent={GOLD} />
                <KpiCard label="High Intent" value={fmtNum(highIntent)} sub="medium + high" accent={BLUE} />
              </div>

              {/* Distributions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Quality donut */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Lead Quality</h3>
                  <p className="text-white/30 text-xs mb-4">Hot / Warm / Cold / Invalid breakdown</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="45%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Hot', value: hotCount },
                            { name: 'Warm', value: warmCount },
                            { name: 'Cold', value: coldCount },
                            { name: 'Invalid', value: invalidCount },
                          ]}
                          cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2} dataKey="value" nameKey="name"
                        >
                          <Cell fill="#10B981" stroke="none" />
                          <Cell fill="#F59E0B" stroke="none" />
                          <Cell fill="#3B82F6" stroke="none" />
                          <Cell fill="#EF4444" stroke="none" />
                        </Pie>
                        <Tooltip content={<DarkTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2 text-xs">
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" />Hot</span><span className="text-white/60 tabular-nums">{hotCount}</span></div>
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />Warm</span><span className="text-white/60 tabular-nums">{warmCount}</span></div>
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Cold</span><span className="text-white/60 tabular-nums">{coldCount}</span></div>
                      <div className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" />Invalid</span><span className="text-white/60 tabular-nums">{invalidCount}</span></div>
                    </div>
                  </div>
                </div>

                {/* Score distribution */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-1">Lead Score Distribution</h3>
                  <p className="text-white/30 text-xs mb-4">Score buckets across qualified leads</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={scoreBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={50}>
                        {scoreBuckets.map((b, i) => <Cell key={i} fill={b.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Intent + Urgency */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Buyer Intent Distribution</h3>
                <p className="text-white/30 text-xs mb-4">How interested each qualified lead is</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={intentDist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="count" name="Leads" fill={PURPLE} radius={[6, 6, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Qualified leads table */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6 overflow-hidden">
                <h3 className="text-sm font-semibold text-white mb-1">Qualified AI Leads</h3>
                <p className="text-white/30 text-xs mb-5">Conversations that converted to real leads</p>
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-white/40 text-[10px] uppercase tracking-wider border-b border-white/[0.06]">
                        <th className="text-left py-3 px-2 font-semibold">Name · Contact</th>
                        <th className="text-left py-3 px-2 font-semibold">Property Interest</th>
                        <th className="text-left py-3 px-2 font-semibold">Quality</th>
                        <th className="text-right py-3 px-2 font-semibold tabular-nums">Score</th>
                        <th className="text-left py-3 px-2 font-semibold">Intent</th>
                        <th className="text-left py-3 px-2 font-semibold">Next Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifiedLeads.slice(0, 30).map(l => (
                        <tr key={l.id} className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-2">
                            <div className="text-white font-medium">{l.full_name ?? <span className="text-white/30">—</span>}</div>
                            <div className="text-[10px] text-white/40 truncate max-w-[180px]">{l.email ?? l.phone ?? '—'}</div>
                          </td>
                          <td className="py-3 px-2 text-white/70"><div className="truncate max-w-[260px]">{l.property_interest ?? <span className="text-white/30">—</span>}</div></td>
                          <td className="py-3 px-2">
                            {l.lead_quality ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize" style={{
                                background: l.lead_quality === 'hot' ? 'rgba(16,185,129,0.15)' : l.lead_quality === 'warm' ? 'rgba(245,158,11,0.15)' : l.lead_quality === 'invalid' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
                                color: l.lead_quality === 'hot' ? '#10B981' : l.lead_quality === 'warm' ? '#F59E0B' : l.lead_quality === 'invalid' ? '#EF4444' : '#3B82F6',
                              }}>{l.lead_quality}</span>
                            ) : <span className="text-white/30">—</span>}
                          </td>
                          <td className="text-right py-3 px-2 tabular-nums font-semibold" style={{ color: Number(l.lead_score ?? 0) >= 50 ? GREEN : 'rgba(255,255,255,0.5)' }}>{l.lead_score ?? '—'}</td>
                          <td className="py-3 px-2 text-white/70 capitalize">{l.buyer_intent ?? <span className="text-white/30">—</span>}</td>
                          <td className="py-3 px-2 text-white/70"><div className="truncate max-w-[200px]">{l.recommended_next_action ?? <span className="text-white/30">—</span>}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            COMBINED LEAD PERFORMANCE (form + qualified AI) — was: LEADS CRM
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'combined' && (() => {
          const leads       = leadsStore?.leads ?? []
          const leadsTotal  = leadsStore?.total ?? 0
          const hotCount    = leads.filter(l => ['hot','high'].includes((l.lead_quality ?? '').toLowerCase())).length
          const warmCount   = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'warm').length
          const coldCount   = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'cold').length
          const scores      = leads.map(l => Number(l.lead_score)).filter(n => !isNaN(n) && n > 0)
          const avgScore    = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(0) : '0'
          const today       = new Date().toISOString().slice(0, 10)
          const todayCount  = leads.filter(l => (l.inserted_at ?? '').slice(0, 10) === today).length

          const qStyle = (q: string | null) => {
            const map: Record<string, { bg: string; text: string; label: string }> = {
              hot:     { bg: 'bg-orange-500/15 border border-orange-500/30', text: 'text-orange-400', label: 'Hot'     },
              high:    { bg: 'bg-red-500/15 border border-red-500/30',       text: 'text-red-400',    label: 'High'    },
              warm:    { bg: 'bg-yellow-500/15 border border-yellow-500/30', text: 'text-yellow-400', label: 'Warm'    },
              cold:    { bg: 'bg-blue-500/15 border border-blue-500/30',     text: 'text-blue-400',   label: 'Cold'    },
              invalid: { bg: 'bg-white/5 border border-white/10',            text: 'text-white/30',   label: 'Invalid' },
            }
            return map[(q ?? '').toLowerCase()] ?? { bg: 'bg-white/5 border border-white/10', text: 'text-white/40', label: q ?? '—' }
          }
          const scoreColor = (s: number | null) => !s ? 'text-white/30' : s >= 70 ? 'text-orange-400' : s >= 40 ? 'text-yellow-400' : 'text-blue-400'
          const fmtDate = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })

          return (
            <div className="space-y-4">

              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <KpiCard label="Total Leads"  value={String(leadsTotal)} sub="All sources"       accent={PURPLE} />
                <KpiCard label="Hot / High"   value={String(hotCount)}   sub="Top priority"      accent="#F97316" />
                <KpiCard label="Warm"         value={String(warmCount)}  sub="Follow up needed"  accent={GOLD}   />
                <KpiCard label="Cold"         value={String(coldCount)}  sub="Needs nurturing"   accent={BLUE}   />
                <KpiCard label="Avg Score"    value={avgScore}           sub="Out of 100"         accent={GREEN}  />
                <KpiCard label="Today"        value={String(todayCount)} sub="New leads"          accent="#A855F7" />
              </div>

              {/* CEO Report */}
              <div className="flex justify-end">
                <button onClick={runCeoReport} disabled={ceoLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
                  {ceoLoading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Analyzing…</> : <>✦ CEO Report</>}
                </button>
              </div>

              {showCeo && (
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden" style={{ borderTopColor: PURPLE, borderTopWidth: 2 }}>
                  <div className="p-4 flex items-center justify-between border-b border-white/[0.06]">
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">✦ AI CEO Report</span>
                    <button onClick={() => setShowCeo(false)} className="text-white/20 hover:text-white/50 transition-colors text-xl leading-none">×</button>
                  </div>
                  {ceoLoading && <div className="flex items-center justify-center py-12 gap-4"><div className="w-10 h-10 border-2 border-t-purple-500 border-purple-500/20 rounded-full animate-spin" /><p className="text-white/40 text-sm">Analyzing leads…</p></div>}
                  {ceoError && !ceoLoading && <div className="p-5 text-center"><p className="text-red-400 text-sm">{ceoError}</p></div>}
                  {ceoReport && !ceoLoading && (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-4 gap-3">
                        {[{ l:'Total', v: ceoReport.stats.total, c: PURPLE }, { l:'Hot/High', v: ceoReport.stats.hot, c:'#F97316' }, { l:'Warm', v: ceoReport.stats.warm, c: GOLD }, { l:'Avg Score', v: ceoReport.stats.avgScore, c: GREEN }].map(({ l, v, c }) => (
                          <div key={l} className="bg-white/[0.03] rounded-xl p-3 text-center border border-white/[0.05]">
                            <p className="text-xl font-bold" style={{ color: c }}>{v}</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">{l}</p>
                          </div>
                        ))}
                      </div>
                      <div className="p-4 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">Executive Summary</p>
                        <p className="text-white/80 text-sm leading-relaxed">{ceoReport.report.executive_summary}</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                          <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest mb-2">Quality Analysis</p>
                          <p className="text-white/70 text-sm leading-relaxed">{ceoReport.report.quality_analysis}</p>
                        </div>
                        <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                          <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-2">Priority Leads</p>
                          <p className="text-white/70 text-sm leading-relaxed">{ceoReport.report.priority_leads}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-white/[0.03] rounded-xl border-l-2 border border-white/[0.06]" style={{ borderLeftColor: GREEN }}>
                        <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-2">Sales Team — Action</p>
                        <p className="text-white/70 text-sm leading-relaxed">{ceoReport.report.sales_action}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {ceoReport.report.immediate_actions?.map((a, i) => (
                          <div key={i} className="bg-white/[0.03] rounded-xl p-4 border-t-2 border border-white/[0.05]"
                            style={{ borderTopColor: i === 0 ? RED : i === 1 ? GOLD : PURPLE }}>
                            <span className="text-[10px] bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5 text-white/40">{a.timeframe}</span>
                            <p className="text-sm text-white/80 leading-relaxed mt-2 mb-1">{a.action}</p>
                            <p className="text-xs text-white/35">{a.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Filters */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  <div className="xl:col-span-2 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">🔍</span>
                    <input type="text" placeholder="Search name, email, phone…" value={leadsSearch} onChange={e => setLeadsSearch(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 pl-8 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors" />
                  </div>
                  <select value={leadsQuality} onChange={e => setLeadsQuality(e.target.value)}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50 transition-colors">
                    <option value="">All Qualities</option>
                    <option value="hot">🔥 Hot</option>
                    <option value="high">⭐ High</option>
                    <option value="warm">🌡 Warm</option>
                    <option value="cold">❄️ Cold</option>
                    <option value="invalid">✗ Invalid</option>
                  </select>
                  <input type="text" placeholder="🌍 Country" value={leadsCountry} onChange={e => setLeadsCountry(e.target.value)}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors" />
                  <input type="text" placeholder="📋 Source sheet" value={leadsSheet} onChange={e => setLeadsSheet(e.target.value)}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors" />
                  <button onClick={() => { setLeadsSearch(''); setLeadsQuality(''); setLeadsCountry(''); setLeadsProperty(''); setLeadsSheet('') }}
                    className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                    Clear filters
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">All Leads</h3>
                    <p className="text-white/30 text-xs mt-0.5">{leadsTotal.toLocaleString()} leads found</p>
                  </div>
                  {leadsStore && leadsStore.totalPages > 1 && (
                    <span className="text-xs text-white/30">Page {leadsPage} of {leadsStore.totalPages}</span>
                  )}
                </div>

                {leadsLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
                    </div>
                  </div>
                )}

                {leadsError && !leadsLoading && (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <p className="text-red-400 text-sm">{leadsError}</p>
                    <button onClick={() => loadLeads(leadsPage)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Retry</button>
                  </div>
                )}

                {!leadsLoading && !leadsError && leads.length === 0 && (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <span className="text-3xl">📭</span>
                    <p className="text-white/30 text-sm">No leads found</p>
                  </div>
                )}

                {!leadsLoading && !leadsError && leads.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {['Name','Phone','Email','Country','Property','Budget','Quality','Score','Next Action','Created'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map(lead => {
                          const qs = qStyle(lead.lead_quality)
                          const isExp = expandedLead === lead.id
                          return (
                            <>
                              <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                                onClick={() => setExpandedLead(isExp ? null : lead.id)}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <p className="text-white font-medium">{lead.full_name || '—'}</p>
                                  {lead.city && <p className="text-white/25 text-[10px]">{lead.city}</p>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-white/55">{lead.phone || '—'}</span></td>
                                <td className="px-4 py-3 max-w-[160px]"><span className="text-white/55 truncate block">{lead.email || '—'}</span></td>
                                <td className="px-4 py-3 whitespace-nowrap text-white/55">{lead.country || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-white/55">{lead.property_interest || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap max-w-[100px]"><span className="text-white/40 truncate block">{lead.budget || '—'}</span></td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${qs.bg} ${qs.text}`}>{qs.label}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`text-base font-bold ${scoreColor(lead.lead_score)}`}>{lead.lead_score ?? '—'}</span>
                                </td>
                                <td className="px-4 py-3 max-w-[200px]">
                                  <p className="text-white/40 text-[10px] leading-relaxed line-clamp-2">{lead.recommended_next_action || '—'}</p>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-white/30 text-[10px]">{fmtDate(lead.inserted_at)}</td>
                              </tr>
                              {isExp && (
                                <tr key={`${lead.id}-exp`} className="bg-white/[0.02] border-b border-white/[0.04]">
                                  <td colSpan={10} className="px-6 py-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {lead.short_summary && (
                                        <div className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                                          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1.5">AI Summary</p>
                                          <p className="text-white/65 text-xs leading-relaxed">{lead.short_summary}</p>
                                        </div>
                                      )}
                                      {lead.recommended_next_action && (
                                        <div className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl">
                                          <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-1.5">Recommended Action</p>
                                          <p className="text-white/65 text-xs leading-relaxed">{lead.recommended_next_action}</p>
                                        </div>
                                      )}
                                      <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">Additional Details</p>
                                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                                          {([['Buyer Intent', lead.buyer_intent], ['Status', lead.status], ['Language', lead.language], ['Campaign', lead.campaign_source], ['UTM Source', lead.utm_source], ['Location', lead.preferred_location]] as [string, string | null][]).filter(([, v]) => v).map(([k, v]) => (
                                            <div key={k}><span className="text-white/25">{k}: </span><span className="text-white/60">{v}</span></div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {!leadsLoading && leadsStore && leadsStore.totalPages > 1 && (
                  <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
                    <button onClick={() => loadLeads(leadsPage - 1)} disabled={leadsPage <= 1}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      ← Previous
                    </button>
                    <span className="text-xs text-white/30">Page {leadsPage} of {leadsStore.totalPages}</span>
                    <button onClick={() => loadLeads(leadsPage + 1)} disabled={leadsPage >= leadsStore.totalPages}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      Next →
                    </button>
                  </div>
                )}
              </div>

            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            CALLS TAB (Vapi inbound + outbound)
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'calls' && (() => {
          const calls       = callsStore?.calls ?? []
          const callsTotal  = callsStore?.total ?? 0
          const s           = callsStore?.stats ?? { total:0,inbound:0,outbound:0,booked:0,interested:0,not_interested:0,no_answer:0,attempts_24h:0 }

          const statusStyle = (st: string | null) => {
            const k = (st ?? '').toLowerCase()
            if (k === 'booked')           return { bg: 'bg-emerald-500/15 border border-emerald-500/30', text: 'text-emerald-400', label: 'Booked' }
            if (k === 'completed')        return { bg: 'bg-green-500/15 border border-green-500/30',    text: 'text-green-400',   label: 'Completed' }
            if (k === 'in_progress')      return { bg: 'bg-purple-500/15 border border-purple-500/30',   text: 'text-purple-400',  label: 'In Progress' }
            if (k === 'initiated')        return { bg: 'bg-blue-500/15 border border-blue-500/30',      text: 'text-blue-400',    label: 'Initiated' }
            if (k === 'no_answer' || k === 'failed') return { bg: 'bg-yellow-500/15 border border-yellow-500/30', text: 'text-yellow-400', label: k === 'no_answer' ? 'No Answer' : 'Failed' }
            if (k === 'not_interested')   return { bg: 'bg-red-500/15 border border-red-500/30',        text: 'text-red-400',     label: 'Not Interested' }
            if (k === 'do_not_call')      return { bg: 'bg-red-500/15 border border-red-500/30',        text: 'text-red-400',     label: 'Do Not Call' }
            return { bg: 'bg-white/5 border border-white/10', text: 'text-white/40', label: st ?? '—' }
          }

          const sourceBadge = (src: string | null) => {
            if (src === 'inbound')             return { bg:'bg-cyan-500/15 border border-cyan-500/30',    text:'text-cyan-400',    icon:'📲', label:'Inbound' }
            if (src === 'outbound_campaign')   return { bg:'bg-purple-500/15 border border-purple-500/30',text:'text-purple-400',  icon:'📤', label:'Campaign' }
            if (src === 'manual')              return { bg:'bg-amber-500/15 border border-amber-500/30',  text:'text-amber-400',   icon:'👤', label:'Manual' }
            return { bg:'bg-white/5 border border-white/10', text:'text-white/40', icon:'•', label: src ?? '—' }
          }

          const fmtDateTime = (d: string | null) => {
            if (!d) return '—'
            return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
          }

          return (
            <div className="space-y-4">

              {/* KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                <KpiCard label="Total Calls"    value={String(s.total)}          accent={PURPLE} />
                <KpiCard label="📲 Inbound"     value={String(s.inbound)}        accent="#06B6D4" />
                <KpiCard label="📤 Outbound"    value={String(s.outbound)}       accent="#A855F7" />
                <KpiCard label="Booked"         value={String(s.booked)}         accent={GREEN}  />
                <KpiCard label="Interested"     value={String(s.interested)}     accent="#22C55E" />
                <KpiCard label="Not Interested" value={String(s.not_interested)} accent={RED}    />
                <KpiCard label="No Answer"      value={String(s.no_answer)}      accent={GOLD}   />
                <KpiCard label="Last 24h"       value={String(s.attempts_24h)}   accent={BLUE}   />
              </div>

              {/* Vapi connection status banner */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <span className="text-xs text-white/40 uppercase tracking-widest font-semibold">🔗 Vapi Webhooks</span>
                <span className="text-xs text-white/30">Inbound:</span>
                <code className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">analytics-test.app.n8n.cloud/webhook/vapi-inbound-call</code>
                <span className="text-xs text-white/30 ml-2">Call Ended:</span>
                <code className="text-xs text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">analytics-test.app.n8n.cloud/webhook/vapi-call-ended</code>
              </div>

              {/* Filters */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">🔍</span>
                    <input type="text" placeholder="Search name, email, phone…" value={callsSearch} onChange={e => setCallsSearch(e.target.value)}
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 pl-8 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors" />
                  </div>
                  <select value={callsSource} onChange={e => setCallsSource(e.target.value)}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50">
                    <option value="">All Sources</option>
                    <option value="inbound">📲 Inbound</option>
                    <option value="outbound_campaign">📤 Campaign</option>
                    <option value="manual">👤 Manual</option>
                  </select>
                  <select value={callsStatus} onChange={e => setCallsStatus(e.target.value)}
                    className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50">
                    <option value="">All Statuses</option>
                    <option value="initiated">Initiated</option>
                    <option value="completed">Completed</option>
                    <option value="booked">Booked</option>
                    <option value="no_answer">No Answer</option>
                    <option value="failed">Failed</option>
                    <option value="not_interested">Not Interested</option>
                  </select>
                  <button onClick={() => { setCallsSearch(''); setCallsSource(''); setCallsStatus('') }}
                    className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">
                    Clear filters
                  </button>
                </div>
              </div>

              {/* Empty / Loading / Error */}
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Call Activity</h3>
                    <p className="text-white/30 text-xs mt-0.5">{callsTotal.toLocaleString()} calls · click row to see transcript</p>
                  </div>
                  {callsStore && callsStore.totalPages > 1 && (
                    <span className="text-xs text-white/30">Page {callsPage} of {callsStore.totalPages}</span>
                  )}
                </div>

                {callsLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="relative w-10 h-10">
                      <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                      <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
                    </div>
                  </div>
                )}

                {callsError && !callsLoading && (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <p className="text-red-400 text-sm">{callsError}</p>
                    <button onClick={() => loadCalls(callsPage)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Retry</button>
                  </div>
                )}

                {!callsLoading && !callsError && calls.length === 0 && (
                  <div className="flex flex-col items-center py-16 gap-3 px-6 text-center">
                    <span className="text-4xl">📞</span>
                    <p className="text-white/70 text-base font-medium">No calls yet</p>
                    <p className="text-white/30 text-sm max-w-md">
                      Once Vapi sends an inbound call or an outbound campaign runs, calls will appear here automatically.
                      <br/>
                      <span className="text-white/50 mt-2 block">Wiring is ready — webhooks <code className="text-purple-400">/api/webhook/voice-leads</code>, <code className="text-purple-400">/api/webhook/call-attempts</code>, and <code className="text-purple-400">/api/webhook/update-lead</code> are live.</span>
                    </p>
                  </div>
                )}

                {!callsLoading && !callsError && calls.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {['Type','Caller','Phone','Status','Interest','Attempts','Last Called','Appointment'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-white/30 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calls.map(call => {
                          const src   = sourceBadge(call.voice_source)
                          const stat  = statusStyle(call.call_status)
                          const isExp = expandedCall === call.id
                          return (
                            <>
                              <tr key={call.id}
                                className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                                onClick={() => setExpandedCall(isExp ? null : call.id)}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${src.bg} ${src.text}`}>
                                    <span>{src.icon}</span> {src.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <p className="text-white font-medium">{call.full_name || '—'}</p>
                                  {call.email && <p className="text-white/30 text-[10px]">{call.email}</p>}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap font-mono text-white/55">{call.phone || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stat.bg} ${stat.text}`}>{stat.label}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-white/55">{call.interest_status || '—'}</td>
                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                  <span className="text-white/40">{call.call_attempt_count ?? 0}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-white/30 text-[10px]">{fmtDateTime(call.last_called_at)}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {call.appointment_status ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      call.appointment_status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
                                      call.appointment_status === 'cancelled' ? 'bg-red-500/15 text-red-400 border border-red-500/30'             :
                                                                                'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                                    }`}>{call.appointment_status}</span>
                                  ) : <span className="text-white/20 text-[10px]">—</span>}
                                </td>
                              </tr>
                              {isExp && (
                                <tr key={`${call.id}-exp`} className="bg-white/[0.02] border-b border-white/[0.04]">
                                  <td colSpan={8} className="px-6 py-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {call.call_summary && (
                                        <div className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                                          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1.5">📝 Call Summary</p>
                                          <p className="text-white/65 text-xs leading-relaxed">{call.call_summary}</p>
                                        </div>
                                      )}
                                      {call.call_transcript && (
                                        <div className="p-3 bg-cyan-500/5 border border-cyan-500/15 rounded-xl max-h-48 overflow-y-auto">
                                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1.5">🎙 Transcript</p>
                                          <p className="text-white/65 text-xs leading-relaxed whitespace-pre-wrap">{call.call_transcript}</p>
                                        </div>
                                      )}
                                      <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl md:col-span-2">
                                        <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">Lead Details</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                          {([
                                            ['Vapi Call ID',   call.vapi_call_id ? call.vapi_call_id.slice(0,12)+'…' : null],
                                            ['Property',       call.property_interest],
                                            ['Budget',         call.budget],
                                            ['Location Pref.', call.preferred_location],
                                            ['Country',        call.country],
                                            ['City',           call.city],
                                            ['Quality',        call.lead_quality],
                                            ['Score',          call.lead_score ? String(call.lead_score) : null],
                                            ['Buyer Intent',   call.buyer_intent],
                                            ['Follow-up',      call.follow_up_priority],
                                            ['Sales Rep',      call.assigned_sales_manager],
                                            ['Appt. Time',     call.appointment_time ? fmtDateTime(call.appointment_time) : null],
                                            ['Next Call',      call.next_call_at ? fmtDateTime(call.next_call_at) : null],
                                            ['Source Sheet',   call.source_sheet],
                                          ] as [string, string|null][]).filter(([,v]) => v).map(([k,v]) => (
                                            <div key={k}><span className="text-white/25">{k}: </span><span className="text-white/65">{v}</span></div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {!callsLoading && callsStore && callsStore.totalPages > 1 && (
                  <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
                    <button onClick={() => loadCalls(callsPage - 1)} disabled={callsPage <= 1}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all">← Previous</button>
                    <span className="text-xs text-white/30">Page {callsPage} of {callsStore.totalPages}</span>
                    <button onClick={() => loadCalls(callsPage + 1)} disabled={callsPage >= callsStore.totalPages}
                      className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all">Next →</button>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* ════════════════════════════════════════════════════════════════════
            VOICE TAB — placeholder until Vapi pipeline lands
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'voice' && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl py-16 px-6 text-center">
            <div className="text-4xl mb-3">🎙</div>
            <p className="text-white font-semibold text-lg">Voice Leads & Conversations</p>
            <p className="text-white/40 text-sm mt-2 max-w-md mx-auto">
              The voice pipeline (Vapi inbound calls + outbound campaigns) isn&apos;t connected yet.
              When it is, calls and transcripts will land here automatically.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Awaiting Vapi credential & first call
            </div>
          </div>
        )}
        {/* ════════════════════════════════════════════════════════════════════
            AI INSIGHTS TAB
        ════════════════════════════════════════════════════════════════════ */}
        {tab === 'ai' && (
          <div className="space-y-4">
            {/* Empty state */}
            {!analysis && !loadingAnalysis && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl flex flex-col items-center py-20 gap-5">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-2xl animate-pulse"
                    style={{ background: 'linear-gradient(135deg, #7C3AED33, #A855F733)' }} />
                  <div className="absolute inset-0 flex items-center justify-center text-3xl">✦</div>
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-lg">Claude AI Analysis</p>
                  <p className="text-white/30 text-sm mt-2 max-w-sm px-4">
                    Get AI-powered insights combining your GA4 traffic data and Google Ads performance.
                  </p>
                </div>
                <button onClick={runAnalysis} disabled={!hasData}
                  className="px-8 py-3 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
                  Run Analysis
                </button>
              </div>
            )}

            {/* Loading */}
            {loadingAnalysis && (
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl flex flex-col items-center py-20 gap-5">
                <div className="relative w-14 h-14">
                  <div className="absolute inset-0 rounded-full border border-purple-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
                  <div className="absolute inset-2 rounded-full border border-purple-400/20" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold">Analyzing your data…</p>
                  <p className="text-white/30 text-xs mt-2">Claude is reviewing GA4 + Google Ads · up to 60 seconds</p>
                </div>
              </div>
            )}

            {/* Error */}
            {analysisError && !loadingAnalysis && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl flex flex-col items-center py-14 gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-2xl">⚠</div>
                <p className="text-red-400 font-semibold">Analysis failed</p>
                <p className="text-white/30 text-sm text-center max-w-sm">{analysisError}</p>
                <button onClick={runAnalysis}
                  className="mt-1 bg-white/[0.06] hover:bg-white/10 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors">
                  Try again
                </button>
              </div>
            )}

            {/* Results */}
            {analysis && !loadingAnalysis && (
              <>
                {/* Score + Summary */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6"
                  style={{ borderImage: 'linear-gradient(135deg, #7C3AED40, #A855F720) 1' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    {/* Score ring */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
                          <circle cx="44" cy="44" r="38" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                          <circle cx="44" cy="44" r="38" fill="none" stroke="url(#scoreGrad)" strokeWidth="8"
                            strokeDasharray={`${2 * Math.PI * 38 * (analysis.score ?? 0) / 100} ${2 * Math.PI * 38}`}
                            strokeLinecap="round" />
                          <defs>
                            <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#7C3AED" />
                              <stop offset="100%" stopColor="#A855F7" />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-bold text-white">{analysis.score ?? '—'}</span>
                          <span className="text-[9px] text-white/30 uppercase tracking-wider">SEO Score</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-400">Executive Summary</span>
                      </div>
                      <p className="text-white/80 text-sm leading-relaxed">{analysis.summary}</p>
                    </div>
                  </div>

                  {analysis.metrics && (
                    <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/[0.06]">
                      {[
                        { label: 'Conversion Rate', value: `${analysis.metrics.conversionRate ?? 0}%`, color: PURPLE },
                        { label: 'Engagement Score', value: String(analysis.metrics.engagementScore ?? 0), color: BLUE },
                        { label: 'Intl. Traffic',   value: `${analysis.metrics.internationalTraffic ?? 0}%`, color: TEAL },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="text-center">
                          <p className="text-xl font-bold" style={{ color }}>{value}</p>
                          <p className="text-[10px] text-white/30 uppercase tracking-wider mt-1">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Insights + SEO Recs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: PURPLE }}>Key Insights</h4>
                    <div className="space-y-3">
                      {analysis.topInsights?.map((ins, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                          <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                            ins.impact === 'high'   ? 'bg-purple-500/20 text-purple-400' :
                            ins.impact === 'medium' ? 'bg-blue-500/20 text-blue-400'     : 'bg-white/10 text-white/40'
                          }`}>{ins.impact}</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{ins.title}</p>
                            <p className="text-xs text-white/40 leading-relaxed">{ins.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: BLUE }}>SEO Recommendations</h4>
                    <div className="space-y-3">
                      {analysis.seoRecommendations?.map((rec, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                          <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                            rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400'       :
                            rec.priority === 'high'   ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>{rec.priority}</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{rec.title}</p>
                            <p className="text-xs text-white/40 leading-relaxed">{rec.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Priority Actions */}
                <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: GREEN }}>Priority Actions</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {analysis.priorityActions?.map((a, i) => (
                      <div key={i} className="bg-white/[0.03] rounded-xl p-4 border-t-2 border border-white/[0.04]"
                        style={{ borderTopColor: i === 0 ? RED : i === 1 ? GOLD : GREEN }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] text-white/30 bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">{a.timeframe}</span>
                          <span className="text-[10px] font-bold" style={{ color: a.impact === 'high' ? GOLD : 'rgba(255,255,255,0.3)' }}>{a.impact}</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed">{a.action}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Content Gaps + Geo */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: RED }}>Content Gaps</h4>
                    <div className="space-y-3">
                      {analysis.contentGaps?.map((g, i) => (
                        <div key={i} className="flex gap-3 items-start p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                          <span className="text-lg leading-none flex-shrink-0" style={{ color: RED }}>!</span>
                          <div>
                            <p className="text-sm font-semibold text-white mb-0.5">{g.topic}</p>
                            <p className="text-xs text-white/40">{g.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white/[0.04] rounded-2xl p-5 border-l-2" style={{ borderColor: PURPLE, borderTopColor: 'rgba(255,255,255,0.08)', borderRightColor: 'rgba(255,255,255,0.08)', borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: PURPLE }}>Geographic Strategy</h4>
                    <p className="text-sm text-white/70 leading-relaxed">{analysis.geographicOpportunities}</p>
                  </div>
                </div>

                {/* Google Ads Analysis */}
                {analysis.adsAnalysis && (
                  <div className="space-y-4">
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6"
                      style={{ borderTopColor: BLUE, borderTopWidth: 2 }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-base">📢</span>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BLUE }}>Google Ads Analysis</h4>
                        <span className={`ml-auto text-[10px] font-bold px-3 py-1 rounded-full ${
                          analysis.adsAnalysis.budgetEfficiency === 'high'   ? 'bg-emerald-500/20 text-emerald-400' :
                          analysis.adsAnalysis.budgetEfficiency === 'medium' ? 'bg-yellow-500/20 text-yellow-400'  :
                                                                               'bg-red-500/20 text-red-400'
                        }`}>
                          {analysis.adsAnalysis.budgetEfficiency?.toUpperCase()} EFFICIENCY
                        </span>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed mb-4">{analysis.adsAnalysis.overallAssessment}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Top Performing</p>
                          <p className="text-sm text-white font-semibold">{analysis.adsAnalysis.topPerformingCampaign}</p>
                        </div>
                        <div className="bg-red-500/5 border border-red-500/15 rounded-xl p-3">
                          <p className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-1">Needs Attention</p>
                          <p className="text-sm text-white font-semibold">{analysis.adsAnalysis.weakestCampaign}</p>
                        </div>
                      </div>

                      <div className="p-3 bg-white/[0.03] rounded-xl border-l-2" style={{ borderLeftColor: GOLD }}>
                        <p className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: GOLD }}>Cost Per Lead</p>
                        <p className="text-xs text-white/60 leading-relaxed">{analysis.adsAnalysis.costPerLeadAssessment}</p>
                      </div>
                    </div>

                    {analysis.adsAnalysis.recommendations?.length > 0 && (
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: BLUE }}>Ads Recommendations</h4>
                        <div className="space-y-3">
                          {analysis.adsAnalysis.recommendations.map((rec, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                              <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                                rec.priority === 'urgent' ? 'bg-red-500/20 text-red-400'       :
                                rec.priority === 'high'   ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>{rec.priority}</span>
                              <div>
                                <p className="text-sm font-semibold text-white mb-0.5">{rec.title}</p>
                                <p className="text-xs text-white/40 leading-relaxed">{rec.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Leads Funnel Analysis ── */}
                {analysis.leadsAnalysis && (
                  <div className="space-y-4">
                    {/* Header card */}
                    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 md:p-6"
                      style={{ borderTopColor: GREEN, borderTopWidth: 2 }}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-base">👥</span>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GREEN }}>
                          Leads CRM Analysis
                        </h4>
                      </div>

                      {/* Funnel + Quality */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                          <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-2">Full Funnel Assessment</p>
                          <p className="text-sm text-white/75 leading-relaxed">{analysis.leadsAnalysis.funnelAssessment}</p>
                        </div>
                        <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                          <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest mb-2">Lead Quality Breakdown</p>
                          <p className="text-sm text-white/75 leading-relaxed">{analysis.leadsAnalysis.qualityBreakdown}</p>
                        </div>
                      </div>

                      {/* Source effectiveness */}
                      <div className="p-4 bg-white/[0.03] rounded-xl border-l-2 border border-white/[0.06] mb-4"
                        style={{ borderLeftColor: TEAL }}>
                        <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mb-2">Source Effectiveness</p>
                        <p className="text-sm text-white/75 leading-relaxed">{analysis.leadsAnalysis.sourceEffectiveness}</p>
                      </div>

                      {/* Cross-channel insight */}
                      <div className="p-4 rounded-xl border border-purple-500/20"
                        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(168,85,247,0.04))' }}>
                        <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">🔗 Cross-Channel Insight</p>
                        <p className="text-sm text-white/80 leading-relaxed">{analysis.leadsAnalysis.crossChannelInsight}</p>
                      </div>
                    </div>

                    {/* Top opportunities */}
                    {analysis.leadsAnalysis.topOpportunities?.length > 0 && (
                      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest mb-4" style={{ color: GREEN }}>
                          Lead Opportunities
                        </h4>
                        <div className="space-y-3">
                          {analysis.leadsAnalysis.topOpportunities.map((opp, i) => (
                            <div key={i} className="flex gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                              <span className={`mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 h-fit ${
                                opp.impact === 'high'   ? 'bg-green-500/20 text-green-400'  :
                                opp.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                              }`}>{opp.impact}</span>
                              <div>
                                <p className="text-sm font-semibold text-white mb-0.5">{opp.title}</p>
                                <p className="text-xs text-white/40 leading-relaxed">{opp.detail}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pb-4">
                  <button onClick={runAnalysis} className="text-xs text-white/20 hover:text-purple-400 transition-colors flex items-center gap-1.5">
                    <span className="text-base leading-none">↻</span> Re-run analysis
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] mt-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex items-center justify-between text-xs text-white/20">
          <span>irfaninvest.com · Analytics Dashboard</span>
          <span>Auto-refresh every 5 min</span>
        </div>
      </footer>
    </div>
  )
}
