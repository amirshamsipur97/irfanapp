import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_ANON_KEY!

// Main client — analytics table uses prefix 'analytics_' to stay separate from property tables
export const supabase = createClient(supabaseUrl, supabaseKey)
export const analyticsDb = supabase

export interface GA4Row {
  date: string
  country: string
  city: string
  page_location: string
  active_28_day_users: number
  checkouts: number
  page_views: number
}
