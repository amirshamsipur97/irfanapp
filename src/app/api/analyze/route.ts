import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET() {
  const { data: rows, error } = await supabase
    .from('ga4_analytics')
    .select('*')
    .order('date', { ascending: false })
    .limit(500)

  if (error || !rows?.length) {
    return NextResponse.json({ error: 'No data available. Run n8n workflow first.' }, { status: 404 })
  }

  const totalPageViews = rows.reduce((s, r) => s + (r.page_views ?? 0), 0)
  const totalUsers = rows.reduce((s, r) => s + (r.active_28_day_users ?? 0), 0)

  const topPages = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.page_location] = (acc[r.page_location] || 0) + r.page_views
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const topCountries = Object.entries(
    rows.reduce((acc: Record<string, number>, r) => {
      acc[r.country] = (acc[r.country] || 0) + r.active_28_day_users
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const prompt = `You are an SEO and real estate website analyst. Analyze this Google Analytics data for irfaninvest.com (a real estate investment website) and provide actionable SEO insights.

Data Summary (Last 7 days):
- Total Page Views: ${totalPageViews}
- Total Active 28-Day Users: ${totalUsers}

Top Pages by Views:
${topPages.map(([page, views]) => `  ${page}: ${views} views`).join('\n')}

Top Countries by Users:
${topCountries.map(([country, users]) => `  ${country}: ${users} users`).join('\n')}

Provide your analysis in JSON format:
{
  "summary": "brief 2-sentence overview",
  "topInsights": ["insight 1", "insight 2", "insight 3"],
  "seoRecommendations": ["rec 1", "rec 2", "rec 3", "rec 4"],
  "geographicOpportunities": "analysis of geographic data",
  "contentGaps": ["gap 1", "gap 2"],
  "priorityActions": ["action 1", "action 2", "action 3"]
}`

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text }

  return NextResponse.json({
    analysis,
    dataSnapshot: { totalPageViews, totalUsers, topPages, topCountries },
    lastUpdated: rows[0]?.synced_at,
  })
}
