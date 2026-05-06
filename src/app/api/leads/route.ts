import { NextRequest, NextResponse } from 'next/server'
import { analyticsDb } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const quality    = searchParams.get('quality')    // cold | warm | hot | high | invalid
    const country    = searchParams.get('country')
    const sourceSheet = searchParams.get('source_sheet')
    const property   = searchParams.get('property')
    const search     = searchParams.get('search')     // name | email | phone
    const startDate  = searchParams.get('start_date')
    const endDate    = searchParams.get('end_date')
    const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit      = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
    const offset     = (page - 1) * limit

    let query = analyticsDb
      .from('leads')
      .select('*', { count: 'exact' })
      // Show leads with contact info first, then by score, then by date
      .order('email', { ascending: true, nullsFirst: false })
      .order('lead_score', { ascending: false, nullsFirst: false })
      .order('inserted_at', { ascending: false })

    if (quality)     query = query.ilike('lead_quality', quality)
    if (country)     query = query.ilike('country', `%${country}%`)
    if (sourceSheet) query = query.ilike('source_sheet', `%${sourceSheet}%`)
    if (property)    query = query.ilike('property_interest', `%${property}%`)
    if (startDate)   query = query.gte('inserted_at', startDate)
    if (endDate)     query = query.lte('inserted_at', endDate + 'T23:59:59Z')
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      console.error('[GET /api/leads] Supabase error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      leads:      data ?? [],
      total:      count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    })
  } catch (err) {
    console.error('[GET /api/leads] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
