// lib/supabaseClient.ts (UPDATED)
/**
 * Supabase Client with Offline Mode Support
 * Set VITE_USE_LOCAL_DATA=true in .env.local to disable live database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
const useLocalData = (import.meta as any).env?.VITE_USE_LOCAL_DATA === 'true'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing or undefined.")
}

if (useLocalData) {
  console.log("🔌 OFFLINE MODE ENABLED - Using local data store instead of live database")
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
) as any

export const isOfflineMode = useLocalData
