// lib/loadRealData.ts
/**
 * Load Real Data - Load exported live data into localStorage for offline testing
 * Usage in browser console: await window.__loadRealData()
 */

export async function loadRealDataFromExport() {
  console.log('📥 Loading real exported data from data-export/...\n');

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

    let totalRecords = 0;
    const failedTables: string[] = [];

    // Fetch all JSON files
    for (const table of tables) {
      try {
        console.log(`  ⏳ Loading ${table}...`);
        const response = await fetch(`/data-export/${table}.json`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const records = await response.json();
        
        // Save to localStorage with our prefix
        localStorage.setItem(`oms_data_${table}`, JSON.stringify(records));
        
        const count = Array.isArray(records) ? records.length : 0;
        totalRecords += count;
        console.log(`    ✅ ${count} records`);
      } catch (error: any) {
        console.warn(`    ⚠️ Error: ${error.message}`);
        failedTables.push(table);
      }
    }

    console.log(`\n✨ Loading complete!`);
    console.log(`📊 Total: ${totalRecords} records loaded`);
    console.log(`💾 Data saved to localStorage\n`);

    if (failedTables.length > 0) {
      console.warn(`⚠️ Failed to load: ${failedTables.join(', ')}`);
    }

    console.log('🔄 Refresh browser to see data in app\n');

    return {
      success: failedTables.length === 0,
      totalRecords,
      failedTables
    };
  } catch (error: any) {
    console.error('❌ Fatal error loading data:', error.message);
    return {
      success: false,
      error: error.message,
      totalRecords: 0
    };
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).__loadRealData = loadRealDataFromExport;
}
