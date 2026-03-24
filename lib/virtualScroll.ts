/**
 * Virtual Scroll Utilities
 * Calculates which rows should be rendered based on scroll position
 */

const DEFAULT_ROW_HEIGHT = 48; // pixels
const BUFFER_SIZE = 5; // rows to render above/below visible area

export interface VirtualScrollState {
  startIndex: number;
  endIndex: number;
  visibleRowCount: number;
}

/**
 * Calculate which rows are visible based on scroll position
 */
export function calculateVisibleRows(
  scrollTop: number,
  containerHeight: number,
  totalRows: number,
  rowHeight: number = DEFAULT_ROW_HEIGHT
): VirtualScrollState {
  // Calculate visible range
  const visibleRowCount = Math.ceil(containerHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_SIZE);
  const endIndex = Math.min(totalRows, startIndex + visibleRowCount + BUFFER_SIZE * 2);

  return {
    startIndex,
    endIndex,
    visibleRowCount
  };
}

/**
 * Calculate offset for spacer element above visible rows
 */
export function getTopSpacerHeight(startIndex: number, rowHeight: number = DEFAULT_ROW_HEIGHT): number {
  return startIndex * rowHeight;
}

/**
 * Calculate offset for spacer element below visible rows
 */
export function getBottomSpacerHeight(
  endIndex: number,
  totalRows: number,
  rowHeight: number = DEFAULT_ROW_HEIGHT
): number {
  return Math.max(0, (totalRows - endIndex) * rowHeight);
}

/**
 * Count total rows including assignments
 * A task contributes 1 row for itself + 1 row per assignment if expanded
 */
export function countTotalRows(
  projects: any[],
  collapsedTasks: Record<string, boolean>
): number {
  let count = 0;

  projects.forEach(project => {
    project.modules.forEach((module: any) => {
      module.tasks.forEach((task: any) => {
        count++; // Task row itself
        if (!collapsedTasks[task.id]) {
          count += task.assignments.length; // Each expanded assignment
        }
      });
    });
  });

  return count;
}

/**
 * Get row data at specific index
 * Returns which task/assignment to render
 */
export function getRowAtIndex(
  projects: any[],
  collapsedTasks: Record<string, boolean>,
  index: number
): {
  type: 'task' | 'assignment';
  projectId: string;
  moduleId: string;
  taskId: string;
  taskIndex: number;
  assignmentIndex?: number;
  project: any;
  module: any;
  task: any;
  assignment?: any;
} | null {
  let currentIndex = 0;

  for (let pIdx = 0; pIdx < projects.length; pIdx++) {
    const project = projects[pIdx];
    for (let mIdx = 0; mIdx < project.modules.length; mIdx++) {
      const module = project.modules[mIdx];
      for (let tIdx = 0; tIdx < module.tasks.length; tIdx++) {
        const task = module.tasks[tIdx];

        // Task row
        if (currentIndex === index) {
          return {
            type: 'task',
            projectId: project.id,
            moduleId: module.id,
            taskId: task.id,
            taskIndex: tIdx,
            project,
            module,
            task
          };
        }
        currentIndex++;

        // Assignment rows if task is expanded
        if (!collapsedTasks[task.id]) {
          for (let aIdx = 0; aIdx < task.assignments.length; aIdx++) {
            const assignment = task.assignments[aIdx];
            if (currentIndex === index) {
              return {
                type: 'assignment',
                projectId: project.id,
                moduleId: module.id,
                taskId: task.id,
                taskIndex: tIdx,
                assignmentIndex: aIdx,
                project,
                module,
                task,
                assignment
              };
            }
            currentIndex++;
          }
        }
      }
    }
  }

  return null;
}
