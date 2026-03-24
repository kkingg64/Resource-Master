# Performance Analysis & Optimization Plan

## Executive Summary
The application has significant performance bottlenecks when handling 1113+ records. The primary issues are:
- **Unnecessary re-renders** across deeply nested component hierarchy
- **Missing virtualization** causing thousands of DOM nodes
- **Expensive calculations** on every render (date formatting, progress calculation)
- **Inefficient state updates** with deeply nested object spread operations
- **No data normalization** leading to O(n) searches and complex traversals

---

## Critical Performance Issues

### 1. **PlannerGrid Component (1584 lines) - HIGHEST PRIORITY**

#### Problem
- Renders entire grid even if rows are off-screen (no virtualization)
- Thousands of calculations per render:
  - Date formatting for every assignment
  - Progress calculation
  - Holiday lookup for every cell
  - Column index calculations
- Inline event handlers cause re-renders

#### Impact
- With 495 allocations × 52 weeks = 25,740+ potential cells
- Every keystroke in any cell triggers full tree re-render
- Scrolling is extremely laggy

#### Solution (Recommended)
```typescript
// BEFORE: Full DOM rendering
{visible_assignments.map(a => (
  {timeline.map(col => (
    // 1584-line component renders this 25,740+ times
  ))}
))}

// AFTER: Virtual scrolling
<VirtualList
  itemCount={assignments.length}
  itemSize={48}
  renderItem={(index) => <AssignmentRow index={index} />}
/>
```

---

### 2. **State Management - Deeply Nested Updates**

#### Problem
On allocation update, code does:
```typescript
// CURRENT: 7-level deep object spread
setProjects(prev => 
  prev.map(p => 
    p.map(m => 
      m.map(t => 
        t.map(a => 
          a.map(alloc => /* update */)
        )
      )
    )
  )
);
```

This is O(n) where n = total assignments, and creates new arrays for EVERY unchanged item.

#### Impact
- Single cell edit causes entire data tree to be cloned
- Memory spike with 1113+ records
- GC pressure increases

#### Solution
**Normalize the data structure** - move from nested tree to normalized schema:
```typescript
// CURRENT (Bad for updates)
projects: [{
  modules: [{
    tasks: [{
      assignments: [{
        allocations: [...]
      }]
    }]
  }]
}]

// RECOMMENDED (Good for updates)
{
  projects: { [id]: Project },
  modules: { [id]: Module },
  tasks: { [id]: Task },
  assignments: { [id]: Assignment },
  allocations: { [assignmentId_weekId]: Allocation }
}
```

---

### 3. **Timeline Auto-Expansion Effect**

#### Problem
```typescript
useEffect(() => {
  projects.forEach(p =>
    p.modules.forEach(m =>
      m.tasks.forEach(t =>
        t.assignments.forEach(a => {
          // Traverse entire tree on every projects change
        })
      )
    )
  );
}, [projects, holidays, timelineStart, timelineEnd]);
```

#### Impact
- Runs on EVERY data change (which is frequent with 1113 records)
- O(n) traversal of entire project tree
- Unnecessary dependency on `holidays` array

#### Solution
- Memoize the tree traversal calculation
- Update only when necessary (add/delete assignments)
- Use `useCallback` with specific dependencies

---

### 4. **Missing Virtualization in PlannerGrid**

#### Current Rendering
- All assignments rendered immediately
- If 495 allocations × multiple rows = 2000+ DOM nodes visible
- Scrolling causes re-render of entire visible area

#### Solution
Implement React window virtual scrolling:
```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={window.innerHeight - 100}
  itemCount={visibleAssignments.length}
  itemSize={48}
  width="100%"
>
  {({ index, style }) => (
    <AssignmentRow 
      style={style} 
      assignment={visibleAssignments[index]} 
    />
  )}
</FixedSizeList>
```

---

### 5. **Inefficient Calculations on Every Render**

| Calculation | Frequency | Cost |
|-------------|-----------|------|
| Holiday mapping | Every render | O(n) array → map conversion |
| Progress calculation | Every assignment cell | O(1) math but × 1000s |
| Date formatting | Every cell | String manipulation × 2000+ |
| Timeline columns | Every render | O(52 weeks) × views |
| Resource grouped map | Every render | O(n) array reduce |
| Dependency calculation | Every assignment | O(n) traversal |

#### Solution
Memoize calculations:
```typescript
const holidayMap = useMemo(() => {
  const map = new Map();
  holidays.forEach(h => map.set(h.date, h.duration));
  return map;
}, [holidays]);

const progressPercentage = useMemo(() => 
  calculateProgress(a.startDate, a.duration, holidayMap),
  [a.startDate, a.duration, holidayMap]
);
```

