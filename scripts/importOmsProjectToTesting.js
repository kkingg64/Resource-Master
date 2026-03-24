#!/usr/bin/env node
/**
 * Import OMS project data from data-export JSON files into current Supabase DB.
 * Usage: node scripts/importOmsProjectToTesting.js [email] [password]
 * Example: node scripts/importOmsProjectToTesting.js kingg64@hotmail.com 1234@abcD#
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');
const exportDir = path.join(rootDir, 'data-export');
const targetEmail = process.argv[2] || 'kingg64@hotmail.com';
const targetPassword = process.argv[3] || '';

function readEnvFile(filePath) {
  const envContent = fs.readFileSync(filePath, 'utf8');
  const getEnvVar = (name) => {
    const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
    return match ? match[1].trim() : '';
  };
  return {
    supabaseUrl: getEnvVar('VITE_SUPABASE_URL'),
    supabaseAnonKey: getEnvVar('VITE_SUPABASE_ANON_KEY')
  };
}

function readJson(table) {
  const p = path.join(exportDir, `${table}.json`);
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function upsertTable(supabase, table, rows, conflict = 'id') {
  if (!rows.length) {
    console.log(`- ${table}: 0 rows (skip)`);
    return { ok: true, count: 0 };
  }

  const chunkSize = 500;
  let imported = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(table)
      .upsert(chunk, { onConflict: conflict, ignoreDuplicates: false });

    if (error) {
      const needsIdFallback =
        error.message.includes('invalid input syntax for type uuid') &&
        chunk.some((row) => Object.prototype.hasOwnProperty.call(row, 'id'));

      if (needsIdFallback) {
        const insertChunk = chunk.map(({ id, ...rest }) => rest);
        const insertResult = await supabase.from(table).insert(insertChunk);
        if (insertResult.error) {
          return { ok: false, count: imported, error: insertResult.error };
        }
        imported += chunk.length;
        continue;
      }

      return { ok: false, count: imported, error };
    }

    imported += chunk.length;
  }

  console.log(`- ${table}: ${imported} rows`);
  return { ok: true, count: imported };
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return !error;
}

async function getSupportedColumns(supabase, table, candidateColumns) {
  const supported = [];
  for (const col of candidateColumns) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (!error) supported.push(col);
  }
  return supported;
}

async function sanitizeRowsForTable(supabase, table, rows) {
  if (!rows.length) return rows;
  const candidates = Object.keys(rows[0]);
  const supportedColumns = await getSupportedColumns(supabase, table, candidates);
  if (!supportedColumns.length) return [];

  return rows.map((row) => {
    const next = {};
    for (const col of supportedColumns) {
      if (Object.prototype.hasOwnProperty.call(row, col)) {
        next[col] = row[col];
      }
    }
    return next;
  });
}

function rewriteUserId(rows, targetUserId) {
  if (!targetUserId) return rows;
  return rows.map((row) => (
    Object.prototype.hasOwnProperty.call(row, 'user_id')
      ? { ...row, user_id: targetUserId }
      : row
  ));
}

async function detectProjectMembersShape(supabase) {
  const withEmail = await supabase.from('project_members').select('id,project_id,user_email,role').limit(1);
  if (!withEmail.error) return 'user_email';

  const withUserId = await supabase.from('project_members').select('id,project_id,user_id,role').limit(1);
  if (!withUserId.error) return 'user_id';

  return 'unknown';
}

async function main() {
  if (!fs.existsSync(envPath)) {
    console.error(`Missing env file: ${envPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(exportDir)) {
    console.error(`Missing export directory: ${exportDir}`);
    process.exit(1);
  }

  const { supabaseUrl, supabaseAnonKey } = readEnvFile(envPath);
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const projects = readJson('projects');
  const projectMembers = readJson('project_members');
  const modules = readJson('modules');
  const tasks = readJson('tasks');
  const assignments = readJson('task_assignments');
  const allocations = readJson('resource_allocations');
  const resources = readJson('resources');
  const individualHolidays = readJson('individual_holidays');
  const holidays = readJson('holidays');
  const versions = readJson('versions');

  const omsProject = projects.find((p) => p.name === 'OMS');
  if (!omsProject) {
    console.error('Cannot find project named "OMS" in data-export/projects.json');
    process.exit(1);
  }

  let targetUserId = '';
  if (targetPassword) {
    const signIn = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: targetPassword
    });

    if (signIn.error) {
      console.warn(`Auth warning: ${signIn.error.message}`);
    } else {
      targetUserId = signIn.data.user?.id || '';
    }
  }

  const omsModules = modules.filter((m) => m.project_id === omsProject.id);
  const moduleIds = new Set(omsModules.map((m) => m.id));

  const omsTasks = tasks.filter((t) => moduleIds.has(t.module_id));
  const taskIds = new Set(omsTasks.map((t) => t.id));

  const omsAssignments = assignments.filter((a) => taskIds.has(a.task_id));
  const assignmentIds = new Set(omsAssignments.map((a) => a.id));

  const omsAllocations = allocations.filter((a) => assignmentIds.has(a.assignment_id));
  const memberShape = await detectProjectMembersShape(supabase);
  let omsMembers = projectMembers.filter((m) => m.project_id === omsProject.id);

  if (memberShape === 'user_email') {
    omsMembers = omsMembers.map((m) => ({
      id: m.id,
      project_id: m.project_id,
      user_email: m.user_email,
      role: m.role,
      created_at: m.created_at
    }));

    const hasTargetMember = omsMembers.some(
      (m) => String(m.user_email || '').toLowerCase() === targetEmail.toLowerCase()
    );

    if (!hasTargetMember) {
      omsMembers.push({
        id: randomUUID(),
        project_id: omsProject.id,
        user_email: targetEmail,
        role: 'editor'
      });
    }
  } else if (memberShape === 'user_id') {
    omsMembers = omsMembers.map((m) => ({
      id: m.id,
      project_id: m.project_id,
      user_id: targetUserId || m.user_id || null,
      role: m.role,
      created_at: m.created_at
    }));

    if (targetUserId) {
      const hasTargetMember = omsMembers.some((m) => String(m.user_id || '') === targetUserId);
      if (!hasTargetMember) {
        omsMembers.push({
          id: randomUUID(),
          project_id: omsProject.id,
          user_id: targetUserId,
          role: 'editor'
        });
      }
    }
  } else {
    omsMembers = [];
  }

  const importProject = rewriteUserId([omsProject], targetUserId);
  const importModules = rewriteUserId(omsModules, targetUserId);
  const importTasks = rewriteUserId(omsTasks, targetUserId);
  const importAssignments = rewriteUserId(omsAssignments, targetUserId);
  const importAllocations = rewriteUserId(omsAllocations, targetUserId);
  const importResources = rewriteUserId(resources, targetUserId);
  const importIndividualHolidays = rewriteUserId(individualHolidays, targetUserId);
  const importHolidays = rewriteUserId(holidays, targetUserId);
  const importVersions = rewriteUserId(versions, targetUserId);

  console.log('Import target project: OMS');
  console.log(`Target member email: ${targetEmail}`);
  console.log(`Target user id: ${targetUserId || 'not resolved (kept original user_id)'}`);
  console.log(`project_members schema: ${memberShape}`);
  console.log(`Rows prepared: projects=${1}, modules=${importModules.length}, tasks=${importTasks.length}, assignments=${importAssignments.length}, allocations=${importAllocations.length}`);

  // Keep import order to satisfy foreign keys.
  const importPlan = [
    { table: 'projects', rows: importProject, conflict: 'id' },
    { table: 'project_members', rows: omsMembers, conflict: 'id' },
    { table: 'modules', rows: importModules, conflict: 'id' },
    { table: 'tasks', rows: importTasks, conflict: 'id' },
    { table: 'task_assignments', rows: importAssignments, conflict: 'id' },
    { table: 'resources', rows: importResources, conflict: 'id' },
    { table: 'individual_holidays', rows: importIndividualHolidays, conflict: 'id' },
    { table: 'holidays', rows: importHolidays, conflict: 'id' },
    { table: 'resource_allocations', rows: importAllocations, conflict: 'id' },
    { table: 'versions', rows: importVersions, conflict: 'id' }
  ];

  let total = 0;

  for (const step of importPlan) {
    const exists = await tableExists(supabase, step.table);
    if (!exists) {
      console.log(`- ${step.table}: table not found in testing DB (skip)`);
      continue;
    }

    const safeRows = await sanitizeRowsForTable(supabase, step.table, step.rows);
    if (step.rows.length > 0 && safeRows.length === 0) {
      console.log(`- ${step.table}: no compatible columns found (skip)`);
      continue;
    }

    const result = await upsertTable(supabase, step.table, safeRows, step.conflict);
    if (!result.ok) {
      console.error(`Import failed at table ${step.table}: ${result.error.message}`);
      process.exit(1);
    }

    total += result.count;
  }

  const { data: verifyProjects, error: verifyError } = await supabase
    .from('projects')
    .select('id,name')
    .eq('name', 'OMS')
    .limit(5);

  if (verifyError) {
    console.warn(`Verification warning: ${verifyError.message}`);
  } else {
    console.log(`Verification projects found: ${verifyProjects?.length || 0}`);
  }

  console.log(`Import complete. Total rows upserted: ${total}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
