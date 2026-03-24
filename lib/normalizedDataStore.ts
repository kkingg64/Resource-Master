/**
 * Normalized Data Store
 * Converts nested tree structure to flat, normalized schema for O(1) updates
 * 
 * Instead of:
 * projects[].modules[].tasks[].assignments[].allocations[]
 * 
 * We use:
 * { projects: {id: Project}, modules: {id: Module}, ... }
 * 
 * This enables O(1) updates instead of O(n) tree cloning
 */

import { Project, ProjectModule, ProjectTask, TaskAssignment, Resource, Holiday, ResourceAllocation } from '../types';

export interface NormalizedState {
  projects: Record<string, Project>;
  modules: Record<string, ProjectModule>;
  tasks: Record<string, ProjectTask>;
  assignments: Record<string, TaskAssignment>;
  allocations: Record<string, ResourceAllocation>; // Key: assignmentId_weekId
  resources: Record<string, Resource>;
  holidays: Record<string, Holiday>;
  
  // Index maps for fast lookups
  projectModuleIndex: Record<string, string[]>; // projectId -> [moduleId]
  moduleTaskIndex: Record<string, string[]>; // moduleId -> [taskId]
  taskAssignmentIndex: Record<string, string[]>; // taskId -> [assignmentId]
  assignmentAllocationIndex: Record<string, string[]>; // assignmentId -> [allocKey]
}

/**
 * Convert nested tree to normalized schema
 */
export function normalizeData(
  projects: Project[],
  modules: ProjectModule[],
  tasks: ProjectTask[],
  assignments: TaskAssignment[],
  allocations: ResourceAllocation[],
  resources: Resource[],
  holidays: Holiday[]
): NormalizedState {
  const normalized: NormalizedState = {
    projects: {},
    modules: {},
    tasks: {},
    assignments: {},
    allocations: {},
    resources: {},
    holidays: {},
    projectModuleIndex: {},
    moduleTaskIndex: {},
    taskAssignmentIndex: {},
    assignmentAllocationIndex: {},
  };

  // Flatten projects
  projects.forEach(p => {
    normalized.projects[p.id] = p;
    normalized.projectModuleIndex[p.id] = [];
  });

  // Flatten modules
  modules.forEach(m => {
    normalized.modules[m.id] = m;
    normalized.moduleTaskIndex[m.id] = [];
    if (normalized.projectModuleIndex[m.id]) {
      normalized.projectModuleIndex[(m as any).project_id]?.push(m.id);
    }
  });

  // Flatten tasks
  tasks.forEach(t => {
    normalized.tasks[t.id] = t;
    normalized.taskAssignmentIndex[t.id] = [];
    if (normalized.moduleTaskIndex[t.id]) {
      normalized.moduleTaskIndex[(t as any).module_id]?.push(t.id);
    }
  });

  // Flatten assignments
  assignments.forEach(a => {
    normalized.assignments[a.id] = a;
    normalized.assignmentAllocationIndex[a.id] = [];
    if (normalized.taskAssignmentIndex[a.id]) {
      normalized.taskAssignmentIndex[(a as any).task_id]?.push(a.id);
    }
  });

  // Flatten allocations with composite keys
  allocations.forEach(alloc => {
    const key = `${(alloc as any).assignment_id}_${alloc.weekId}`;
    normalized.allocations[key] = alloc;
    const assignmentId = (alloc as any).assignment_id;
    if (normalized.assignmentAllocationIndex[assignmentId]) {
      normalized.assignmentAllocationIndex[assignmentId].push(key);
    }
  });

  // Flatten resources
  resources.forEach(r => {
    normalized.resources[r.id] = r;
  });

  // Flatten holidays
  holidays.forEach(h => {
    normalized.holidays[h.id] = h;
  });

  return normalized;
}

/**
 * Denormalize data back to tree structure for rendering
 */
export function denormalizeData(normalized: NormalizedState): {
  projects: Project[];
  resources: Resource[];
  holidays: Holiday[];
} {
  const projects: Project[] = Object.values(normalized.projects).map(p => ({
    ...p,
    modules: (normalized.projectModuleIndex[p.id] || []).map(mid => {
      const m = normalized.modules[mid];
      return {
        ...m,
        tasks: (normalized.moduleTaskIndex[mid] || []).map(tid => {
          const t = normalized.tasks[tid];
          return {
            ...t,
            assignments: (normalized.taskAssignmentIndex[tid] || []).map(aid => {
              const a = normalized.assignments[aid];
              return {
                ...a,
                allocations: (normalized.assignmentAllocationIndex[aid] || []).map(key => normalized.allocations[key]),
              };
            }),
          };
        }),
      };
    }),
  }));

  return {
    projects,
    resources: Object.values(normalized.resources),
    holidays: Object.values(normalized.holidays),
  };
}

/**
 * O(1) update for allocation
 */
export function updateAllocationNormalized(
  state: NormalizedState,
  assignmentId: string,
  weekId: string,
  count: number,
  days?: Record<string, number>
): NormalizedState {
  const key = `${assignmentId}_${weekId}`;
  
  return {
    ...state,
    allocations: {
      ...state.allocations,
      [key]: {
        weekId,
        count,
        days: days || {},
      },
    },
  };
}

/**
 * O(1) update for assignment resource
 */
export function updateResourceNameNormalized(
  state: NormalizedState,
  assignmentId: string,
  resourceName: string
): NormalizedState {
  const assignment = state.assignments[assignmentId];
  if (!assignment) return state;

  return {
    ...state,
    assignments: {
      ...state.assignments,
      [assignmentId]: {
        ...assignment,
        resourceName,
      },
    },
  };
}

/**
 * O(1) update for assignment schedule
 */
export function updateAssignmentScheduleNormalized(
  state: NormalizedState,
  assignmentId: string,
  startDate: string,
  duration: number
): NormalizedState {
  const assignment = state.assignments[assignmentId];
  if (!assignment) return state;

  return {
    ...state,
    assignments: {
      ...state.assignments,
      [assignmentId]: {
        ...assignment,
        startDate,
        duration,
      },
    },
  };
}
