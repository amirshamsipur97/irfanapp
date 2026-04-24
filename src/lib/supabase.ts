import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

// Main client for real estate data (public schema)
export const supabase = createClient(supabaseUrl, supabaseKey)

// Analytics client — isolated in 'analytics' schema, no overlap with property data
export const analyticsDb = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'analytics' },
})

export interface GA4Row {
  date: string
  country: string
  city: string
  page_location: string
  active_28_day_users: number
  checkouts: number
  page_views: number
}
