import React, { useState, useEffect, useRef, useMemo } from 'react';
// FIX: Corrected import paths to be relative to the `src` directory.
import { GOV_HOLIDAYS_DB, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getWeekIdFromDate, getDateFromWeek, formatDateForInput, calculateEndDate, findNextWorkingDay } from '../constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource, ComplexityLevel, ModuleType, ProjectRole, ProjectMember } from '../types';
import { Dashboard } from '../components/Dashboard';
import { PlannerGrid } from '../components/PlannerGrid';
import { Estimator } from '../components/Estimator';
import { Settings } from '../components/Settings';
import { Resources } from '../components/Resources';
import { VersionHistory } from '../components/VersionHistory';
import { DebugLog } from '../components/DebugLog';
import { AdminSettings } from '../components/AdminSettings';
import { AIAssistant } from '../components/AIAssistant';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, Users, Globe, Share2, Copy, Check, X, Mail, Plus, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// Helper to structure data from Supabase
const structureProjectsData = (
  projects: any[],
  modules: any[],
  tasks: any[],
  assignments: any[],
  allocations: any[],
  currentUserId: string,
  members: any[] = []
): Project[] => {
  const allocationsByAssignment = new Map<string, any[]>();
  allocations.forEach(a => {
    if (!allocationsByAssignment.has(a.assignment_id)) {
      allocationsByAssignment.set(a.assignment_id, []);
    }
    allocationsByAssignment.get(a.assignment_id)!.push({
      weekId: a.week_id,
      count: a.count,
      days: a.days || {},
    });
  });

  const assignmentsByTask = new Map<string, any[]>();
  assignments.forEach(a => {
    if (!assignmentsByTask.has(a.task_id)) {
      assignmentsByTask.set(a.task_id, []);
    }
    assignmentsByTask.get(a.task_id)!.push({
      id: a.id,
      role: a.role,
      resourceName: a.resource_name,
      startDate: a.start_date, // New day-based field
      startWeekId: a.start_week_id, // Keep for backward compatibility
      duration: a.duration,
      progress: a.progress || 0, // NEW: Progress field
      parentAssignmentId: a.parent_assignment_id,
      sort_order: a.sort_order,
      allocations: allocationsByAssignment.get(a.id) || [],
    });
  });

  const tasksByModule = new Map<string, any[]>();
  tasks.forEach(t => {
    if (!tasksByModule.has(t.module_id)) {
      tasksByModule.set(t.module_id, []);
    }
    tasksByModule.get(t.module_id)!.push({
      id: t.id,
      name: t.name,
      startDate: t.start_date,
      sort_order: t.sort_order,
      frontendFunctionPoints: t.frontend_function_points || 0,
      backendFunctionPoints: t.backend_function_points || 0,
      frontendVelocity: t.frontend_velocity,
      frontendTeamSize: t.frontend_team_size,
      frontendComplexity: t.frontend_complexity,
      backendVelocity: t.backend_velocity,
      backendTeamSize: t.backend_team_size,
      backendComplexity: t.backend_complexity,
      assignments: (assignmentsByTask.get(t.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    });
  });

  const modulesByProject = new Map<string, any[]>();
  modules.forEach(m => {
    if (!modulesByProject.has(m.project_id)) {
      modulesByProject.set(m.project_id, []);
    }
    const moduleTasks = (tasksByModule.get(m.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    modulesByProject.get(m.project_id)!.push({
      id: m.id,
      name: m.name,
      type: m.type || ModuleType.Development,
      legacyFunctionPoints: m.legacy_function_points,
      functionPoints: m.function_points,
      complexity: m.complexity || 'Medium', // Default to Medium if undefined
      
      // Default FE/BE FP to the main function_points if they are not explicitly set (null)
      frontendFunctionPoints: m.frontend_function_points ?? m.function_points ?? 0,
      backendFunctionPoints: m.backend_function_points ?? m.function_points ?? 0,
      
      frontendComplexity: m.frontend_complexity || m.complexity || 'Medium',
      backendComplexity: m.backend_complexity || m.complexity || 'Medium',

      // New Prep fields
      prepVelocity: m.prep_velocity || 10,
      prepTeamSize: m.prep_team_size || 2,

      // New FE/BE fields (default to 5 vel, 2 team if not set)
      frontendVelocity: m.frontend_velocity || 5,
      frontendTeamSize: m.frontend_team_size || 2,
      backendVelocity: m.backend_velocity || 5,
      backendTeamSize: m.backend_team_size || 2,

      startDate: m.start_date, // New Start Date field
      startTaskId: m.start_task_id, // New Start Task Anchor
      deliveryTaskId: m.delivery_task_id, // Deprecated but kept

      sort_order: m.sort_order,
      tasks: moduleTasks,
    });
  });

  return projects.map(p => {
    // Determine Role
    let role: ProjectRole = 'viewer';
    if (p.user_id === currentUserId) {
        role = 'owner';
    } else {
        // Since `members` is already filtered to the current user (by email) in fetchData,
        // we simply need to find the membership record for this project ID.
        const membership = members.find(m => m.project_id === p.id);
        if (membership) {
            role = membership.role;
        }
    }

    return {
        id: p.id,
        name: p.name,
        modules: (modulesByProject.get(p.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        currentUserRole: role,
        ownerEmail: p.owner_email // Assuming backend joins owner profile or stores email
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
};

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));
// ... existing code ...
