
import { createClient } from '@supabase/supabase-js'
import { Database } from './types/database.types' // This will be generated later

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in .env file");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
