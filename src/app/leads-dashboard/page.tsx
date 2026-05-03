'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Lead {
  id: number
  lead_id: string | null
  full_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  city: string | null
  property_interest: string | null
  budget: string | null
  preferred_location: string | null
  lead_quality: string | null
  lead_score: number | null
  buyer_intent: string | null
  status: string | null
  recommended_next_action: string | null
  short_summary: string | null
  source: string | null
  source_sheet: string | null
  campaign_source: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  language: string | null
  created_at: string | null
  inserted_at: string | null
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface ImmediateAction { action: string; reason: string; timeframe: string }
interface CeoReport {
  executive_summary: string
  quality_analysis: string
  priority_leads: string
  sales_action: string
  immediate_actions: ImmediateAction[]
  market_insight: string
  score_interpretation: string
}
interface CeoReportResponse {
  report: CeoReport
  generatedAt: string
  stats: { total: number; hot: number; warm: number; cold: number; invalid: number; avgScore: string; highIntent: number; leadsToday: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const QUALITY_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  hot:     { label: 'داغ',    bg: 'bg-orange-500/15 border border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
  high:    { label: 'عالی',   bg: 'bg-red-500/15 border border-red-500/30',       text: 'text-red-400',    dot: 'bg-red-400'    },
  warm:    { label: 'گرم',    bg: 'bg-yellow-500/15 border border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  cold:    { label: 'سرد',    bg: 'bg-blue-500/15 border border-blue-500/30',     text: 'text-blue-400',   dot: 'bg-blue-400'   },
  invalid: { label: 'نامعتبر',bg: 'bg-white/5 border border-white/10',            text: 'text-white/30',   dot: 'bg-white/20'   },
}
const qualityStyle = (q: string | null) =>
  QUALITY_CONFIG[(q ?? '').toLowerCase()] ??
  { label: q ?? '—', bg: 'bg-white/5 border border-white/10', text: 'text-white/40', dot: 'bg-white/20' }

const scoreColor = (s: number | null) => {
  if (!s) return 'text-white/30'
  if (s >= 70) return 'text-orange-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-blue-400'
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label: labelEn, labelFa, value, accent = '#8B5CF6', sub }: {
  label: string; labelFa: string; value: string | number; accent?: string; sub?: string
}) {
  return (
    <div className="relative bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5 overflow-hidden group hover:border-white/20 transition-all duration-300">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}18, transparent 70%)` }} />
      <p className="text-white/35 text-[10px] uppercase tracking-[0.15em] font-semibold z-10 relative">{labelEn}</p>
      <p className="text-[10px] text-white/20 z-10 relative mb-1">{labelFa}</p>
      <p className="text-3xl font-bold text-white z-10 relative tracking-tight">{value}</p>
      {sub && <p className="text-white/25 text-xs z-10 relative mt-1">{sub}</p>}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeadsDashboard() {
  // Data state
  const [data, setData]           = useState<LeadsResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  // Filters
  const [search, setSearch]       = useState('')
  const [quality, setQuality]     = useState('')
  const [country, setCountry]     = useState('')
  const [property, setProperty]   = useState('')
  const [sourceSheet, setSourceSheet] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [page, setPage]           = useState(1)

  // CEO Report
  const [report, setReport]           = useState<CeoReportResponse | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [showReport, setShowReport]   = useState(false)

  // Expanded row
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchLeads = useCallback(async (p = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', '50')
      if (search)      params.set('search', search)
      if (quality)     params.set('quality', quality)
      if (country)     params.set('country', country)
      if (property)    params.set('property', property)
      if (sourceSheet) params.set('source_sheet', sourceSheet)
      if (startDate)   params.set('start_date', startDate)
      if (endDate)     params.set('end_date', endDate)

      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [search, quality, country, property, sourceSheet, startDate, endDate])

  useEffect(() => { fetchLeads(1); setPage(1) }, [fetchLeads])

  const generateReport = async () => {
    setLoadingReport(true); setReportError(null); setShowReport(true)
    try {
      const res = await fetch('/api/ai/leads-ceo-report', { method: 'POST' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setReport(d)
    } catch (e) {
      setReportError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoadingReport(false)
    }
  }

  const leads   = data?.leads ?? []
  const total   = data?.total ?? 0
  const hotCount  = leads.filter(l => ['hot','high'].includes((l.lead_quality ?? '').toLowerCase())).length
  const warmCount = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'warm').length
  const coldCount = leads.filter(l => (l.lead_quality ?? '').toLowerCase() === 'cold').length
  const scores    = leads.map(l => Number(l.lead_score)).filter(n => !isNaN(n) && n > 0)
  const avgScore  = scores.length ? (scores.reduce((s, n) => s + n, 0) / scores.length).toFixed(0) : '0'
  const today     = new Date().toISOString().slice(0, 10)
  const todayCount = leads.filter(l => (l.inserted_at ?? '').slice(0, 10) === today).length

  return (
    <div className="min-h-screen bg-black text-white antialiased">

      {/* ── Header ───────────────────────────────────────────────────────── */}
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
              Leads CRM
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-xs text-white/30 hover:text-white/60 transition-colors hidden sm:block">
              ← Analytics Dashboard
            </a>
            <button onClick={generateReport} disabled={loadingReport}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-40 transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #A855F7)' }}>
              {loadingReport
                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />در حال تحلیل…</>
                : <>✦ گزارش مدیرعامل</>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <div className="pt-2 pb-2">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            مدیریت{' '}
            <span style={{ background: 'linear-gradient(135deg, #8B5CF6, #A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              لیدها
            </span>
          </h1>
          <p className="text-white/30 text-sm mt-1 font-light" dir="rtl">
            {total.toLocaleString()} لید دریافتی از Google Sheets
          </p>
        </div>

        {/* ── KPI Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Total Leads"   labelFa="کل لیدها"        value={total}     accent="#8B5CF6" />
          <KpiCard label="Hot / High"    labelFa="داغ/عالی"        value={hotCount}  accent="#F97316" sub="اولویت بالا" />
          <KpiCard label="Warm"          labelFa="گرم"             value={warmCount} accent="#F59E0B" sub="پیگیری لازم" />
          <KpiCard label="Cold"          labelFa="سرد"             value={coldCount} accent="#3B82F6" sub="نیاز به nurture" />
          <KpiCard label="Avg Score"     labelFa="میانگین امتیاز"  value={avgScore}  accent="#10B981" sub="از ۱۰۰" />
          <KpiCard label="Today"         labelFa="امروز"           value={todayCount} accent="#A855F7" sub="لید جدید" />
        </div>

        {/* ── CEO Report Section ───────────────────────────────────────────── */}
        {showReport && (
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden"
            style={{ borderTopColor: '#8B5CF6', borderTopWidth: 2 }}>
            <div className="p-5 flex items-center justify-between border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="text-lg">✦</span>
                <h2 className="text-sm font-bold text-white">گزارش هوش مصنوعی — مدیرعامل</h2>
              </div>
              <button onClick={() => setShowReport(false)} className="text-white/20 hover:text-white/50 transition-colors text-lg leading-none">×</button>
            </div>

            {loadingReport && (
              <div className="flex flex-col items-center py-12 gap-4">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
                </div>
                <p className="text-white/40 text-sm" dir="rtl">در حال تحلیل لیدها با هوش مصنوعی…</p>
              </div>
            )}

            {reportError && !loadingReport && (
              <div className="p-5 text-center text-red-400 text-sm">{reportError}</div>
            )}

            {report && !loadingReport && (
              <div className="p-5 md:p-6 space-y-5" dir="rtl">
                {/* Summary */}
                <div className="p-4 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-2">خلاصه اجرایی</p>
                  <p className="text-white/80 text-sm leading-relaxed">{report.report.executive_summary}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-widest mb-2">تحلیل کیفیت لیدها</p>
                    <p className="text-white/70 text-sm leading-relaxed">{report.report.quality_analysis}</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest mb-2">لیدهای اولویت‌دار</p>
                    <p className="text-white/70 text-sm leading-relaxed">{report.report.priority_leads}</p>
                  </div>
                </div>

                <div className="p-4 bg-white/[0.03] rounded-xl border-r-2 border border-white/[0.06]" style={{ borderRightColor: '#10B981' }}>
                  <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-2">اقدام فوری تیم فروش</p>
                  <p className="text-white/70 text-sm leading-relaxed">{report.report.sales_action}</p>
                </div>

                {/* 3 Immediate Actions */}
                <div>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-3">۳ اقدام فوری</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {report.report.immediate_actions?.map((a, i) => (
                      <div key={i} className="bg-white/[0.03] rounded-xl p-4 border-t-2 border border-white/[0.05]"
                        style={{ borderTopColor: i === 0 ? '#EF4444' : i === 1 ? '#F59E0B' : '#8B5CF6' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] bg-white/[0.05] border border-white/10 rounded-full px-2 py-0.5 text-white/40">{a.timeframe}</span>
                          <span className="text-xs font-bold text-white/20">#{i + 1}</span>
                        </div>
                        <p className="text-sm text-white/80 leading-relaxed mb-2">{a.action}</p>
                        <p className="text-xs text-white/35 leading-relaxed">{a.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-2">بینش بازار</p>
                    <p className="text-white/70 text-sm leading-relaxed">{report.report.market_insight}</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                    <p className="text-[10px] text-teal-400 font-bold uppercase tracking-widest mb-2">تفسیر امتیاز</p>
                    <p className="text-white/70 text-sm leading-relaxed">{report.report.score_interpretation}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                  <p className="text-[10px] text-white/20">
                    تولید شده: {new Date(report.generatedAt).toLocaleString('fa-IR')}
                  </p>
                  <button onClick={generateReport}
                    className="text-xs text-white/20 hover:text-purple-400 transition-colors flex items-center gap-1">
                    ↻ بازسازی گزارش
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* Search */}
            <div className="xl:col-span-2 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">🔍</span>
              <input
                type="text" placeholder="جستجو: نام، ایمیل، تلفن…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 pl-8 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
                dir="rtl"
              />
            </div>

            {/* Quality */}
            <select value={quality} onChange={e => setQuality(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50 transition-colors">
              <option value="">همه کیفیت‌ها</option>
              <option value="hot">🔥 داغ</option>
              <option value="high">⭐ عالی</option>
              <option value="warm">🌡 گرم</option>
              <option value="cold">❄️ سرد</option>
              <option value="invalid">✗ نامعتبر</option>
            </select>

            {/* Country */}
            <input type="text" placeholder="🌍 کشور"
              value={country} onChange={e => setCountry(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
            />

            {/* Property */}
            <input type="text" placeholder="🏠 نوع ملک"
              value={property} onChange={e => setProperty(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
            />

            {/* Source Sheet */}
            <input type="text" placeholder="📋 منبع"
              value={sourceSheet} onChange={e => setSourceSheet(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
            />

            {/* Date range */}
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/70 focus:outline-none focus:border-purple-500/50 transition-colors"
            />

            {/* Reset */}
            <button onClick={() => { setSearch(''); setQuality(''); setCountry(''); setProperty(''); setSourceSheet(''); setStartDate(''); setEndDate('') }}
              className="bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white/40 hover:text-white/70 transition-colors">
              پاک کردن
            </button>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────────── */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">لیست لیدها</h3>
              <p className="text-white/30 text-xs mt-0.5">{total.toLocaleString()} لید پیدا شد</p>
            </div>
            {data && data.totalPages > 1 && (
              <span className="text-xs text-white/30">
                صفحه {page} از {data.totalPages}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="flex flex-col items-center py-12 gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-red-400 text-sm">{error}</p>
              <button onClick={() => fetchLeads(page)} className="text-xs text-white/30 hover:text-white/60 transition-colors">
                تلاش مجدد
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && leads.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-3">
              <span className="text-3xl">📭</span>
              <p className="text-white/30 text-sm" dir="rtl">لیدی با این فیلترها پیدا نشد</p>
            </div>
          )}

          {/* Table */}
          {!loading && !error && leads.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['نام', 'تلفن', 'ایمیل', 'کشور', 'ملک', 'بودجه', 'کیفیت', 'امتیاز', 'اقدام بعدی', 'تاریخ'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-[10px] font-semibold text-white/30 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => {
                    const qStyle = qualityStyle(lead.lead_quality)
                    const isExp = expanded === lead.id
                    return (
                      <>
                        <tr key={lead.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.03] cursor-pointer transition-colors"
                          onClick={() => setExpanded(isExp ? null : lead.id)}>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-white font-medium">{lead.full_name || '—'}</p>
                            {lead.city && <p className="text-white/25 text-[10px]">{lead.city}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-white/60">{lead.phone || '—'}</span>
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <span className="text-white/60 truncate block">{lead.email || '—'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-white/60">{lead.country || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-white/60">{lead.property_interest || '—'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-white/50 max-w-[100px]">
                            <span className="truncate block">{lead.budget || '—'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${qStyle.bg} ${qStyle.text}`}>
                              {qStyle.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-base font-bold ${scoreColor(lead.lead_score)}`}>
                              {lead.lead_score ?? '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="text-white/50 text-[10px] leading-relaxed line-clamp-2" dir="ltr">
                              {lead.recommended_next_action || '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-white/30 text-[10px]">
                            {fmt(lead.inserted_at)}
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExp && (
                          <tr key={`${lead.id}-detail`} className="bg-white/[0.02] border-b border-white/[0.04]">
                            <td colSpan={10} className="px-6 py-5">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" dir="rtl">
                                {lead.short_summary && (
                                  <div className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-1.5">خلاصه هوش مصنوعی</p>
                                    <p className="text-white/65 text-xs leading-relaxed">{lead.short_summary}</p>
                                  </div>
                                )}
                                {lead.recommended_next_action && (
                                  <div className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl">
                                    <p className="text-[10px] text-green-400 font-bold uppercase tracking-wider mb-1.5">اقدام پیشنهادی</p>
                                    <p className="text-white/65 text-xs leading-relaxed" dir="ltr">{lead.recommended_next_action}</p>
                                  </div>
                                )}
                                <div className="p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-wider mb-2">اطلاعات تکمیلی</p>
                                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                                    {[
                                      ['نیت خرید', lead.buyer_intent],
                                      ['وضعیت', lead.status],
                                      ['زبان', lead.language],
                                      ['منبع کمپین', lead.campaign_source],
                                      ['UTM Source', lead.utm_source],
                                      ['UTM Campaign', lead.utm_campaign],
                                      ['موقعیت ترجیحی', lead.preferred_location],
                                    ].filter(([, v]) => v).map(([k, v]) => (
                                      <div key={k as string}>
                                        <span className="text-white/25">{k}: </span>
                                        <span className="text-white/60">{v}</span>
                                      </div>
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
          {!loading && data && data.totalPages > 1 && (
            <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
              <button
                onClick={() => { const p = page - 1; setPage(p); fetchLeads(p) }}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                ← قبلی
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(7, data.totalPages) }, (_, i) => {
                  const p = i + 1
                  return (
                    <button key={p} onClick={() => { setPage(p); fetchLeads(p) }}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        p === page
                          ? 'text-white'
                          : 'bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-white/60'
                      }`}
                      style={p === page ? { background: 'linear-gradient(135deg, #7C3AED, #A855F7)' } : {}}>
                      {p}
                    </button>
                  )
                })}
                {data.totalPages > 7 && <span className="text-white/20 text-xs">…{data.totalPages}</span>}
              </div>
              <button
                onClick={() => { const p = page + 1; setPage(p); fetchLeads(p) }}
                disabled={page >= data.totalPages}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.05] border border-white/[0.08] text-white/50 hover:text-white/80 hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                بعدی →
              </button>
            </div>
          )}
        </div>

      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.04] mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between text-xs text-white/20">
          <span>irfaninvest.com · Leads CRM</span>
          <a href="/dashboard" className="hover:text-white/40 transition-colors">Analytics Dashboard →</a>
        </div>
      </footer>
    </div>
  )
}
