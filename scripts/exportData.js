#!/usr/bin/env node
/**
 * Export script (JavaScript/ES module version) - 從Supabase export所有data到local JSON files
 * 用法: node scripts/exportData.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || '';
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase環境變數未設置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

const exportDir = path.join(process.cwd(), 'data-export');

async function exportData() {
  console.log('📦 開始export Supabase data...\n');

  // 建立export目錄
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
    console.log(`✅ 已建立目錄: ${exportDir}\n`);
  }

  let totalRecords = 0;

  for (const table of tables) {
    try {
      process.stdout.write(`⏳ 正在export ${table}...`);
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.error(`\n❌ ${table} 錯誤:`, error.message);
        continue;
      }

      const fileName = path.join(exportDir, `${table}.json`);
      fs.writeFileSync(fileName, JSON.stringify(data, null, 2));

      const count = data?.length || 0;
      console.log(` ✅ ${count} 筆records`);
      totalRecords += count;
    } catch (err) {
      console.error(`\n❌ ${table} 失敗:`, err.message);
    }
  }

  console.log(`\n✨ Export完成！`);
  console.log(`📊 總共export咗 ${totalRecords} 筆records`);
  console.log(`📁 位置: ${exportDir}\n`);
  console.log('💡 提示: 所有data已保存為JSON files，可以commit到git作為backup\n');
}

exportData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
