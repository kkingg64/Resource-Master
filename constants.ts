import { TimelineColumn, ViewMode, Holiday } from './types';

// Mock "Government Database" - Expanded for 2024-2027
export const GOV_HOLIDAYS_DB: Record<string, Omit<Holiday, 'id'>[]> = {
  'HK': [
    // 2024
    { date: '2024-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2024-12-26', name: 'Boxing Day', country: 'HK' },
    // 2025
    { date: '2025-01-01', name: 'New Year Day', country: 'HK' },
    { date: '2025-01-29', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { date: '2025-01-30', name: 'Lunar New Year (Day 2)', country: 'HK' },
    { date: '2025-01-31', name: 'Lunar New Year (Day 3)', country: 'HK' },
    { date: '2025-04-04', name: 'Ching Ming Festival', country: 'HK' },
    { date: '2025-04-18', name: 'Good Friday', country: 'HK' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'HK' },
    { date: '2025-05-01', name: 'Labour Day', country: 'HK' },
    { date: '2025-07-01', name: 'HKSAR Establishment Day', country: 'HK' },
    { date: '2025-10-01', name: 'National Day', country: 'HK' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2025-12-26', name: 'Boxing Day', country: 'HK' },
    // 2026
    { date: '2026-01-01', name: 'New Year Day', country: 'HK' },
    { date: '2026-02-17', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { date: '2026-02-18', name: 'Lunar New Year (Day 2)', country: 'HK' },
    { date: '2026-02-19', name: 'Lunar New Year (Day 3)', country: 'HK' },
    { date: '2026-04-03', name: 'Good Friday', country: 'HK' },
    { date: '2026-04-04', name: 'Holy Saturday / Ching Ming', country: 'HK' },
    { date: '2026-04-06', name: 'Easter Monday', country: 'HK' },
    { date: '2026-05-01', name: 'Labour Day', country: 'HK' },
    { date: '2026-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2026-12-26', name: 'Boxing Day', country: 'HK' },
    // 2027
    { date: '2027-01-01', name: 'New Year Day', country: 'HK' },
    { date: '2027-02-06', name: 'Lunar New Year (Day 1)', country: 'HK' },
    { date: '2027-02-07', name: 'Lunar New Year (Day 2)', country: 'HK' },
  ],
  'CN': [
    // 2025
    { date: '2025-01-01', name: 'New Year Day', country: 'CN' },
    { date: '2025-01-29', name: 'Spring Festival', country: 'CN' },
    { date: '2025-01-30', name: 'Spring Festival', country: 'CN' },
    { date: '2025-10-01', name: 'National Day', country: 'CN' },
    // 2026
    { date: '2026-01-01', name: 'New Year Day', country: 'CN' },
    { date: '2026-02-17', name: 'Spring Festival', country: 'CN' },
    { date: '2026-02-18', name: 'Spring Festival', country: 'CN' },
    { date: '2026-02-19', name: 'Spring Festival', country: 'CN' },
  ],
  'MY': [
    { date: '2025-12-25', name: 'Christmas Day', country: 'MY' },
    { date: '2026-01-01', name: 'New Year Day', country: 'MY' },
    { date: '2026-02-17', name: 'Chinese New Year', country: 'MY' },
  ],
  'SG': [
    { date: '2025-12-25', name: 'Christmas Day', country: 'SG' },
    { date: '2026-01-01', name: 'New Year Day', country: 'SG' },
    { date: '2026-02-17', name: 'Chinese New Year', country: 'SG' },
  ],
  'US': [
    { date: '2025-11-27', name: 'Thanksgiving Day', country: 'US' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'US' },
    { date: '2026-01-01', name: 'New Year Day', country: 'US' },
  ],
  'UK': [
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'UK' },
    { date: '2025-04-18', name: 'Good Friday', country: 'UK' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'UK' },
    { date: '2025-05-05', name: 'Early May bank holiday', country: 'UK' },
    { date: '2025-05-26', name: 'Spring bank holiday', country: 'UK' },
    { date: '2025-08-25', name: 'Summer bank holiday', country: 'UK' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'UK' },
    { date: '2025-12-26', name: 'Boxing Day', country: 'UK' },
    // 2026
    { date: '2026-01-01', name: 'New Year\'s Day', country: 'UK' },
    { date: '2026-04-03', name: 'Good Friday', country: 'UK' },
    { date: '2026-04-06', name: 'Easter Monday', country: 'UK' },
    { date: '2026-05-04', name: 'Early May bank holiday', country: 'UK' },
    { date: '2026-05-25', name: 'Spring bank holiday', country: 'UK' },
    { date: '2026-08-31', name: 'Summer bank holiday', country: 'UK' },
    { date: '2026-12-25', name: 'Christmas Day', country: 'UK' },
    { date: '2026-12-28', name: 'Boxing Day (substitute day)', country: 'UK' },
  ],
  'CE': [
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'CE' },
    { date: '2025-04-18', name: 'Good Friday', country: 'CE' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'CE' },
    { date: '2025-05-01', name: 'Labour Day', country: 'CE' },
    { date: '2025-05-29', name: 'Ascension Day', country: 'CE' },
    { date: '2025-06-09', name: 'Whit Monday', country: 'CE' },
    { date: '2025-10-03', name: 'Day of German Unity', country: 'CE' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'CE' },
    { date: '2025-12-26', name: 'St. Stephen\'s Day', country: 'CE' },
    // 2026
    { date: '2026-01-01', name: 'New Year\'s Day', country: 'CE' },
    { date: '2026-04-03', name: 'Good Friday', country: 'CE' },
    { date: '2026-04-06', name: 'Easter Monday', country: 'CE' },
    { date: '2026-05-01', name: 'Labour Day', country: 'CE' },
    { date: '2026-05-14', name: 'Ascension Day', country: 'CE' },
    { date: '2026-05-25', name: 'Whit Monday', country: 'CE' },
    { date: '2026-10-03', name: 'Day of German Unity', country: 'CE' },
    { date: '2026-12-25', name: 'Christmas Day', country: 'CE' },
    { date: '2026-12-26', name: 'St. Stephen\'s Day', country: 'CE' },
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
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    const weekLabel = `W${paddedWeek}`;

    weeks.push({ 
      id: `${current.year}-${paddedWeek}`, 
      label: weekLabel,
      yearLabel: `${current.year}`,
      monthLabel: `${monthName} ${current.year}`,
      weekLabel: weekLabel,
      type: 'week'
    });
    current = addWeeksToPoint(current, 1);
  }
  return weeks;
};

const generateMonths = (weeks: TimelineColumn[]): TimelineColumn[] => {
  const monthsMap = new Map<string, TimelineColumn & { weekIds: string[] }>();
  weeks.forEach(w => {
    const [monthName, year] = w.monthLabel.split(' ');
    const id = `${year}-${MONTH_NAMES.indexOf(monthName) + 1}`;
    if (!monthsMap.has(id)) {
      monthsMap.set(id, { id, label: monthName, yearLabel: year, monthLabel: w.monthLabel, weekLabel: '', type: 'month', weekIds: [] });
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
         yearLabel: week.yearLabel,
         monthLabel: week.monthLabel,
         weekLabel: week.weekLabel,
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

export const calculateEndDate = (startDate: string, duration: number, holidays: Set<string>): string => {
  if (!startDate || duration <= 0) return startDate;

  let currentDate = new Date(startDate.replace(/-/g, '/'));
  let workingDaysCounted = 0;

  while (workingDaysCounted < duration) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDateForInput(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      workingDaysCounted++;
    }
    
    if (workingDaysCounted < duration) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  return formatDateForInput(currentDate);
};

export const findNextWorkingDay = (dateStr: string, holidays: Set<string>): string => {
  let currentDate = new Date(dateStr.replace(/-/g, '/'));
  currentDate.setDate(currentDate.getDate() + 1); // Start from the next day

  while (true) {
    const dayOfWeek = currentDate.getDay();
    const currentDayStr = formatDateForInput(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(currentDayStr)) {
      return currentDayStr;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
};