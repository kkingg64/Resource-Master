
import { createClient } from '@supabase/supabase-js'

// Safe access to environment variables using optional chaining
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL and Anon Key are missing or undefined. Authentication capabilities will be limited.");
}

// Provide fallback to prevent crash during initialization if keys are missing
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder') as any
