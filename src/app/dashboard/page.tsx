'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
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

interface GA4Store {
  lastUpdated: string
  rows: GA4Row[]
}

interface Analysis {
  summary: string
  topInsights: string[]
  seoRecommendations: string[]
  geographicOpportunities: string
  contentGaps: string[]
  priorityActions: string[]
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const [store, setStore] = useState<GA4Store | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loadingAnalysis, setLoadingAnalysis] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')

  const loadData = () => {
    fetch('/api/data')
      .then(r => r.json())
      .then((d: GA4Store) => setStore(d))
  }

  useEffect(() => {
    loadData()
    // Auto-refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function runAnalysis() {
    setLoadingAnalysis(true)
    const res = await fetch('/api/analyze')
    const data = await res.json()
    setAnalysis(data.analysis)
    setLastUpdated(data.lastUpdated)
    setLoadingAnalysis(false)
  }

  if (!store) return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
      Loading...
    </div>
  )

  const hasData = store.rows.length > 0

  // Aggregate by date
  const byDate = Object.entries(
    store.rows.reduce((acc: Record<string, { pageViews: number; users: number }>, r) => {
      if (!acc[r.date]) acc[r.date] = { pageViews: 0, users: 0 }
      acc[r.date].pageViews += (r.screen_page_views || r.page_views || 0)
      acc[r.date].users += (r.active_1_day_users || r.active_28_day_users || 0)
      return acc
    }, {})
  )
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date: date.slice(5), ...v }))

  // Top pages
  const topPages = Object.entries(
    store.rows.reduce((acc: Record<string, number>, r) => {
      const short = (r.page_location || '').replace('https://irfaninvest.com', '') || '/'
      acc[short] = (acc[short] || 0) + (r.screen_page_views || r.page_views || 0)
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([page, views]) => ({ page: page.length > 30 ? page.slice(0, 30) + '…' : page, views }))

  // Countries
  const countries = Object.entries(
    store.rows.reduce((acc: Record<string, number>, r) => {
      acc[r.country] = (acc[r.country] || 0) + r.active_28_day_users
      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))

  const totalViews = store.rows.reduce((s, r) => s + (r.screen_page_views || r.page_views || 0), 0)
  const totalUsers = store.rows.reduce((s, r) => s + r.active_28_day_users, 0)
  const totalActiveToday = store.rows.reduce((s, r) => s + (r.active_1_day_users || 0), 0)
  const totalEvents = store.rows.reduce((s, r) => s + (r.event_count || 0), 0)
  const totalLeads = store.rows.reduce((s, r) => s + (r.generate_lead_events || 0), 0)
  const totalCheckouts = store.rows.reduce((s, r) => s + r.checkouts, 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">irfaninvest.com</h1>
          <p className="text-gray-400 text-sm mt-1">Google Analytics 4 — Real Estate Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          {store.lastUpdated && (
            <span className="text-gray-500 text-xs">
              Updated: {new Date(store.lastUpdated).toLocaleString()}
            </span>
          )}
          <button
            onClick={runAnalysis}
            disabled={loadingAnalysis || !hasData}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loadingAnalysis ? 'Analyzing…' : 'Analyze with Claude AI'}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-300 mb-2">No Data Yet</h2>
          <p className="text-gray-500 max-w-md">
            Run your n8n workflow to send GA4 data to this dashboard.
            The data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Page Views</p>
              <p className="text-3xl font-bold text-white">{totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Active Today</p>
              <p className="text-3xl font-bold text-green-400">{totalActiveToday.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Active Users (28d)</p>
              <p className="text-3xl font-bold text-emerald-400">{totalUsers.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Events</p>
              <p className="text-3xl font-bold text-blue-400">{totalEvents.toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Leads</p>
              <p className="text-3xl font-bold text-yellow-400">{totalLeads.toLocaleString()}</p>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Page Views Over Time */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Page Views Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={byDate}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="pageViews" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Traffic by Country */}
            <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300 mb-4">Traffic by Country</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={countries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name ?? ''} ${(((percent as number) ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                    {countries.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Pages */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Top Pages</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topPages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis dataKey="page" type="category" width={180} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Claude AI Analysis */}
      {analysis && (
        <div className="bg-gray-900 rounded-xl p-6 border border-emerald-800 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">AI</div>
            <h3 className="text-sm font-semibold text-emerald-400">Claude AI — SEO Analysis</h3>
            {lastUpdated && <span className="text-gray-500 text-xs ml-auto">{new Date(lastUpdated).toLocaleString()}</span>}
          </div>

          <p className="text-gray-300 text-sm mb-4">{analysis.summary}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Insights</h4>
              <ul className="space-y-1">
                {analysis.topInsights?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SEO Recommendations</h4>
              <ul className="space-y-1">
                {analysis.seoRecommendations?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-blue-400 mt-0.5">→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Priority Actions</h4>
              <ul className="space-y-1">
                {analysis.priorityActions?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-yellow-400 mt-0.5">{i + 1}.</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Content Gaps</h4>
              <ul className="space-y-1">
                {analysis.contentGaps?.map((item, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-red-400 mt-0.5">!</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {analysis.geographicOpportunities && (
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Geographic Opportunities</h4>
              <p className="text-sm text-gray-300">{analysis.geographicOpportunities}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
