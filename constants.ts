

import { TimelineColumn, ViewMode, Holiday } from './types';

// Mock "Government Database" - Expanded for 2024-2027
export const GOV_HOLIDAYS_DB: Record<string, Omit<Holiday, 'id' | 'user_id'>[]> = {
  'HK': [
    // 2024
    { date: '2024-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2024-12-26', name: 'Boxing Day', country: 'HK' },
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'HK' },
    { date: '2025-01-29', name: 'Lunar New Year\'s Day', country: 'HK' },
    { date: '2025-01-30', name: 'Second day of Lunar New Year', country: 'HK' },
    { date: '2025-01-31', name: 'Third day of Lunar New Year', country: 'HK' },
    { date: '2025-04-04', name: 'Ching Ming Festival', country: 'HK' },
    { date: '2025-04-18', name: 'Good Friday', country: 'HK' },
    { date: '2025-04-19', name: 'The day following Good Friday', country: 'HK' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'HK' },
    { date: '2025-05-01', name: 'Labour Day', country: 'HK' },
    { date: '2025-05-05', name: 'The Birthday of the Buddha', country: 'HK' },
    { date: '2025-05-31', name: 'Tuen Ng Festival', country: 'HK' },
    { date: '2025-07-01', name: 'HKSAR Establishment Day', country: 'HK' },
    { date: '2025-10-01', name: 'National Day', country: 'HK' },
    { date: '2025-10-07', name: 'The day following Mid-Autumn Festival', country: 'HK' },
    { date: '2025-10-29', name: 'Chung Yeung Festival', country: 'HK' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2025-12-26', name: 'Boxing Day', country: 'HK' },
    // 2026
    { date: '2026-01-01', name: 'New Year\'s Day', country: 'HK' },
    { date: '2026-02-17', name: 'Lunar New Year\'s Day', country: 'HK' },
    { date: '2026-02-18', name: 'Second day of Lunar New Year', country: 'HK' },
    { date: '2026-02-19', name: 'Third day of Lunar New Year', country: 'HK' },
    { date: '2026-04-03', name: 'Good Friday', country: 'HK' },
    { date: '2026-04-04', name: 'The day following Good Friday', country: 'HK' },
    { date: '2026-04-06', name: 'Easter Monday', country: 'HK' },
    { date: '2026-04-05', name: 'Ching Ming Festival', country: 'HK' },
    { date: '2026-05-01', name: 'Labour Day', country: 'HK' },
    { date: '2026-05-25', name: 'The Birthday of the Buddha', country: 'HK' },
    { date: '2026-06-19', name: 'Tuen Ng Festival', country: 'HK' },
    { date: '2026-07-01', name: 'HKSAR Establishment Day', country: 'HK' },
    { date: '2026-09-26', name: 'The day following Mid-Autumn Festival', country: 'HK' },
    { date: '2026-10-01', name: 'National Day', country: 'HK' },
    { date: '2026-10-02', name: 'The day following National Day', country: 'HK' },
    { date: '2026-10-19', name: 'Chung Yeung Festival', country: 'HK' },
    { date: '2026-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2026-12-26', name: 'Boxing Day', country: 'HK' },
    // 2027
    { date: '2027-01-01', name: 'New Year\'s Day', country: 'HK' },
    { date: '2027-02-06', name: 'Lunar New Year\'s Day', country: 'HK' },
    { date: '2027-02-08', name: 'Second day of Lunar New Year', country: 'HK' },
    { date: '2027-02-09', name: 'Third day of Lunar New Year', country: 'HK' },
    { date: '2027-03-26', name: 'Good Friday', country: 'HK' },
    { date: '2027-03-27', name: 'The day following Good Friday', country: 'HK' },
    { date: '2027-03-29', name: 'Easter Monday', country: 'HK' },
    { date: '2027-04-05', name: 'Ching Ming Festival', country: 'HK' },
    { date: '2027-05-01', name: 'Labour Day', country: 'HK' },
    { date: '2027-05-14', name: 'The Birthday of the Buddha', country: 'HK' },
    { date: '2027-06-09', name: 'Tuen Ng Festival', country: 'HK' },
    { date: '2027-07-01', name: 'HKSAR Establishment Day', country: 'HK' },
    { date: '2027-09-16', name: 'The day following Mid-Autumn Festival', country: 'HK' },
    { date: '2027-10-01', name: 'National Day', country: 'HK' },
    { date: '2027-10-08', name: 'Chung Yeung Festival', country: 'HK' },
    { date: '2027-12-25', name: 'Christmas Day', country: 'HK' },
    { date: '2027-12-27', name: 'Boxing Day (substitute day)', country: 'HK' },
  ],
  'CN': [
    // 2024
    { date: '2024-12-30', name: 'New Year\'s Day Holiday', country: 'CN' },
    { date: '2024-12-31', name: 'New Year\'s Day Holiday', country: 'CN' },
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'CN' },
    { date: '2025-01-28', name: 'Spring Festival Holiday', country: 'CN' },
    { date: '2025-01-29', name: 'Spring Festival', country: 'CN' },
    { date: '2025-01-30', name: 'Spring Festival', country: 'CN' },
    { date: '2025-01-31', name: 'Spring Festival', country: 'CN' },
    { date: '2025-02-01', name: 'Spring Festival Holiday', country: 'CN' },
    { date: '2025-02-02', name: 'Spring Festival Holiday', country: 'CN' },
    { date: '2025-02-03', name: 'Spring Festival Holiday', country: 'CN' },
    { date: '2025-04-04', name: 'Qingming Festival', country: 'CN' },
    { date: '2025-05-01', name: 'Labour Day', country: 'CN' },
    { date: '2025-05-02', name: 'Labour Day Holiday', country: 'CN' },
    { date: '2025-05-03', name: 'Labour Day Holiday', country: 'CN' },
    { date: '2025-05-31', name: 'Dragon Boat Festival', country: 'CN' },
    { date: '2025-10-01', name: 'National Day', country: 'CN' },
    { date: '2025-10-02', name: 'National Day Holiday', country: 'CN' },
    { date: '2025-10-03', name: 'National Day Holiday', country: 'CN' },
    { date: '2025-10-04', name: 'National Day Holiday', country: 'CN' },
    { date: '2025-10-05', name: 'National Day Holiday', country: 'CN' },
    { date: '2025-10-06', name: 'Mid-Autumn Festival', country: 'CN' },
    { date: '2025-10-07', name: 'National Day Holiday', country: 'CN' },
  ],
  'MY': [
    // 2025 (Federal)
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'MY' },
    { date: '2025-01-22', name: 'Thaipusam', country: 'MY' },
    { date: '2025-01-29', name: 'Chinese New Year', country: 'MY' },
    { date: '2025-01-30', name: 'Chinese New Year (2nd day)', country: 'MY' },
    { date: '2025-03-21', name: 'Nuzul Al-Quran', country: 'MY' },
    { date: '2025-03-31', name: 'Hari Raya Aidilfitri', country: 'MY' },
    { date: '2025-04-01', name: 'Hari Raya Aidilfitri (2nd day)', country: 'MY' },
    { date: '2025-05-01', name: 'Labour Day', country: 'MY' },
    { date: '2025-05-12', name: 'Wesak Day', country: 'MY' },
    { date: '2025-06-02', name: 'King\'s Birthday', country: 'MY' },
    { date: '2025-06-07', name: 'Hari Raya Haji', country: 'MY' },
    { date: '2025-06-28', name: 'Awal Muharram', country: 'MY' },
    { date: '2025-08-31', name: 'National Day', country: 'MY' },
    { date: '2025-09-05', name: 'Prophet Muhammad\'s Birthday', country: 'MY' },
    { date: '2025-09-16', name: 'Malaysia Day', country: 'MY' },
    { date: '2025-10-20', name: 'Deepavali', country: 'MY' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'MY' },
  ],
  'SG': [
    // 2024
    { date: '2024-12-25', name: 'Christmas Day', country: 'SG' },
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'SG' },
    { date: '2025-01-29', name: 'Chinese New Year', country: 'SG' },
    { date: '2025-01-30', name: 'Chinese New Year (2nd day)', country: 'SG' },
    { date: '2025-03-31', name: 'Hari Raya Puasa', country: 'SG' },
    { date: '2025-04-18', name: 'Good Friday', country: 'SG' },
    { date: '2025-05-01', name: 'Labour Day', country: 'SG' },
    { date: '2025-05-12', name: 'Vesak Day', country: 'SG' },
    { date: '2025-06-07', name: 'Hari Raya Haji', country: 'SG' },
    { date: '2025-08-11', name: 'National Day (in lieu)', country: 'SG' },
    { date: '2025-10-20', name: 'Deepavali', country: 'SG' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'SG' },
  ],
  'US': [
    // 2024
    { date: '2024-12-25', name: 'Christmas Day', country: 'US' },
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'US' },
    { date: '2025-01-20', name: 'Martin Luther King, Jr. Day', country: 'US' },
    { date: '2025-02-17', name: 'Washington\'s Birthday', country: 'US' },
    { date: '2025-05-26', name: 'Memorial Day', country: 'US' },
    { date: '2025-06-19', name: 'Juneteenth National Independence Day', country: 'US' },
    { date: '2025-07-04', name: 'Independence Day', country: 'US' },
    { date: '2025-09-01', name: 'Labor Day', country: 'US' },
    { date: '2025-10-13', name: 'Columbus Day', country: 'US' },
    { date: '2025-11-11', name: 'Veterans Day', country: 'US' },
    { date: '2025-11-27', name: 'Thanksgiving Day', country: 'US' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'US' },
  ],
  'UK': [
    // 2024 (England/Wales)
    { date: '2024-12-25', name: 'Christmas Day', country: 'UK' },
    { date: '2024-12-26', name: 'Boxing Day', country: 'UK' },
    // 2025 (England/Wales)
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'UK' },
    { date: '2025-04-18', name: 'Good Friday', country: 'UK' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'UK' },
    { date: '2025-05-05', name: 'Early May bank holiday', country: 'UK' },
    { date: '2025-05-26', name: 'Spring bank holiday', country: 'UK' },
    { date: '2025-08-25', name: 'Summer bank holiday', country: 'UK' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'UK' },
    { date: '2025-12-26', name: 'Boxing Day', country: 'UK' },
  ],
  'CE': [
    // Germany 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'CE' },
    { date: '2025-04-18', name: 'Good Friday', country: 'CE' },
    { date: '2025-04-21', name: 'Easter Monday', country: 'CE' },
    { date: '2025-05-01', name: 'Labour Day', country: 'CE' },
    { date: '2025-05-29', name: 'Ascension Day', country: 'CE' },
    { date: '2025-06-09', name: 'Whit Monday', country: 'CE' },
    { date: '2025-10-03', name: 'German Unity Day', country: 'CE' },
    { date: '2025-12-25', name: 'Christmas Day', country: 'CE' },
    { date: '2025-12-26', name: 'Boxing Day', country: 'CE' },
    // Germany 2026
    { date: '2026-01-01', name: 'New Year\'s Day', country: 'CE' },
    { date: '2026-04-03', name: 'Good Friday', country: 'CE' },
    { date: '2026-04-06', name: 'Easter Monday', country: 'CE' },
    { date: '2026-05-01', name: 'Labour Day', country: 'CE' },
    { date: '2026-05-14', name: 'Ascension Day', country: 'CE' },
    { date: '2026-05-25', name: 'Whit Monday', country: 'CE' },
    { date: '2026-10-03', name: 'German Unity Day', country: 'CE' },
    { date: '2026-12-25', name: 'Christmas Day', country: 'CE' },
    { date: '2026-12-26', name: 'Boxing Day', country: 'CE' },
  ], 
  'LK': [] 
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
  const date = getDateFromWeek(point.year, point.week);
  date.setDate(date.getDate() + (weeksToAdd * 7));
  const weekId = getWeekIdFromDate(date);
  const [y, w] = weekId.split('-').map(Number);
  return { year: y, week: w };
};

