
import { Project, Role, Phase, TimelineWeek, TimelineColumn, ViewMode, Holiday } from './types';

// Mock "Government Database" - Expanded for 2024-2027
export const GOV_HOLIDAYS_DB: Record<string, Holiday[]> = {
  'HK': [
    // 2024
    { id: 'hk-2024-12-25', date: '2024-12-25', name: 'Christmas Day', country: 'HK' },
    { id: 'hk-2024-12-26', date: '2024-12-26', name: 'Boxing Day', country: 'HK' },
    // 2025
    { id: 'hk-2025-01-01', date: '2025-01-01', name: 'New Year Day', country: 'HK' },
    { id: 'hk-2025-01-29', date: '2025-01-29', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { id: 'hk-2025-01-30', date: '2025-01-30', name: 'Lunar New Year (Day 2)', country: 'HK' },
    { id: 'hk-2025-01-31', date: '2025-01-31', name: 'Lunar New Year (Day 3)', country: 'HK' },
    { id: 'hk-2025-04-04', date: '2025-04-04', name: 'Ching Ming Festival', country: 'HK' },
    { id: 'hk-2025-04-18', date: '2025-04-18', name: 'Good Friday', country: 'HK' },
    { id: 'hk-2025-04-21', date: '2025-04-21', name: 'Easter Monday', country: 'HK' },
    { id: 'hk-2025-05-01', date: '2025-05-01', name: 'Labour Day', country: 'HK' },
    { id: 'hk-2025-07-01', date: '2025-07-01', name: 'HKSAR Establishment Day', country: 'HK' },
    { id: 'hk-2025-10-01', date: '2025-10-01', name: 'National Day', country: 'HK' },
    { id: 'hk-2025-12-25', date: '2025-12-25', name: 'Christmas Day', country: 'HK' },
    { id: 'hk-2025-12-26', date: '2025-12-26', name: 'Boxing Day', country: 'HK' },
    // 2026
    { id: 'hk-2026-01-01', date: '2026-01-01', name: 'New Year Day', country: 'HK' },
    { id: 'hk-2026-02-17', date: '2026-02-17', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { id: 'hk-2026-02-18', date: '2026-02-18', name: 'Lunar New Year (Day 2)', country: 'HK' },
    { id: 'hk-2026-02-19', date: '2026-02-19', name: 'Lunar New Year (Day 3)', country: 'HK' },
    { id: 'hk-2026-04-03', date: '2026-04-03', name: 'Good Friday', country: 'HK' },
    { id: 'hk-2026-04-04', date: '2026-04-04', name: 'Holy Saturday / Ching Ming', country: 'HK' },
    { id: 'hk-2026-04-06', date: '2026-04-06', name: 'Easter Monday', country: 'HK' },
    { id: 'hk-2026-05-01', date: '2026-05-01', name: 'Labour Day', country: 'HK' },
    { id: 'hk-2026-12-25', date: '2026-12-25', name: 'Christmas Day', country: 'HK' },
    { id: 'hk-2026-12-26', date: '2026-12-26', name: 'Boxing Day', country: 'HK' },
    // 2027
    { id: 'hk-2027-01-01', date: '2027-01-01', name: 'New Year Day', country: 'HK' },
    { id: 'hk-2027-02-06', date: '2027-02-06', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { id: 'hk-2027-02-07', date: '2027-02-07', name: 'Lunar New Year (Day 2)', country: 'HK' },
  ],
  'CN': [
    // 2025
    { id: 'cn-2025-01-01', date: '2025-01-01', name: 'New Year Day', country: 'CN' },
    { id: 'cn-2025-01-29', date: '2025-01-29', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2025-01-30', date: '2025-01-30', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2025-10-01', date: '2025-10-01', name: 'National Day', country: 'CN' },
    // 2026
    { id: 'cn-2026-01-01', date: '2026-01-01', name: 'New Year Day', country: 'CN' },
    { id: 'cn-2026-02-17', date: '2026-02-17', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-18', date: '2026-02-18', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-19', date: '2026-02-19', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-20', date: '2026-02-20', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-21', date: '2026-02-21', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-22', date: '2026-02-22', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-02-23', date: '2026-02-23', name: 'Spring Festival', country: 'CN' },
    { id: 'cn-2026-04-04', date: '2026-04-04', name: 'Qingming Festival', country: 'CN' },
  ],
  'MY': [
    { id: 'my-1', date: '2025-12-25', name: 'Christmas Day', country: 'MY' },
    { id: 'my-2', date: '2026-01-01', name: 'New Year Day', country: 'MY' },
    { id: 'my-3', date: '2026-02-01', name: 'Federal Territory Day', country: 'MY' },
    { id: 'my-4', date: '2026-02-02', name: 'Federal Territory Day (Observed)', country: 'MY' },
    { id: 'my-5', date: '2026-02-17', name: 'Chinese New Year', country: 'MY' },
    { id: 'my-6', date: '2026-02-18', name: 'Chinese New Year (Day 2)', country: 'MY' },
    { id: 'my-7', date: '2026-03-30', name: 'Hari Raya Aidilfitri', country: 'MY' },
    { id: 'my-8', date: '2026-03-31', name: 'Hari Raya Aidilfitri (Day 2)', country: 'MY' },
  ],
  'SG': [
    { id: 'sg-1', date: '2025-12-25', name: 'Christmas Day', country: 'SG' },
    { id: 'sg-2', date: '2026-01-01', name: 'New Year Day', country: 'SG' },
    { id: 'sg-3', date: '2026-02-17', name: 'Chinese New Year', country: 'SG' },
    { id: 'sg-4', date: '2026-02-18', name: 'Chinese New Year (Day 2)', country: 'SG' },
    { id: 'sg-5', date: '2026-03-30', name: 'Hari Raya Puasa', country: 'SG' },
    { id: 'sg-6', date: '2026-04-03', name: 'Good Friday', country: 'SG' },
  ],
  'US': [
    { id: 'us-1', date: '2025-11-27', name: 'Thanksgiving Day', country: 'US' },
    { id: 'us-2', date: '2025-12-25', name: 'Christmas Day', country: 'US' },
    { id: 'us-3', date: '2026-01-01', name: 'New Year Day', country: 'US' },
    { id: 'us-4', date: '2026-01-19', name: 'Martin Luther King Jr. Day', country: 'US' },
    { id: 'us-5', date: '2026-02-16', name: 'Presidents Day', country: 'US' },
  ]
};

export const INITIAL_HOLIDAYS: Holiday[] = [
  ...GOV_HOLIDAYS_DB['HK'] // Default to Hong Kong
];

// Helper to keep existing logic working temporarily or as a fallback
export const HOLIDAYS = INITIAL_HOLIDAYS.map(h => h.date);

const INITIAL_MODULES_DATA = [
  {
    id: 'm1',
    name: 'User Module',
    legacyFunctionPoints: 650,
    functionPoints: 544,
    tasks: [
      {
        id: 't1-1',
        name: Phase.DISCOVERY,
        startWeekId: '2025-44',
        duration: 2,
        assignments: [
          {
            id: 'a1-1-1',
            role: Role.BA,
            resourceName: 'Alex Chen',
            allocations: [
              { weekId: '2025-44', count: 12 },
              { weekId: '2025-45', count: 18 }
            ]
          }
        ]
      },
      {
        id: 't1-2',
        name: Phase.REQUIREMENTS,
        startWeekId: '2025-46',
        duration: 1,
        assignments: [
          {
            id: 'a1-2-1',
            role: Role.BA,
            resourceName: 'Alex Chen',
            allocations: [
              { weekId: '2025-46', count: 18 }
            ]
          }
        ]
      },
      {
        id: 't1-3',
        name: Phase.UIUX,
        startWeekId: '2025-47',
        duration: 2,
        assignments: [
          {
            id: 'a1-3-1',
            role: Role.UIUX,
            resourceName: 'Sarah Lee',
            allocations: [
              { weekId: '2025-47', count: 1 },
              { weekId: '2025-48', count: 1 }
            ]
          }
        ]
      },
      {
        id: 't1-4',
        name: Phase.BUILD,
        startWeekId: '2025-49',
        duration: 3,
        assignments: [
          {
            id: 'a1-4-1',
            role: Role.DEV,
            resourceName: 'Unassigned',
            allocations: [
              { weekId: '2025-49', count: 2 },
              { weekId: '2025-50', count: 2 },
              { weekId: '2025-51', count: 1 },
            ]
          }
        ]
      },
      {
        id: 't1-5',
        name: 'QA & Testing',
        startWeekId: '2025-52',
        duration: 1,
        assignments: [
          {
            id: 'a1-5-1',
            role: Role.QA,
            resourceName: 'Mike Johnson',
            allocations: [
              { weekId: '2025-52', count: 1 }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'm2',
    name: 'Program Profile Settings',
    legacyFunctionPoints: 400,
    functionPoints: 322,
    tasks: [
       {
        id: 't2-1',
        name: Phase.DISCOVERY,
        startWeekId: '2025-46',
        duration: 1,
        assignments: [
          {
            id: 'a2-1-1',
            role: Role.BA,
            resourceName: 'Alex Chen',
            allocations: [
              { weekId: '2025-46', count: 18 }
            ]
          }
        ]
       },
       {
        id: 't2-2',
        name: Phase.UIUX,
        startWeekId: '2025-49',
        duration: 2,
        assignments: [
          {
            id: 'a2-2-1',
            role: Role.UIUX,
            resourceName: 'Sarah Lee',
            allocations: [
              { weekId: '2025-49', count: 1 },
              { weekId: '2025-50', count: 1 }
            ]
          }
        ]
       },
       {
        id: 't2-3',
        name: Phase.BUILD,
        startWeekId: '2025-51',
        duration: 3,
        assignments: [
          {
            id: 'a2-3-1',
            role: Role.DEV,
            resourceName: 'Unassigned',
            allocations: [
              { weekId: '2025-51', count: 2 },
              { weekId: '2025-52', count: 2 },
              { weekId: '2026-01', count: 1 }
            ]
          },
          {
            id: 'a2-3-2',
            role: Role.QA,
            resourceName: 'Mike Johnson',
             allocations: [
              { weekId: '2026-01', count: 1 }
            ]
          }
        ]
       }
    ]
  },
  {
    id: 'm3',
    name: 'Product Module (Ron+COE)',
    legacyFunctionPoints: 100,
    functionPoints: 83,
    tasks: []
  },
  {
    id: 'm4',
    name: 'Authentication Centre',
    legacyFunctionPoints: 150,
    functionPoints: 120,
    tasks: []
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'OMS Migration Phase 1',
    modules: INITIAL_MODULES_DATA
  }
];

// --- Date Utilities for Timeline Generation ---

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Helper to get date from ISO Week
const getDateFromWeek = (year: number, week: number): Date => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
};

// Simplified timeline generation
export interface WeekPoint { year: number; week: number; }

export const addWeeksToPoint = (point: WeekPoint, weeksToAdd: number): WeekPoint => {
  let { year, week } = point;
  let totalWeeks = week + weeksToAdd;
  
  while (totalWeeks > 52) {
    year++;
    totalWeeks -= 52;
  }
  while (totalWeeks < 1) {
    year--;
    totalWeeks += 52;
  }
  return { year, week: totalWeeks };
};

// Helper to generate a range of weeks dynamically
const generateWeeks = (start: WeekPoint, end: WeekPoint): TimelineColumn[] => {
  const weeks: TimelineColumn[] = [];
  
  let current = { ...start };
  const endValue = end.year * 100 + end.week;

  while ((current.year * 100 + current.week) <= endValue) {
    const paddedWeek = current.week.toString().padStart(2, '0');
    
    // Determine Month Label
    const date = getDateFromWeek(current.year, current.week);
    const monthName = MONTH_NAMES[date.getMonth()];
    const groupLabel = `${monthName} ${current.year}`;

    weeks.push({ 
      id: `${current.year}-${paddedWeek}`, 
      label: `W${paddedWeek}`, 
      groupLabel: groupLabel,
      type: 'week'
    });

    current = addWeeksToPoint(current, 1);
  }
  
  return weeks;
};

// Generate Months (Aggregated View)
const generateMonths = (weeks: TimelineColumn[]): TimelineColumn[] => {
  const monthsMap = new Map<string, TimelineColumn & { weekIds: string[] }>();

  weeks.forEach(w => {
    const [monthName, year] = w.groupLabel.split(' ');
    const id = `${year}-${MONTH_NAMES.indexOf(monthName) + 1}`;
    
    if (!monthsMap.has(id)) {
      monthsMap.set(id, {
        id,
        label: monthName,
        groupLabel: year,
        type: 'month',
        weekIds: []
      });
    }
    monthsMap.get(id)?.weekIds.push(w.id);
  });

  return Array.from(monthsMap.values());
};

// Generate Days (Expanded View)
const generateDays = (weeks: TimelineColumn[]): TimelineColumn[] => {
  const days: TimelineColumn[] = [];
  // For performance in demo, limit day view range if too large? 
  // For now, render all. User can control via timeline range.
  
  weeks.forEach(week => {
    const [yearStr, weekNumStr] = week.id.split('-');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekNumStr);
    const monday = getDateFromWeek(year, weekNum);

    // Generate Mon-Fri for each week
    ['M', 'T', 'W', 'T', 'F'].forEach((dayName, idx) => {
       const date = new Date(monday);
       date.setDate(monday.getDate() + idx);
       
       days.push({
         id: `${week.id}-d${idx}`,
         label: dayName,
         groupLabel: week.label,
         type: 'day',
         parentWeekId: week.id,
         date: date
       });
    });
  });
  return days;
};

export const getTimeline = (mode: ViewMode, start: WeekPoint, end: WeekPoint): TimelineColumn[] => {
  const weeks = generateWeeks(start, end);
  switch (mode) {
    case 'month': return generateMonths(weeks);
    case 'day': return generateDays(weeks);
    case 'week': 
    default:
      return weeks;
  }
};

// Default initial range
export const DEFAULT_START = { year: 2025, week: 44 };
export const DEFAULT_END = { year: 2026, week: 16 };

const _weeks = generateWeeks({ year: 2024, week: 1 }, { year: 2027, week: 52 }); // Generate a large range for ALL_WEEK_IDS lookup
export const ALL_WEEK_IDS = _weeks.map(w => w.id);

// Legacy support for dashboard
export const TIMELINE_DATA: TimelineWeek[] = generateWeeks(DEFAULT_START, DEFAULT_END).map(w => ({
  id: w.id,
  label: w.label.replace('W', ''),
  month: w.groupLabel.split(' ')[0],
  year: parseInt(w.groupLabel.split(' ')[1])
}));
