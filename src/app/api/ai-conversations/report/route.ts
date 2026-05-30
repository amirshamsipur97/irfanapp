import { NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Lead reporting across the THREE separate datasets (no merging):
 *   1. Form Leads        (leads table, source = website_form)
 *   2. AI Conversations  (ai_conversations table — all)
 *   3. Qualified AI Leads(ai_conversations where qualified)
 * Returns the dashboard metrics: totals, AI conversion rate, quality
 * distribution, and project-interest distribution.
 */
export async function GET() {
  const [formCountRes, convRes] = await Promise.all([
    analyticsDb
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .or('source.eq.website_form,source_sheet.eq.website_form'),
    analyticsDb
      .from('ai_conversations')
      .select('lead_status, project_interest, qualified, lead_score'),
  ])

  if (convRes.error) {
    return NextResponse.json({ error: convRes.error.message }, { status: 500 })
  }

  const conversations = convRes.data ?? []
  const totalConversations = conversations.length
  const qualifiedLeads = conversations.filter(c => c.qualified === true).length
  const totalFormLeads = formCountRes.count ?? 0

  const tally = (key: 'lead_status' | 'project_interest', onlyQualified = false) => {
    const acc: Record<string, number> = {}
    for (const c of conversations) {
      if (onlyQualified && c.qualified !== true) continue
      const k = String(c[key] ?? '').trim() || '(unknown)'
      acc[k] = (acc[k] || 0) + 1
    }
    return Object.entries(acc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    total_form_leads: totalFormLeads,
    total_ai_conversations: totalConversations,
    qualified_ai_leads: qualifiedLeads,
    ai_conversion_rate: totalConversations > 0
      ? Number((qualifiedLeads / totalConversations).toFixed(4))
      : 0,
    lead_quality_distribution: tally('lead_status'),
    project_interest_distribution: tally('project_interest', true),
  })
}
