import { createClient } from '@supabase/supabase-js';
import { Project, Holiday } from '../types';

// These environment variables are configured in Vercel and prefixed with VITE_
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
const PLAN_ID = import.meta.env.VITE_PLAN_ID!;

if (!supabaseUrl || !supabaseAnonKey || !PLAN_ID) {
  console.error("Supabase environment variables are not set. Please check your Vercel configuration and ensure they are prefixed with VITE_.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface PlannerData {
  projects: Project[] | null;
  holidays: Holiday[] | null;
}

export async function getPlannerData(): Promise<PlannerData> {
  try {
    const { data: planData, error: planError } = await supabase
      .from('plans')
      .select('projects_data')
      .eq('id', PLAN_ID)
      .single();

    if (planError && planError.code !== 'PGRST116') { // PGRST116: 'exact-one-row-not-found' is okay
      throw planError;
    }

    const { data: holidayData, error: holidayError } = await supabase
      .from('holidays')
      .select('holidays_data')
      .eq('id', PLAN_ID)
      .single();
    
    if (holidayError && holidayError.code !== 'PGRST116') {
       throw holidayError;
    }

    return {
      projects: planData?.projects_data || null,
      holidays: holidayData?.holidays_data || null,
    };
  } catch (error) {
    console.error('Error fetching planner data from Supabase:', error);
    return { projects: null, holidays: null };
  }
}

export async function savePlannerData(projects: Project[], holidays: Holiday[]): Promise<void> {
  try {
    const planUpsertPromise = supabase
      .from('plans')
      .upsert({ id: PLAN_ID, projects_data: projects, updated_at: new Date().toISOString() });

    const holidayUpsertPromise = supabase
      .from('holidays')
      .upsert({ id: PLAN_ID, holidays_data: holidays, updated_at: new Date().toISOString() });

    const [planResult, holidayResult] = await Promise.all([planUpsertPromise, holidayUpsertPromise]);

    if (planResult.error) throw planResult.error;
    if (holidayResult.error) throw holidayResult.error;

  } catch (error) {
    console.error('Error saving planner data to Supabase:', error);
    throw error; // Re-throw to be caught by the caller
  }
}