---

### 6. **Data Loading Performance**

#### Problem
`structureProjectsData()` function:
- Creates 5 nested Maps (O(n) for each)
- Transforms 1113 records every time
- Called on every data fetch

#### Solution
- Cache structured data
- Update only changed records
- Use normalization from Issue #2

---

## Recommended Optimization Roadmap

### Phase 1: Quick Wins (1-2 hours) - 30-40% improvement
1. ✅ **Wrap PlannerGrid in React.memo()** (Already done)
2. ✅ **Add useCallback to Grid handlers** (Partially done)
3. **Memoize expensive calculations**
   - Holiday mapping
   - Grouped resources
   - Progress calculations
4. **Remove unnecessary dependencies in useEffect**
   - Timeline auto-expand shouldn't depend on holidays

### Phase 2: Medium Impact (3-4 hours) - 50-60% total improvement
5. **Implement virtual scrolling for assignment rows**
   - Use `react-window` or custom implementation
   - Only render visible rows
6. **Optimize `structureProjectsData`**
   - Cache results
   - Use memoization for intermediate Map creation
7. **Add useMemo to complex renders**
   - Month/Year headers
   - Timeline calculations

### Phase 3: Major Refactor (6-8 hours) - 70-80% total improvement
8. **Normalize data structure** (Breaking change)
   - Move from nested tree to normalized schema
   - Update all update handlers
   - Massive performance gain for updates
9. **Implement request debouncing**
   - Batch multiple updates
   - Reduce re-renders
10. **Add IndexedDB caching**
    - Avoid localStorage bottleneck
    - Async data loading

### Phase 4: Advanced (8-10 hours) - 80-90% improvement
11. **Web Worker for calculations**
    - Move date calculations to worker thread
    - Keep UI responsive
12. **Implement data pagination**
    - Load projects/modules on demand
    - Progressive loading
13. **Add React Suspense for data fetching**
    - Parallel data loading
    - Better UX

---

## Specific Code Changes

### Before: PlannerGrid Update Handler
```typescript
onUpdateAllocation={(pid, mid, tid, aid, wid, val, day) => {
  setProjects(prev => {
    return prev.map(p => {
      if (p.id !== pid) return p;
      return {
        ...p,
        modules: p.modules.map(m => {
          if (m.id !== mid) return m;
          return {
            ...m,
            tasks: m.tasks.map(t => {
              if (t.id !== tid) return t;
              return {
                ...t,
                assignments: t.assignments.map(a => {
                  if (a.id !== aid) return a;
                  // ...very expensive...
                })
              };
            })
          };
        })
      };
    });
  });
}}
```

### After: Normalized Structure
```typescript
// State reduction
const [allocations, setAllocations] = useState<Record<string, Allocation>>({});

// Update handler
onUpdateAllocation={(aid, wid, val) => {
  setAllocations(prev => ({
    ...prev,
    [`${aid}_${wid}`]: { weekId: wid, count: val }
  }));
}} // Now O(1) instead of O(n)
```

---

## Monitoring Performance

### Add Performance Markers
```typescript
// App.tsx
useEffect(() => {
  const start = performance.now();
  fetchData(false);
  return () => {
    console.log(`Data fetch took ${performance.now() - start}ms`);
  };
}, []);

// PlannerGrid.tsx
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    console.time('PlannerGrid render');
    return () => console.timeEnd('PlannerGrid render');
  }
}, []);
```

### Measure with DevTools
1. Open Chrome DevTools
2. Go to Performance tab
3. Record while scrolling/editing
4. Look for long main-thread tasks > 50ms

---

## Next Steps

1. **Start with Phase 1** (Quick wins)
   - Should give 30-40% improvement with minimal risk
   
2. **Then Phase 2** (Medium effort/impact)
   - Virtual scrolling alone will give huge improvement
   
3. **Only proceed to Phase 3 if needed**
   - Data normalization is a major refactor
   - Worth it for 70%+ improvement on large datasets

4. **Measure constantly**
   - Profile before/after each change
   - Use Chrome DevTools Performance tab

---

## Estimated Performance Improvements

| Optimization | Expected Impact | Difficulty |
|--------------|-----------------|-----------|
| React.memo on PlannerGrid | +15% | ✅ Done |
| Memoize calculations | +15% | 🟢 Easy |
| Virtual scrolling | +35% | 🟡 Medium |
| Normalize data | +25% | 🔴 Hard |
| Web Workers | +10% | 🔴 Hard |
| **Total Potential** | **~80%** | - |

---

## Priority: ⭐⭐⭐⭐⭐

Virtual scrolling (Phase 2) will have the biggest immediate impact with moderate effort.
