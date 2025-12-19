
import { TimelineColumn, ViewMode, Holiday } from './types';

// Mock "Government Database" - Expanded for 2024-2027
export const GOV_HOLIDAYS_DB: Record<string, Omit<Holiday, 'id'>[]> = {
  'HK': [
    // 2024
    { date: '2024-12-25', name: 'Christmas Day', country: 'HK', duration: 1.0 },
    { date: '2024-12-26', name: 'Boxing Day', country: 'HK', duration: 1.0 },
    // 2025
    { date: '2025-01-01', name: 'New Year\'s Day', country: 'HK', duration: 1.0 },
    { date: '2025-01-29', name: 'Lunar New Year\'s Day', country: 'HK', duration: 1.0 },
    { date: '2025-01-30', name: 'Second day of Lunar New Year', country: 'HK', duration: 1.0 },
    { date: '2025-01-31', name: 'Third day of Lunar New Year', country: 'HK', duration: 1.0 },
    { date: '2025-04-04', name: 'Ching Ming Festival', country: 'HK', duration: 1.0 },
    { date: '2025-04-18', name: 'Good Friday', country: 'HK', duration: 1.0 },
    { date: '2025-04-19', name: 'The day following Good Friday', country: 'HK', duration: 1.0 },
    { date: '2025-04-21', name: 'Easter Monday', country: 'HK', duration: 1.0 },
    { date: '2025-05-01', name: 'Labour Day', country: 'HK', duration: 1.0 },
    { date: '2025-05-05', name: 'The Birthday of the Buddha', country: 'HK', duration: 1.0 },
    { date: '2025-05-31', name: 'Tuen Ng Festival', country: 'HK', duration: 1.0 },
    { date: '2025-07-01', name: 'HKSAR Establishment Day', country: 'HK', duration: 1.0 },
    { date: '2025-10-01', name: 'National Day', country: 'HK', duration: 1.0 },
    { date: '2025-10-07', name: 'The day following Mid-Autumn Festival', country: 'HK', duration: 1.0 },
    { date: '2025-10-29', name: 'Chung Yeung Festival', country: 'HK', duration: 1.0 },
    { date: '2025-12-25', name: 'Christmas Day', country: 'HK', duration: 1.0 },
    { date: '2025-12-26', name: 'Boxing Day', country: 'HK', duration: 1.0 },
  ],
  // ... other countries would follow same pattern, defaulting to 1.0 implicitly if handled by map creation
  'CN': [], 'MY': [], 'SG': [], 'US': [], 'UK': [], 'CE': [], 'LK': [] 
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
    const weekId = `${current.year}-${paddedWeek}`;
    
    // Get the Monday of the week
    const monday = getDateFromWeek(current.year, current.week);
    const monthName = MONTH_NAMES[monday.getMonth()];
    
    weeks.push({
        id: weekId,
        label: `Wk ${current.week}`,
        yearLabel: current.year.toString(),
        monthLabel: `${monthName} ${current.year}`,
        weekLabel: `Wk ${current.week}`,
        type: 'week',
        date: monday
    });

    // Increment week
    current = addWeeksToPoint(current, 1);
  }
  return weeks;
};

export const DEFAULT_START: WeekPoint = { year: 2025, week: 1 };
export const DEFAULT_END: WeekPoint = { year: 2025, week: 52 };

export const getTimeline = (viewMode: ViewMode, start: WeekPoint, end: WeekPoint): TimelineColumn[] => {
    if (viewMode === 'week') {
        return generateWeeks(start, end);
    } else if (viewMode === 'month') {
        const weeks = generateWeeks(start, end);
        const months: TimelineColumn[] = [];
        let currentMonthLabel = '';
        let currentMonthWeeks: string[] = [];
        let currentMonthDate: Date | undefined;
        let yearLabel = '';
        
        weeks.forEach((week) => {
            const mLabel = week.monthLabel;
            if (mLabel !== currentMonthLabel) {
                if (currentMonthLabel) {
                    months.push({
                        id: currentMonthLabel,
                        label: currentMonthLabel.split(' ')[0], 
                        monthLabel: currentMonthLabel,
                        yearLabel: yearLabel,
                        weekLabel: '',
                        type: 'month',
                        weekIds: currentMonthWeeks,
                        date: currentMonthDate
                    });
                }
                currentMonthLabel = mLabel;
                currentMonthWeeks = [];
                currentMonthDate = week.date;
                yearLabel = week.yearLabel;
            }
            currentMonthWeeks.push(week.id);
        });
        if (currentMonthLabel) {
             months.push({
                id: currentMonthLabel,
                label: currentMonthLabel.split(' ')[0],
                monthLabel: currentMonthLabel,
                yearLabel: yearLabel,
                weekLabel: '',
                type: 'month',
                weekIds: currentMonthWeeks,
                date: currentMonthDate
            });
        }
        return months;
    } else {
        const weeks = generateWeeks(start, end);
        const days: TimelineColumn[] = [];
        weeks.forEach(w => {
            const monday = w.date!; 
            for (let i = 0; i < 5; i++) { // Mon-Fri
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                days.push({
                    id: formatDateForInput(d),
                    label: ['S','M','T','W','T','F','S'][d.getDay()],
                    yearLabel: w.yearLabel,
                    monthLabel: w.monthLabel,
                    weekLabel: w.label,
                    type: 'day',
                    date: d,
                    parentWeekId: w.id
                });
            }
        });
        return days;
    }
};

