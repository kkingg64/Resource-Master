import React, { useMemo } from 'react';
import { TaskAssignment, TimelineColumn } from '../types';
import { formatDateForInput, getWeekIdFromDate } from '../constants';

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

  // Robust column index finder that works for Day, Week, and Month views
  const getColumnIndex = (dateStr: string): number => {
    if (!dateStr || timeline.length === 0) return -1;
    
    // 1. Try exact date match (Day View)
    // We check date string match to handle potential timezone/time component diffs
    const dayIndex = timeline.findIndex(col => col.date && formatDateForInput(col.date) === dateStr);
    if (dayIndex !== -1) return dayIndex;

    const date = new Date(dateStr.replace(/-/g, '/'));
    const weekId = getWeekIdFromDate(date);

    // 2. Try Week match (Week View)
    const weekIndex = timeline.findIndex(col => col.id === weekId);
    if (weekIndex !== -1) return weekIndex;

    // 3. Try Month match (Month View) - check if the column includes this week
    const monthIndex = timeline.findIndex(col => col.weekIds?.includes(weekId));
    if (monthIndex !== -1) return monthIndex;

    return -1;
  };

  const paths = useMemo(() => {
    const generatedPaths: { id: string, d: string }[] = [];
    
    for (const child of allAssignmentsMap.values()) {
      if (!child.parentAssignmentId) continue;
      
      const parent = allAssignmentsMap.get(child.parentAssignmentId);
      const childInfo = assignmentRenderInfo.get(child.id);
      const parentInfo = assignmentRenderInfo.get(child.parentAssignmentId);

      if (!parent || !childInfo || !parentInfo || !childInfo.startDate) continue;

      const parentEndIndex = getColumnIndex(parentInfo.endDate);
      const childStartIndex = getColumnIndex(childInfo.startDate);

      if (parentEndIndex === -1 || childStartIndex === -1) continue;

      // Coordinates relative to SVG origin (which is at sidebarWidth)
      const startX = (parentEndIndex + 1) * colWidth; // Right edge of parent column
      const startY = parentInfo.y;
      const endX = childStartIndex * colWidth; // Left edge of child column
      const endY = childInfo.y;

      const gap = 10; // elbow room

      let d = '';

      // Standard Finish-to-Start Path Routing
      if (endX > startX + gap * 2) {
          // Enough space for a standard S-curve
          // Path: Start -> Right(gap) -> Vertical -> Left(gap from end) -> End
          const turn2X = endX - gap;
          d = `M ${startX} ${startY} L ${turn2X} ${startY} L ${turn2X} ${endY} L ${endX} ${endY}`;
      } else {
          // Close or Overlapping (Backwards dependency visual)
          // Go right, then down, then back left
          const turnX = Math.max(startX, endX) + gap;
          d = `M ${startX} ${startY} L ${turnX} ${startY} L ${turnX} ${endY} L ${endX} ${endY}`;
      }

      generatedPaths.push({ id: `${parent.id}-${child.id}`, d });
    }
    return generatedPaths;
  }, [allAssignmentsMap, assignmentRenderInfo, timeline, colWidth]);

  return (
    <svg 
      className="absolute top-0 left-0 pointer-events-none z-20"
      width={timeline.length * colWidth + sidebarWidth} // Ensure width covers full area
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
          <polygon points="0 0, 5 1.75, 0 3.5" fill="#6366f1" /> {/* Indigo-500 */}
        </marker>
      </defs>
      {paths.map(path => (
        <path
          key={path.id}
          d={path.d}
          stroke="#6366f1" // Indigo-500
          strokeWidth="1.5"
          fill="none"
          strokeOpacity="0.8"
          markerEnd="url(#arrowhead)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
};