

export enum Role {
  CNF = 'CNF',
  BRAND_SOLUTIONS = 'Brand Solutions',
  COE = 'COE',
  EA = 'Enterprise Architecture',
  DM = 'DM',
  DEV = 'EP Dev Team',
  PREP_DEV = 'Preparation & Development',
  PLM_D365 = 'PLM & D365',
  BA = 'BA',
  APP_SUPPORT = 'Application Support',
}

export enum Phase {
  DISCOVERY = 'Preparation on fact findings',
  REQUIREMENTS = 'Defines MVP, Requirements',
  UIUX = 'UI/UX',
  BUILD = 'Design, Build & QA',
}

export enum ModuleType {
  Preparation = 'MILESTONE',
  Development = 'STANDARD',
  PostDevelopment = 'KEY_PHASE',
  MVP = 'MVP',
  Production = 'PRODUCTION',
}

export const MODULE_TYPE_DISPLAY_NAMES: Record<ModuleType, string> = {
  [ModuleType.Preparation]: 'Preparation',
  [ModuleType.Development]: 'Development',
  [ModuleType.PostDevelopment]: 'Post-Development',
  [ModuleType.MVP]: 'MVP',
  [ModuleType.Production]: 'Production',
};

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export interface ResourceAllocation {
  weekId: string; // Format YYYY-WW
  count: number; // Headcount or Man-days (Weekly Total)
  days?: Record<string, number>; // Key: YYYY-MM-DD, Value: count
}

export interface TaskAssignment {
  id: string;
  role: Role;
  resourceName?: string;
  allocations: ResourceAllocation[];
  startDate?: string; // YYYY-MM-DD Auto-scheduler start
  startWeekId?: string; // DEPRECATED: Auto-scheduler start
  duration?: number;    // Auto-scheduler duration in DAYS
  progress?: number;    // 0 to 100 percentage
  parentAssignmentId?: string; // ID of the task this one depends on
  sort_order?: number;
}

export interface ProjectTask {
  id: string;
  name: string;
  assignments: TaskAssignment[];
  startDate?: string; // Manual Start Date Override for Estimator
  sort_order?: number;
  frontendFunctionPoints?: number;
  backendFunctionPoints?: number;
  
  // New fields for task-level estimation overrides
  frontendVelocity?: number;
  frontendTeamSize?: number;
  frontendComplexity?: ComplexityLevel;
  backendVelocity?: number;
  backendTeamSize?: number;
  backendComplexity?: ComplexityLevel;
}

export type ComplexityLevel = 'Low' | 'Medium' | 'High' | 'Complex';

export interface ProjectModule {
  id: string;
  name: string;
  type?: ModuleType;
  legacyFunctionPoints: number; // Total legacy system size (for Fact Findings)
  functionPoints: number; // Target MVP size (Legacy field, now split)
  complexity?: ComplexityLevel; // Legacy field
  
  frontendFunctionPoints?: number;
  backendFunctionPoints?: number;
  frontendComplexity?: ComplexityLevel;
  backendComplexity?: ComplexityLevel;

  // New Per-Module Prep Config
  prepVelocity?: number;
  prepTeamSize?: number;

  // New Per-Module FE/BE Config
  frontendVelocity?: number;
  frontendTeamSize?: number;
  backendVelocity?: number;
  backendTeamSize?: number;

  // Manual Start Date Override
  startDate?: string;
  // Start Task Anchor (Task ID from within this module)
  startTaskId?: string;
  
  // Manual Delivery Task Override (Task ID from within this module) - Deprecated in favor of auto-calc but kept for type safety
  deliveryTaskId?: string;

  tasks: ProjectTask[];
  sort_order?: number;
}

export interface Project {
  id: string;
  name: string;
  modules: ProjectModule[];
  currentUserRole?: ProjectRole; // Role of the current user in this project
  ownerEmail?: string;
  user_id: string; // Add owner ID
}

export interface WeeklySummary {
  weekId: string;
  totalResources: number;
  byRole: Record<Role, number>;
}

export type ViewMode = 'day' | 'week' | 'month';

export interface TimelineColumn {
  id: string; // Unique ID for the column (YYYY-MM-DD, YYYY-WW, or YYYY-MM)
  label: string; // Display label (e.g., "01", "Wk 44", "Nov")
  
  // Explicit labels for multi-level grouping
  yearLabel: string;
  monthLabel: string;
  weekLabel: string;

  date?: Date;
  type: ViewMode;
  weekIds?: string[]; // For Month view: which weeks belong to this month
  parentWeekId?: string; // For Day view: which week does this day belong to
}

export interface TimelineWeek {
  id: string;
  label: string;
  month: string;
  year: number;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  country: string; // Country code e.g., 'MY', 'SG', 'Global'
  user_id?: string; // Optional owner ID
  duration?: number; // 1 for full day, 0.5 for half day
}

export interface IndividualHoliday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  resource_id: string;
  duration?: number; // 1 for full day, 0.5 for half day
}

export interface LogEntry {
  id: number;
  timestamp: string;
  message: string;
  payload?: any;
  status: 'pending' | 'success' | 'error';
}

export interface Resource {
  id: string;
  name: string;
  category: Role;
  holiday_region?: string;
  individual_holidays?: IndividualHoliday[];
  type: 'Internal' | 'External';
  user_id?: string; // Optional owner ID
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_email: string;
  role: ProjectRole;
}