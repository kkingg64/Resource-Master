import React, { memo } from 'react';
import { ProjectTask, Holiday, Resource, ProjectModule, Project } from '../types';

/**
 * VirtualizedGridRow - Memoized row component for efficient rendering
 * Only renders when its props actually change
 */

interface VirtualizedGridRowProps {
  project: Project;
  module: ProjectModule;
  task: ProjectTask;
  taskIndex: number;
  isExpanded: boolean;
  colCount: number;
  renderContent: (task: ProjectTask, taskIndex: number) => React.ReactNode;
}

const VirtualizedGridRowComponent: React.FC<VirtualizedGridRowProps> = ({
  project,
  module,
  task,
  taskIndex,
  isExpanded,
  colCount,
  renderContent
}) => {
  return (
    <>
      {renderContent(task, taskIndex)}
      {isExpanded && task.assignments.map((_, assignmentIndex) => (
        <div key={`${task.id}-assign-${assignmentIndex}`}>
          {/* Assignment row rendering will go here */}
        </div>
      ))}
    </>
  );
};

// Memoize with custom comparison to only re-render when data changes
export const VirtualizedGridRow = memo(VirtualizedGridRowComponent, (prevProps, nextProps) => {
  // Return true if props are equal (don't re-render)
  // Return false if props are different (re-render)
  return (
    prevProps.task === nextProps.task &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.taskIndex === nextProps.taskIndex &&
    prevProps.colCount === nextProps.colCount
  );
});

VirtualizedGridRow.displayName = 'VirtualizedGridRow';
