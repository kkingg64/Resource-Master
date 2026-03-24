import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Project, ProjectModule, ProjectTask } from '../types';
import { calculateVisibleRows, getTopSpacerHeight, getBottomSpacerHeight, countTotalRows } from '../lib/virtualScroll';

interface OptimizedGridContainerProps {
  projects: Project[];
  collapsedTasks: Record<string, boolean>;
  scrollContainer: HTMLDivElement | null;
  children: React.ReactNode;
  rowHeight?: number;
}

/**
 * OptimizedGridContainer - Manages virtual scrolling for large grids
 * Calculates visible rows and only renders what's in view
 */
export const OptimizedGridContainer: React.FC<OptimizedGridContainerProps> = ({
  projects,
  collapsedTasks,
  scrollContainer,
  children,
  rowHeight = 48,
}) => {
  const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 50 });
  const [scrollTop, setScrollTop] = useState(0);

  const totalRows = countTotalRows(projects, collapsedTasks);
  const containerHeight = scrollContainer?.clientHeight || 600;

  // Handle scroll with optimization
  const handleScroll = useCallback(() => {
    if (!scrollContainer) return;
    
    const newScrollTop = scrollContainer.scrollTop;
    setScrollTop(newScrollTop);

    const range = calculateVisibleRows(newScrollTop, containerHeight, totalRows, rowHeight);
    setVisibleRange(range);
  }, [scrollContainer, containerHeight, totalRows, rowHeight]);

  // Add scroll event listener with throttling
  useEffect(() => {
    if (!scrollContainer) return;

    let throttleTimeout: NodeJS.Timeout;
    const throttledScroll = () => {
      clearTimeout(throttleTimeout);
      throttleTimeout = setTimeout(handleScroll, 16); // ~60fps
    };

    scrollContainer.addEventListener('scroll', throttledScroll);
    return () => {
      scrollContainer.removeEventListener('scroll', throttledScroll);
      clearTimeout(throttleTimeout);
    };
  }, [scrollContainer, handleScroll]);

  const topSpacerHeight = getTopSpacerHeight(visibleRange.startIndex, rowHeight);
  const bottomSpacerHeight = getBottomSpacerHeight(visibleRange.endIndex, totalRows, rowHeight);

  return (
    <>
      {/* Top spacer - invisible element maintaining scroll height */}
      <div style={{ height: topSpacerHeight, pointerEvents: 'none' }} />
      
      {/* Visible rows - only these are rendered */}
      {children}
      
      {/* Bottom spacer - invisible element maintaining scroll height */}
      <div style={{ height: bottomSpacerHeight, pointerEvents: 'none' }} />
    </>
  );
};

OptimizedGridContainer.displayName = 'OptimizedGridContainer';
