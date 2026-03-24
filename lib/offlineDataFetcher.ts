// lib/offlineDataFetcher.ts
/**
 * Offline Data Fetcher - Load data from localStorage instead of Supabase
 * Used when VITE_USE_LOCAL_DATA=true
 */

export function getOfflineData(tableName: string): any[] {
  try {
    const key = `oms_data_${tableName}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn(`⚠️ Error loading ${tableName} from localStorage:`, error);
    return [];
  }
}

export async function fetchDataOffline(userId: string, userEmail: string) {
  console.log('📥 Loading data from localStorage (offline mode)...\n');

  try {
    // Load all tables from localStorage
    const projects = getOfflineData('projects');
    const projectMembers = getOfflineData('project_members');
    const modules = getOfflineData('modules');
    const tasks = getOfflineData('tasks');
    const assignments = getOfflineData('task_assignments');
    const resources = getOfflineData('resources');
    const individualHolidays = getOfflineData('individual_holidays');
    const holidays = getOfflineData('holidays');
    const allocations = getOfflineData('resource_allocations');

    // Filter projects (mock user owns all for offline testing)
    // Remove any 'My First Project' entries
    const userProjects = projects.filter((p: any) => p.name !== 'My First Project');
    let userAssignments: any[] = [];
    let userAllocations: any[] = [];
    let userModules: any[] = [];
    let userTasks: any[] = [];

    // For offline testing, all projects are visible
    if (userProjects.length === 0) {
      console.warn('⚠️ No projects found in localStorage');
      console.log('💡 Tip: Run window.__loadRealData() to load data');
    } else {
      console.log(`✅ Loaded ${userProjects.length} projects`);
      
      // Filter related data using Set lookups for startup performance.
      const projectIdSet = new Set(userProjects.map((p: any) => p.id));
      userModules = modules.filter((m: any) => projectIdSet.has(m.project_id));

      const moduleIdSet = new Set(userModules.map((m: any) => m.id));
      userTasks = tasks.filter((t: any) => moduleIdSet.has(t.module_id));

      const taskIdSet = new Set(userTasks.map((t: any) => t.id));
      userAssignments = assignments.filter((a: any) => taskIdSet.has(a.task_id));

      const assignmentIdSet = new Set(userAssignments.map((a: any) => a.id));
      userAllocations = allocations.filter((alloc: any) => assignmentIdSet.has(alloc.assignment_id));

      console.log(`✅ Loaded ${modules.length} modules`);
      console.log(`✅ Loaded ${tasks.length} tasks`);
      console.log(`✅ Loaded ${assignments.length} assignments`);
      console.log(`✅ Loaded ${resources.length} resources`);
      console.log(`✅ Loaded ${holidays.length} holidays\n`);
    }

    return {
      projects: userProjects,
      projectMembers,
      modules: userModules,
      tasks: userTasks,
      assignments: userAssignments,
      resources,
      individualHolidays,
      holidays,
      allocations: userAllocations,
      memberships: projectMembers.filter(m => m.user_email === userEmail)
    };
  } catch (error: any) {
    console.error('❌ Error loading offline data:', error);
    throw error;
  }
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).__getOfflineData = getOfflineData;
  (window as any).__fetchDataOffline = fetchDataOffline;
}