/**
 * Calculates end date considering holidays with duration (1.0 = full day, 0.5 = half day)
 * @param holidays Map of date string YYYY-MM-DD to duration (0-1)
 */
export const calculateEndDate = (startDateStr: string, durationDays: number, holidays: Map<string, number>): string => {
    let currentDate = new Date(startDateStr.replace(/-/g, '/'));
    let workingDaysFound = 0;
    
    if (durationDays <= 0) return startDateStr;

    // Safety break to prevent infinite loops if something is wrong
    let loops = 0;
    const MAX_LOOPS = 365 * 5; 

    while (workingDaysFound < durationDays && loops < MAX_LOOPS) {
        const dateStr = formatDateForInput(currentDate);
        const day = currentDate.getDay();
        const isWeekend = day === 0 || day === 6;
        
        if (!isWeekend) {
            const holidayDuration = holidays.get(dateStr) || 0;
            // Available capacity on this day: 1 - holidayDuration
            // e.g. Full holiday (1.0) -> capacity 0
            // Half holiday (0.5) -> capacity 0.5
            const dailyCapacity = 1 - holidayDuration;
            
            if (dailyCapacity > 0) {
                // If we need less than what's available today, we are done
                // But for simplicity in this model, we treat partial days as contributing 0.5 to the sum.
                // We advance full calendar days until the sum of capacity meets duration.
                workingDaysFound += dailyCapacity;
            }
        }
        
        // If we haven't reached the required duration, move to next day
        // Note: For partial days, if we are at 4.5 and need 5, and today gave us 0.5, we are now at 5.0. Loop ends.
        if (workingDaysFound < durationDays) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
        loops++;
    }
    
    return formatDateForInput(currentDate);
};

export const calculateWorkingDaysBetween = (startStr: string, endStr: string, holidays: Map<string, number>): number => {
    const start = new Date(startStr.replace(/-/g, '/'));
    const end = new Date(endStr.replace(/-/g, '/'));
    
    if (start > end) return -calculateWorkingDaysBetween(endStr, startStr, holidays);
    
    let count = 0;
    let curr = new Date(start);
    while (curr <= end) {
        const day = curr.getDay();
        const dateStr = formatDateForInput(curr);
        if (day !== 0 && day !== 6) {
            const holidayDuration = holidays.get(dateStr) || 0;
            count += (1 - holidayDuration);
        }
        curr.setDate(curr.getDate() + 1);
    }
    return count;
};

export const findNextWorkingDay = (dateStr: string, holidays: Map<string, number>): string => {
    let date = new Date(dateStr.replace(/-/g, '/'));
    date.setDate(date.getDate() + 1); // Start checking from tomorrow
    
    while (true) {
        const dStr = formatDateForInput(date);
        const day = date.getDay();
        const holidayDuration = holidays.get(dStr) || 0;
        
        // Consider it a working day if it's not weekend AND not a full holiday
        if (day !== 0 && day !== 6 && holidayDuration < 1.0) {
            return dStr;
        }
        date.setDate(date.getDate() + 1);
    }
};

export const getWeekdaysForWeekId = (weekId: string): string[] => {
  const [year, week] = weekId.split('-').map(Number);
  const monday = getDateFromWeek(year, week);
  const days = [];
  for (let i = 0; i < 5; i++) { // Mon-Fri
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(formatDateForInput(d));
  }
  return days;
};

export const getTaskBaseName = (name: string): string => {
  const prefixes = ["Design & Build-", "QA-", "UAT-"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return name.substring(prefix.length).trim();
    }
  }
  return name.trim();
};
