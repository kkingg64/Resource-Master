
import { createClient } from '@supabase/supabase-js'

// Safe access to env variables to prevent "Cannot read properties of undefined"
const getEnvVar = (key: string) => {
  try {
    // @ts-ignore
    return import.meta.env?.[key];
  } catch (e) {
    return undefined;
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL and Anon Key are missing. Authentication and Database features will not work.");
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder') as any;
