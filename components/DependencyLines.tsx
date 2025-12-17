import React, { useMemo } from 'react';
import { TaskAssignment, TimelineColumn } from '../types';
import { formatDateForInput } from '../constants';

interface DependencyLinesProps {
  allAssignmentsMap: Map<string, TaskAssignment>;
  assignmentRenderInfo: Map<string, {
    rowIndex: number;
    y: number;
    startDate: string | undefined;
    endDate: string;
  }>;
  timeline: TimelineColumn[];
  colWidth: number;
  totalHeight: number;
  sidebarWidth: number;
}

export const DependencyLines: React.FC<DependencyLinesProps> = ({
  allAssignmentsMap,
  assignmentRenderInfo,
  timeline,
  colWidth,
  totalHeight,
  sidebarWidth,
}) => {

  const timelineDateMap = useMemo(() => {
    const map = new Map<string, number>();
    timeline.forEach((col, index) => {
        if (col.date) {
            map.set(formatDateForInput(col.date), index);
        }
    });
    return map;
  }, [timeline]);

  const paths = useMemo(() => {
    const generatedPaths: { id: string, d: string }[] = [];
    
    for (const child of allAssignmentsMap.values()) {
      if (!child.parentAssignmentId) continue;
      
      const parent = allAssignmentsMap.get(child.parentAssignmentId);
      const childInfo = assignmentRenderInfo.get(child.id);
      const parentInfo = assignmentRenderInfo.get(child.parentAssignmentId);

      if (!parent || !childInfo || !parentInfo || !childInfo.startDate) continue;

      const parentEndIndex = timelineDateMap.get(parentInfo.endDate);
      const childStartIndex = timelineDateMap.get(childInfo.startDate);

      if (parentEndIndex === undefined || childStartIndex === undefined) continue;

      const startX = (parentEndIndex + 1) * colWidth - 2;
      const startY = parentInfo.y;
      const endX = childStartIndex * colWidth + 8;
      const endY = childInfo.y;

      // Don't draw if tasks are visually far apart or inverted
      if (endX < startX - 10 || Math.abs(startY - endY) > 800) continue;

      const midX = endX - 15;
      
      const d = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;

      generatedPaths.push({ id: `${parent.id}-${child.id}`, d });
    }
    return generatedPaths;
  }, [allAssignmentsMap, assignmentRenderInfo, timelineDateMap, colWidth]);

  return (
    <svg 
      className="absolute top-0 left-0 pointer-events-none z-20"
      width={timeline.length * colWidth + sidebarWidth}
      height={totalHeight}
      style={{ left: sidebarWidth }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="5"
          markerHeight="3.5"
          refX="5"
          refY="1.75"
          orient="auto"
        >
          <polygon points="0 0, 5 1.75, 0 3.5" fill="#4f46e5" />
        </marker>
      </defs>
      {paths.map(path => (
        <path
          key={path.id}
          d={path.d}
          stroke="#4f46e5"
          strokeWidth="1.5"
          fill="none"
          strokeOpacity="0.6"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
};
