
export enum Role {
  DEV = 'Dev Team',
  QA = 'QA Team',
  UIUX = 'UI/UX Design',
  PM = 'Project Manager',
  BA = 'Business Analyst',
  DATA = 'Data Mgmt Team',
  APP_SUPPORT = 'App Support',
}

export enum Phase {
  DISCOVERY = 'Preparation on fact findings',
  REQUIREMENTS = 'Defines MVP, Requirements',
  UIUX = 'UI/UX',
  BUILD = 'Design, Build & QA',
}

export interface ResourceAllocation {
  weekId: string; // Format YYYY-WW
  count: number; // Headcount or Man-days
}

export interface TaskAssignment {
  id: string;
  role: Role;
  allocations: ResourceAllocation[];
}

export interface ProjectTask {
  id: string;
  name: string;
  startWeekId?: string; // Auto-scheduler start
  duration?: number;    // Auto-scheduler duration in weeks
  assignments: TaskAssignment[];
}

export interface ProjectModule {
  id: string;
  name: string;
  legacyFunctionPoints: number; // Total legacy system size (for Fact Findings)
  functionPoints: number; // Target MVP size (for Build)
  tasks: ProjectTask[];
}

export interface Project {
  id: string;
  name: string;
  ownerId: string; // User ID of the owner
  sharedWith: string[]; // List of emails having view-only access
  modules: ProjectModule[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
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
  groupLabel: string; // Parent label (e.g., "Nov 2025", "2025")
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