// Helper to generate a range of weeks dynamically using strict ISO date logic
const generateWeeks = (start: WeekPoint, end: WeekPoint): TimelineColumn[] => {
  const weeks: TimelineColumn[] = [];
  
  // Convert WeekPoint to Date objects to ensure we cover the range correctly
  // Start from the Monday of the start week
  const startDate = getDateFromWeek(start.year, start.week);
  
  // End at the Monday of the end week (inclusive)
  const endDate = getDateFromWeek(end.year, end.week);
  
  let currentMonday = new Date(startDate);

  // Loop until we pass the end date
  // We add a small buffer (3 days) to endDate comparison to avoid time-of-day issues, 
  // ensuring we include the last week if we are on its Monday.
  const endCompare = new Date(endDate);
  endCompare.setDate(endCompare.getDate() + 3);

  while (currentMonday <= endCompare) {
    const weekId = getWeekIdFromDate(currentMonday);
    
    // Determine the month based on the Thursday (ISO-8601 standard)
    const thursday = new Date(currentMonday);
    thursday.setDate(currentMonday.getDate() + 3);
    
    const monthName = MONTH_NAMES[thursday.getMonth()];
    const yearForMonth = thursday.getFullYear();
    const [_, weekNumStr] = weekId.split('-');
    const weekLabel = `W${weekNumStr}`;

    weeks.push({ 
      id: weekId, 
      label: weekLabel,
      yearLabel: `${thursday.getFullYear()}`,
      monthLabel: `${monthName} ${yearForMonth}`,
      weekLabel: weekLabel,
      type: 'week'
    });
    
    // Advance by 7 days
    currentMonday.setDate(currentMonday.getDate() + 7);
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
       
       const monthName = MONTH_NAMES[date.getMonth()];
       const currentYear = date.getFullYear();
       
       days.push({
         id: `${week.id}-d${idx}`,
         label: dayName,
         yearLabel: `${currentYear}`, // Use actual year of the day
         monthLabel: `${monthName} ${currentYear}`, // Use actual month of the day
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

// Holidays Map: Key = Date String (YYYY-MM-DD), Value = Deduction (1 for full day, 0.5 for half day)
export const calculateEndDate = (startDate: string, duration: number, holidays: Map<string, number>): string => {
  if (!startDate || duration <= 0) return startDate;

  let currentDate = new Date(startDate.replace(/-/g, '/'));
  let workingDaysCounted = 0;

  // Safety break to prevent infinite loops in extreme cases
  let loopLimit = duration * 10 + 365; 
  let loopCount = 0;

  while (workingDaysCounted < duration && loopCount < loopLimit) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDateForInput(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Check holiday deduction. Default is 0 (working day). 
      // If full holiday, value is 1. If half day, value is 0.5.
      const holidayDeduction = holidays.get(dateStr) || 0;
      const capacity = Math.max(0, 1 - holidayDeduction);
      
      workingDaysCounted += capacity;
    }
    
    // Only advance if we haven't met the duration yet
    if (workingDaysCounted < duration) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    loopCount++;
  }

  return formatDateForInput(currentDate);
};

export const findNextWorkingDay = (dateStr: string, holidays: Map<string, number>): string => {
  let currentDate = new Date(dateStr.replace(/-/g, '/'));
  currentDate.setDate(currentDate.getDate() + 1); // Start from the next day

  let loopLimit = 365; 
  let loopCount = 0;

  while (loopCount < loopLimit) {
    const dayOfWeek = currentDate.getDay();
    const currentDayStr = formatDateForInput(currentDate);

    // If it's a weekday and has capacity > 0 (not a full holiday)
    const holidayDeduction = holidays.get(currentDayStr) || 0;
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && holidayDeduction < 1) {
      return currentDayStr;
    }
    currentDate.setDate(currentDate.getDate() + 1);
    loopCount++;
  }
  return dateStr; // Fallback
};

export const calculateWorkingDaysBetween = (startDateStr: string, endDateStr: string, holidays: Map<string, number>): number => {
  if (!startDateStr || !endDateStr) return 0;
  
  let currentDate = new Date(startDateStr.replace(/-/g, '/'));
  const endDate = new Date(endDateStr.replace(/-/g, '/'));
  
  if (currentDate > endDate) return 0;

  let workingDays = 0;
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDateForInput(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
       const holidayDeduction = holidays.get(dateStr) || 0;
       workingDays += Math.max(0, 1 - holidayDeduction);
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return workingDays;
};

export const calculateTimeBasedProgress = (startDateStr: string, endDateStr: string): number => {
  if (!startDateStr || !endDateStr) return 0;
  
  const now = new Date();
  // Reset time to ensure day-based comparison
  now.setHours(0, 0, 0, 0);
  
  const start = new Date(startDateStr.replace(/-/g, '/'));
  const end = new Date(endDateStr.replace(/-/g, '/'));
  
  if (now < start) return 0;
  if (now > end) return 100;
  
  const totalDuration = end.getTime() - start.getTime();
  if (totalDuration <= 0) return 100; // Single day task passed
  
  const elapsed = now.getTime() - start.getTime();
  const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  
  return Math.round(progress);
};

// Helper function for shared FP logic
export const getTaskBaseName = (name: string): string => {
  const prefixes = ["Design & Build-", "QA-", "UAT-"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return name.substring(prefix.length).trim();
    }
  }
  return name.trim();
};

export const generateAllocationRecords = (startDateStr: string, duration: number, holidays: Map<string, number>): Record<string, { count: number, days: Record<string, number> }> => {
  const result: Record<string, { count: number, days: Record<string, number> }> = {};
  if (!startDateStr || duration <= 0) return result;

  let currentDate = new Date(startDateStr.replace(/-/g, '/'));
  // Ensure we have a valid date
  if (isNaN(currentDate.getTime())) return result;

  let workingDaysCounted = 0;
  // Safety break
  let loopLimit = duration * 20 + 365; 
  let loopCount = 0;

  while (workingDaysCounted < duration && loopCount < loopLimit) {
    const dayOfWeek = currentDate.getDay();
    const dateStr = formatDateForInput(currentDate);
    const weekId = getWeekIdFromDate(currentDate);

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const holidayDeduction = holidays.get(dateStr) || 0;
      const capacity = Math.max(0, 1 - holidayDeduction);
      
      if (capacity > 0) {
          const needed = duration - workingDaysCounted;
          const take = Math.min(needed, capacity);
          
          if (take > 0) {
             if (!result[weekId]) {
                 result[weekId] = { count: 0, days: {} };
             }
             // Initialize day if needed (though we traverse sequentially so usually new)
             if (!result[weekId].days[dateStr]) {
                 result[weekId].days[dateStr] = 0;
             }
             
             result[weekId].days[dateStr] += take;
             result[weekId].count += take;
             
             workingDaysCounted += take;
          }
      }
    }
    
    // Only advance if we haven't met the duration yet
    if (workingDaysCounted < duration) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    loopCount++;
  }

  return result;
};
