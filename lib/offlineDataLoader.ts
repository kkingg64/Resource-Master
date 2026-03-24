// lib/offlineDataLoader.ts
/**
 * Offline Data Loader - Load sample data from JSON files into app
 * Available in browser console when in offline mode
 */

export async function loadSampleDataFromJSON() {
  console.log('📥 Loading sample test data from data-export/...');

  try {
    const tables = [
      'projects',
      'project_members',
      'modules',
      'tasks',
      'task_assignments',
      'resources',
      'individual_holidays',
      'holidays',
      'resource_allocations',
      'versions'
    ];

    // Fetch all JSON files
    const data: Record<string, any[]> = {};
    let totalRecords = 0;

    for (const table of tables) {
      try {
        const response = await fetch(`/data-export/${table}.json`);
        if (response.ok) {
          const records = await response.json();
          data[table] = records;
          totalRecords += records.length;
          console.log(`  ✅ ${table}: ${records.length} records`);
        } else {
          console.warn(`  ⚠️ ${table}: not found`);
        }
      } catch (err) {
        console.warn(`  ⚠️ ${table}: error loading`);
      }
    }

    // Save to localStorage with our prefix
    for (const [table, records] of Object.entries(data)) {
      localStorage.setItem(`oms_data_${table}`, JSON.stringify(records));
    }

    console.log(`\n✨ Successfully loaded ${totalRecords} records!`);
    console.log('💾 Data saved to localStorage');
    console.log('🔄 Refresh browser to see data in app\n');

    return {
      success: true,
      totalRecords,
      tables: Object.keys(data)
    };
  } catch (error: any) {
    console.error('❌ Error loading sample data:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// Make available globally in offline mode
if (typeof window !== 'undefined') {
  (window as any).__loadSampleData = loadSampleDataFromJSON;
  console.log('%c💡 Tip: Run window.__loadSampleData() to load test data', 'color: #667eea; font-weight: bold');
}
