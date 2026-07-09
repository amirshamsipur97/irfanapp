import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// Server-only app: prefer the service-role key so RLS can stay ON for anon.
// Falls back to the anon key until SUPABASE_SERVICE_ROLE_KEY is configured.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!

// Main client — analytics table uses prefix 'analytics_' to stay separate from property tables
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
})
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

export interface AdsRow {
  id?: number
  date: string
  campaign_id: string
  campaign_name: string
  campaign_status: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  ctr: number
  average_cpc: number
  average_cpm: number
  interaction_rate: number
  video_views: number
  advertising_channel_type: string
  synced_at?: string
}
