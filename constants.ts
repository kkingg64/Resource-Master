import { TimelineColumn, ViewMode, Holiday } from './types';

// Mock "Government Database" - Expanded for 2024-2027
export const GOV_HOLIDAYS_DB: Record<string, Omit<Holiday, 'id'>[]> = {
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
  'CE': [], 'LK': [] // Preserving keys for TS
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
        // Group weeks into months
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
                        label: currentMonthLabel.split(' ')[0], // Jan
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
        // Push last
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
        // Day view
        const weeks = generateWeeks(start, end);
        const days: TimelineColumn[] = [];
        weeks.forEach(w => {
            const monday = w.date!; // generateWeeks sets date to Monday
            for (let i = 0; i < 5; i++) { // Mon-Fri
                const d = new Date(monday);
                d.setDate(monday.getDate() + i);
                days.push({
                    id: formatDateForInput(d),
                    label: ['S','M','T','W','T','F','S'][d.getDay()], // Should be M, T, W, T, F
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

export const calculateEndDate = (startDateStr: string, durationDays: number, holidays: Set<string>): string => {
    let currentDate = new Date(startDateStr.replace(/-/g, '/'));
    let workingDaysFound = 0;
    
    if (durationDays <= 0) return startDateStr;

    while (workingDaysFound < durationDays) {
        const dateStr = formatDateForInput(currentDate);
        const day = currentDate.getDay();
        const isWeekend = day === 0 || day === 6;
        const isHoliday = holidays.has(dateStr);
        
        if (!isWeekend && !isHoliday) {
            workingDaysFound++;
        }
        
        if (workingDaysFound < durationDays) {
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
    
    return formatDateForInput(currentDate);
};

export const calculateWorkingDaysBetween = (startStr: string, endStr: string, holidays: Set<string>): number => {
    const start = new Date(startStr.replace(/-/g, '/'));
    const end = new Date(endStr.replace(/-/g, '/'));
    
    if (start > end) return -calculateWorkingDaysBetween(endStr, startStr, holidays);
    
    let count = 0;
    let curr = new Date(start);
    while (curr <= end) {
        const day = curr.getDay();
        const dateStr = formatDateForInput(curr);
        if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
            count++;
        }
        curr.setDate(curr.getDate() + 1);
    }
    return count;
};

export const findNextWorkingDay = (dateStr: string, holidays: Set<string>): string => {
    let date = new Date(dateStr.replace(/-/g, '/'));
    date.setDate(date.getDate() + 1); // Start checking from tomorrow
    
    while (true) {
        const dStr = formatDateForInput(date);
        const day = date.getDay();
        if (day !== 0 && day !== 6 && !holidays.has(dStr)) {
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
