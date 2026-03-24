#!/usr/bin/env node
/**
 * Load Sample Test Data into localStorage JSON files
 * 用法: node scripts/loadSampleData.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleDataPath = path.join(__dirname, '..', 'data-export', 'sample-data.json');
const exportDir = path.join(__dirname, '..', 'data-export');

async function loadSampleData() {
  console.log('📥 Loading sample test data...\n');

  try {
    // Read sample data
    if (!fs.existsSync(sampleDataPath)) {
      console.error(`❌ Sample data file not found: ${sampleDataPath}`);
      process.exit(1);
    }

    const sampleContent = fs.readFileSync(sampleDataPath, 'utf8');
    const sampleData = JSON.parse(sampleContent);

    // Write each table as separate JSON file (overwrite existing)
    const tables = Object.keys(sampleData);
    let totalRecords = 0;

    for (const table of tables) {
      const data = sampleData[table];
      if (Array.isArray(data)) {
        const filePath = path.join(exportDir, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        const count = data.length;
        console.log(`✅ ${table}: ${count} records`);
        totalRecords += count;
      }
    }

    console.log(`\n✨ Sample data loaded!`);
    console.log(`📊 Total: ${totalRecords} records across ${tables.length} tables`);
    console.log(`📁 Location: ${exportDir}\n`);
    console.log('💡 Tip: Refresh browser to load data into app (offline mode)\n');
  } catch (error) {
    console.error('❌ Error loading sample data:', error.message);
    process.exit(1);
  }
}

loadSampleData();
