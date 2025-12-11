
import { TimelineColumn, ViewMode, Holiday } from './types';

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
  ],
  'MY': [
    { id: 'my-1', date: '2025-12-25', name: 'Christmas Day', country: 'MY' },
    { id: 'my-2', date: '2026-01-01', name: 'New Year Day', country: 'MY' },
    { id: 'my-3', date: '2026-02-17', name: 'Chinese New Year', country: 'MY' },
  ],
  'SG': [
    { id: 'sg-1', date: '2025-12-25', name: 'Christmas Day', country: 'SG' },
    { id: 'sg-2', date: '2026-01-01', name: 'New Year Day', country: 'SG' },
    { id: 'sg-3', date: '2026-02-17', name: 'Chinese New Year', country: 'SG' },
  ],
  'US': [
    { id: 'us-1', date: '2025-11-27', name: 'Thanksgiving Day', country: 'US' },
    { id: 'us-2', date: '2025-12-25', name: 'Christmas Day', country: 'US' },
    { id: 'us-3', date: '2026-01-01', name: 'New Year Day', country: 'US' },
  ]
};

// --- Date Utilities for Timeline Generation ---

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Helper to get date from ISO Week
export const getDateFromWeek = (year: number, week: number): Date => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const ISOweekStart = simple;
  if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
  else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
  return ISOweekStart;
};

// Helper to get ISO Week from Date
export const getWeekIdFromDate = (d: Date): string => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  var weekNo = Math.ceil(( ( (d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-${weekNo.toString().padStart(2, '0')}`;
}

export const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
}

export interface WeekPoint { year: number; week: number; }

export const addWeeksToPoint = (point: WeekPoint, weeksToAdd: number): WeekPoint => {
  let { year, week } = point;
  let totalWeeks = week + weeksToAdd;
  
  while (totalWeeks > 52) {
    year++;
    totalWeeks -= 52; // This is a simplification, a date library would be more accurate
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

const generateMonths = (weeks: TimelineColumn[]): TimelineColumn[] => {
  const monthsMap = new Map<string, TimelineColumn & { weekIds: string[] }>();
  weeks.forEach(w => {
    const [monthName, year] = w.groupLabel.split(' ');
    const id = `${year}-${MONTH_NAMES.indexOf(monthName) + 1}`;
    if (!monthsMap.has(id)) {
      monthsMap.set(id, { id, label: monthName, groupLabel: year, type: 'month', weekIds: [] });
    }
    monthsMap.get(id)?.weekIds.push(w.id);
  });
  return Array.from(monthsMap.values());
};

const generateDays = (weeks: TimelineColumn[]): TimelineColumn[] => {
  const days: TimelineColumn[] = [];
  weeks.forEach(week => {
    const [yearStr, weekNumStr] = week.id.split('-');
    const year = parseInt(yearStr);
    const weekNum = parseInt(weekNumStr);
    const monday = getDateFromWeek(year, weekNum);
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

export const DEFAULT_START = { year: 2025, week: 44 };
export const DEFAULT_END = { year: 2026, week: 16 };

const _weeks = generateWeeks({ year: 2024, week: 1 }, { year: 2027, week: 52 });
export const ALL_WEEK_IDS = _weeks.map(w => w.id);

export const getWeekdaysForWeekId = (weekId: string): string[] => {
  const [yearStr, weekNumStr] = weekId.split('-');
  if (!yearStr || !weekNumStr) return [];
  
  const year = parseInt(yearStr);
  const weekNum = parseInt(weekNumStr);
  if (isNaN(year) || isNaN(weekNum)) return [];

  const monday = getDateFromWeek(year, weekNum);
  const weekdays: string[] = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekdays.push(formatDateForInput(date));
  }
  return weekdays;
};
