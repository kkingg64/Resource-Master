// lib/dataImporter.ts
/**
 * Data Importer - Load exported JSON data into localStorage
 * Used for offline development testing
 */

export interface DataImportConfig {
  projects?: any[];
  project_members?: any[];
  modules?: any[];
  tasks?: any[];
  task_assignments?: any[];
  resources?: any[];
  individual_holidays?: any[];
  holidays?: any[];
  resource_allocations?: any[];
  versions?: any[];
}

class DataImporter {
  private baseKey = 'oms_data_';

  /**
   * Import all data from JSON config into localStorage
   */
  async importData(config: DataImportConfig): Promise<{ success: boolean; message: string }> {
    try {
      const tables = Object.keys(config) as (keyof DataImportConfig)[];
      let totalRecords = 0;

      for (const table of tables) {
        const data = config[table];
        if (Array.isArray(data)) {
          const key = `${this.baseKey}${table}`;
          localStorage.setItem(key, JSON.stringify(data));
          totalRecords += data.length;
          console.log(`✅ Imported ${table}: ${data.length} records`);
        }
      }

      console.log(`✨ Import完成！總共 ${totalRecords} 筆records`);
      return {
        success: true,
        message: `✅ Successfully imported ${totalRecords} records from ${tables.length} tables`
      };
    } catch (error: any) {
      const message = `❌ Import失敗: ${error.message}`;
      console.error(message);
      return {
        success: false,
        message
      };
    }
  }

  /**
   * Get imported data by table name
   */
  getData<T = any>(tableName: string): T[] {
    try {
      const key = `${this.baseKey}${tableName}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get all imported data
   */
  getAllData(): DataImportConfig {
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

    const result: DataImportConfig = {};
    for (const table of tables) {
      result[table as keyof DataImportConfig] = this.getData(table);
    }
    return result;
  }

  /**
   * Clear all imported data
   */
  clearData(): void {
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

    for (const table of tables) {
      const key = `${this.baseKey}${table}`;
      localStorage.removeItem(key);
    }
    console.log('✅ All imported data cleared');
  }

  /**
   * Check if data is already imported
   */
  hasData(): boolean {
    return this.getData('projects').length > 0;
  }
}

export const dataImporter = new DataImporter();

// Make available globally for console access
(window as any).__dataImporter = dataImporter;
