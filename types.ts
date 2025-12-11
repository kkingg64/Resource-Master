

export enum Role {
  CNF = 'CNF',
  BRAND_SOLUTIONS = 'Brand Solutions',
  COE = 'COE',
  EA = 'EA',
  DM = 'DM',
  DEV = 'Dev Team',
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
  startWeekId?: string; // Auto-scheduler start
  duration?: number;    // Auto-scheduler duration in weeks
}

export interface ProjectTask {
  id: string;
  name: string;
  assignments: TaskAssignment[];
  sort_order?: number;
}

export interface ProjectModule {
  id: string;
  name: string;
  legacyFunctionPoints: number; // Total legacy system size (for Fact Findings)
  functionPoints: number; // Target MVP size (for Build)
  tasks: ProjectTask[];
  sort_order?: number;
}

export interface Project {
  id: string;
  name: string;
  modules: ProjectModule[];
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
  country: string; // Country code e.g. 'MY', 'SG', 'Global'
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
}