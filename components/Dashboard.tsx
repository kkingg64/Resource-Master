import React, { useMemo } from 'react';
import { Project, Role, WeeklySummary, ResourceAllocation, Resource, Holiday } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { getTimeline, DEFAULT_START, DEFAULT_END, calculateWorkingDaysBetween, formatDateForInput, getWeekIdFromDate, getWeekdaysForWeekId, calculateEndDate } from '../constants';
import { AlertCircle, CheckCircle2, Clock, Users, Briefcase, ChevronRight, AlertTriangle, AlertOctagon, CalendarDays, Activity, CalendarOff, ArrowRight } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  resources: Resource[];
  holidays: Holiday[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Dashboard: React.FC<DashboardProps> = ({ projects, resources, holidays }) => {
  
  const GLOBAL_TIMELINE_DATA = useMemo(() => getTimeline('week', DEFAULT_START, DEFAULT_END), []);
  const today = new Date();
  const todayStr = formatDateForInput(today);
  const currentWeekId = getWeekIdFromDate(today);

  // 1. Calculate General Stats
  const stats = useMemo(() => {
    let totalFP = 0;
    let totalFeFP = 0;
    let totalBeFP = 0;
    let totalAllocatedDays = 0;
    let unassignedCount = 0;
    const unassignedTasks: { projectName: string, moduleName: string, taskName: string }[] = [];

    projects.forEach(p => {
        p.modules.forEach(m => {
            totalFP += m.functionPoints || 0;
            totalFeFP += m.frontendFunctionPoints || 0;
            totalBeFP += m.backendFunctionPoints || 0;
            
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    const isUnassigned = !a.resourceName || a.resourceName === 'Unassigned';
                    if (isUnassigned) {
                        unassignedCount++;
                        unassignedTasks.push({
                            projectName: p.name,
                            moduleName: m.name,
                            taskName: t.name
                        });
                    }
                    a.allocations.forEach(alloc => {
                        totalAllocatedDays += alloc.count;
                    });
                });
            });
        });
    });

    return { totalFP, totalFeFP, totalBeFP, totalAllocatedDays, unassignedCount, unassignedTasks };
  }, [projects]);

  // 2. Resource Utilization Logic
  const resourceUtilization = useMemo(() => {
    const usage: Record<string, number> = {};
    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (a.resourceName && a.resourceName !== 'Unassigned') {
                        a.allocations.forEach(alloc => {
                            usage[a.resourceName!] = (usage[a.resourceName!] || 0) + alloc.count;
                        });
                    }
                });
            });
        });
    });

    return Object.entries(usage)
        .map(([name, days]) => ({ name, days }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5); // Top 5
  }, [projects]);

  // 3. Project Progress Logic
  const projectProgress = useMemo(() => {
    return projects.map(p => {
        let start: string | null = null;
        let end: string | null = null;

        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (a.startDate) {
                        if (!start || a.startDate < start) start = a.startDate;
                        // Rough estimation of end date based on start + duration
                        if (a.duration) {
                            const d = new Date(a.startDate);
                            d.setDate(d.getDate() + (a.duration * 1.4)); // approx working days to calendar days
                            const eStr = formatDateForInput(d);
                            if (!end || eStr > end) end = eStr;
                        }
                    }
                });
            });
        });

        if (!start || !end) return { id: p.id, name: p.name, progress: 0, status: 'Not Started', start: '-', end: '-' };

        const totalDuration = new Date(end).getTime() - new Date(start).getTime();
        const elapsed = today.getTime() - new Date(start).getTime();
        let progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        
        // Status logic
        let status = 'In Progress';
        if (progress === 0 && new Date(start) > today) status = 'Upcoming';
        if (progress === 100) status = 'Completed';

        return { 
            id: p.id, 
            name: p.name, 
            progress, 
            status,
            start,
            end
        };
    });
  }, [projects, today]);

  // 4. Chart Data Aggregation
  const chartData = useMemo(() => {
    return GLOBAL_TIMELINE_DATA.map(week => {
      const [month] = week.monthLabel.split(' ');
      const summary: any = {
        name: `${week.label} (${month})`,
        [Role.DEV]: 0,
        [Role.BA]: 0,
        [Role.APP_SUPPORT]: 0,
        [Role.BRAND_SOLUTIONS]: 0,
        [Role.PREP_DEV]: 0,
        total: 0
      };

      projects.forEach(proj => {
        proj.modules.forEach(mod => {
          mod.tasks.forEach(task => {
            task.assignments.forEach(assignment => {
              const role = assignment.role;
              assignment.allocations.forEach(alloc => {
                if (alloc.weekId === week.id) {
                  if (summary[role as keyof typeof summary] !== undefined) {
                    (summary[role as keyof typeof summary] as number) += alloc.count;
                  }
                  summary.total += alloc.count;
                }
              });
            });
          });
        });
      });
      return summary;
    });
  }, [projects, GLOBAL_TIMELINE_DATA]);

  // 5. Conflict Detection (Grouped by Resource)
  const conflictsByResource = useMemo((): Record<string, { weekId: string, total: number, modules: string[] }[]> => {
    type UsageData = { total: number, modules: Set<string> };
    const usage: Record<string, Record<string, UsageData>> = {};
    
    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (a.resourceName && a.resourceName !== 'Unassigned') {
                        a.allocations.forEach(alloc => {
                            if (!usage[a.resourceName!]) usage[a.resourceName!] = {};
                            if (!usage[a.resourceName!][alloc.weekId]) usage[a.resourceName!][alloc.weekId] = { total: 0, modules: new Set<string>() };
                            
                            usage[a.resourceName!][alloc.weekId].total += alloc.count;
                            usage[a.resourceName!][alloc.weekId].modules.add(`${p.name} • ${m.name}`);
                        });
                    }
                });
            });
        });
    });

    const result: Record<string, { weekId: string, total: number, modules: string[] }[]> = {};
    
    Object.entries(usage).forEach(([res, weeks]) => {
        Object.entries(weeks).forEach(([weekId, data]) => {
            const d = data as UsageData;
            // Conflict if allocated more than 5 days OR works on multiple modules
            if (d.modules.size > 1 || d.total > 5) {
                if (!result[res]) result[res] = [];
                result[res].push({
                    weekId,
                    total: d.total,
                    modules: Array.from(d.modules)
                });
            }
        });
    });
    
    // Sort weeks for each resource
    Object.keys(result).forEach(res => {
        result[res].sort((a, b) => a.weekId.localeCompare(b.weekId));
    });
    
    return result;
  }, [projects]);

  // 6. Weekly Pulse (Daily Activity) - Grouped by Task
  const weeklyPulse = useMemo(() => {
    const weekDates = getWeekdaysForWeekId(currentWeekId);
    
    // Structure: Date -> TaskID -> { task, module, resources Set }
    type DailyGroupItem = { task: string, module: string, resources: Set<string> };
    const dailyGroups: Record<string, Map<string, DailyGroupItem>> = {};
    
    weekDates.forEach(d => dailyGroups[d] = new Map());

    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (!a.resourceName || a.resourceName === 'Unassigned') return;
                    
                    const alloc = a.allocations.find(al => al.weekId === currentWeekId);
                    if (alloc) {
                        const addToDay = (date: string) => {
                            if (!dailyGroups[date]) return;
                            const dayMap = dailyGroups[date];
                            if (!dayMap.has(t.id)) {
                                dayMap.set(t.id, { task: t.name, module: m.name, resources: new Set<string>() });
                            }
                            dayMap.get(t.id)!.resources.add(a.resourceName!);
                        };

                        if (alloc.days && Object.keys(alloc.days).length > 0) {
                            Object.entries(alloc.days).forEach(([date, count]) => {
                                if (count > 0) addToDay(date);
                            });
                        } else if (alloc.count > 0) {
                            weekDates.forEach(date => addToDay(date));
                        }
                    }
                });
            });
        });
    });

    const activityByDay: Record<string, { task: string, module: string, resources: string[] }[]> = {};
    weekDates.forEach(d => {
        const values = Array.from(dailyGroups[d].values()) as DailyGroupItem[];
        activityByDay[d] = values.map((item) => ({
            task: item.task,
            module: item.module,
            resources: Array.from(item.resources).sort()
        }));
    });

    return { dates: weekDates, activity: activityByDay };
  }, [projects, currentWeekId]);

  // 7. Leaves Calculation
  const todayLeaves = useMemo(() => {
    const todayDate = new Date();
    const todayStr = formatDateForInput(todayDate);
    
    const onLeave: { resource: string, reason: string, type: 'Public' | 'Personal' }[] = [];

    resources.forEach(r => {
        // Public Holiday Check
        const region = r.holiday_region || 'HK'; // Defaulting to HK logic as per other components
        const regionalHolidays = holidays.filter(h => h.country === region);
        const publicHol = regionalHolidays.find(h => h.date === todayStr);
        
        if (publicHol) {
            onLeave.push({ resource: r.name, reason: publicHol.name, type: 'Public' });
            return;
        }

        // Individual Holiday Check
        const personalHol = r.individual_holidays?.find(h => h.date === todayStr);
        if (personalHol) {
            onLeave.push({ resource: r.name, reason: personalHol.name, type: 'Personal' });
        }
    });

    return onLeave;
  }, [resources, holidays]);

  // 8. Upcoming Tasks Logic (Next 2 Weeks) - Grouped by Task
  const upcomingTasks = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayStr = formatDateForInput(todayDate);
    
    const twoWeeksLater = new Date();
    twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    const twoWeeksLaterStr = formatDateForInput(twoWeeksLater);

    // Build efficient holiday map for end date calculation
    const resourceHolidaysMap = new Map<string, Map<string, number>>();
    const defaultHolidays = new Map<string, number>();
    holidays.filter(h => h.country === 'HK').forEach(h => defaultHolidays.set(h.date, h.duration || 1));
    resourceHolidaysMap.set('Unassigned', defaultHolidays);
    resources.forEach(res => {
      const regional = holidays.filter(h => h.country === (res.holiday_region || 'HK'));
      const individual = res.individual_holidays || [];
      const map = new Map<string, number>();
      regional.forEach(h => map.set(h.date, h.duration || 1));
      individual.forEach(h => map.set(h.date, h.duration || 1));
      resourceHolidaysMap.set(res.name, map);
    });

    const tasks: any[] = [];

    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                let earliestStart: string | null = null;
                let latestEnd: string | null = null;
                let totalProgress = 0;
                let assignmentCount = 0;
                let isRelevant = false;

                t.assignments.forEach(a => {
                    if (a.startDate && a.duration && a.duration > 0) {
                        const start = a.startDate;
                        const resourceName = a.resourceName || 'Unassigned';
                        const holidayMap = resourceHolidaysMap.get(resourceName) || defaultHolidays;
                        const end = calculateEndDate(start, a.duration, holidayMap);

                        // Logic: 
                        // 1. Starts between today and 2 weeks
                        // 2. OR is currently active (Started before today, Ends after today)
                        
                        const isStartingSoon = start >= todayStr && start <= twoWeeksLaterStr;
                        const isActive = start < todayStr && end >= todayStr;

                        if (isStartingSoon || isActive) {
                            isRelevant = true;
                        }

                        // Aggregate dates for the task
                        if (!earliestStart || start < earliestStart) earliestStart = start;
                        if (!latestEnd || end > latestEnd) latestEnd = end;
                        
                        totalProgress += (a.progress || 0);
                        assignmentCount++;
                    }
                });

                // If task has assignments relevant to the timeline window
                if (isRelevant && earliestStart && latestEnd) {
                    const avgProgress = assignmentCount > 0 ? Math.round(totalProgress / assignmentCount) : 0;
                    const isActive = earliestStart < todayStr && latestEnd >= todayStr;

                    tasks.push({
                        id: t.id,
                        project: p.name,
                        module: m.name,
                        task: t.name,
                        start: earliestStart,
                        end: latestEnd,
                        progress: avgProgress,
                        status: isActive ? 'Active' : 'Upcoming',
                        startObj: new Date(earliestStart) // for sorting
                    });
                }
            });
        });
    });

    return tasks.sort((a, b) => a.startObj.getTime() - b.startObj.getTime());
  }, [projects, resources, holidays]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      
      {/* Top Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Briefcase size={64} /></div>
            <div>
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Effort</h3>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-bold text-slate-800">{stats.totalAllocatedDays.toFixed(0)}</p>
                    <span className="text-xs text-slate-400">man-days</span>
                </div>
            </div>
            <div className="mt-4 text-xs text-indigo-600 font-medium bg-indigo-50 inline-block px-2 py-1 rounded w-fit">
                across {projects.length} projects
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><AlertCircle size={64} className={stats.unassignedCount > 0 ? "text-red-500" : "text-green-500"} /></div>
             <div>
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Unassigned Tasks</h3>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className={`text-2xl font-bold ${stats.unassignedCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.unassignedCount}</p>
                    <span className="text-xs text-slate-400">items</span>
                </div>
            </div>
             <div className={`mt-4 text-xs font-medium px-2 py-1 rounded w-fit ${stats.unassignedCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {stats.unassignedCount > 0 ? 'Action Required' : 'Fully Staffed'}
            </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={64} /></div>
            <div>
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Resources</h3>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-bold text-slate-800">{resourceUtilization.length}</p>
                    <span className="text-xs text-slate-400">people loaded</span>
                </div>
            </div>
            <div className="mt-4 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit">
               Top: {resourceUtilization[0]?.name || 'None'}
            </div>
        </div>

         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={64} /></div>
             <div>
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Confirmed Scope</h3>
                <div className="flex items-baseline gap-1 mt-1">
                    <p className="text-2xl font-bold text-slate-800">{stats.totalFP}</p>
                    <span className="text-xs text-slate-400">Total FP</span>
                </div>
            </div>
             <div className="mt-4 flex gap-2">
                 <div className="text-xs font-medium bg-blue-50 text-blue-700 px-2 py-1 rounded w-fit flex items-center gap-1" title="Frontend Function Points">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> FE: {stats.totalFeFP}
                </div>
                 <div className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded w-fit flex items-center gap-1" title="Backend Function Points">
                     <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> BE: {stats.totalBeFP}
                </div>
            </div>
        </div>
      </div>

      {/* NEW: Upcoming Tasks Section (Moved above Weekly Pulse) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <ArrowRight size={18} className="text-indigo-600" />
                Upcoming Task Timeline (Next 2 Weeks)
            </h3>
            <span className="text-xs text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded">Sorted by Start Date</span>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-3 w-1/3">Task</th>
                        <th className="px-6 py-3 w-1/4">Context</th>
                        <th className="px-6 py-3 w-24">Status</th>
                        <th className="px-6 py-3 w-48">Schedule</th>
                        <th className="px-6 py-3">Progress</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {upcomingTasks.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-400">
                                No tasks starting or active in the next 2 weeks.
                            </td>
                        </tr>
                    ) : (
                        upcomingTasks.map((t) => (
                            <tr key={`${t.id}`} className="hover:bg-slate-50 group">
                                <td className="px-6 py-3 font-medium text-slate-700">
                                    {t.task}
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-slate-600">{t.module}</span>
                                        <span className="text-[10px] text-slate-400">{t.project}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${t.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                                        {t.status}
                                    </span>
                                </td>
                                <td className="px-6 py-3 font-mono text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <span>{new Date(t.start).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                        <ArrowRight size={10} className="text-slate-300" />
                                        <span>{new Date(t.end).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden w-24">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${t.progress}%` }}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 w-8 text-right">{t.progress}%</span>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Weekly Pulse Section (Grouped by Task) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 overflow-hidden">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2">
            <Activity className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Weekly Pulse</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{currentWeekId}</span>
        </div>
        <div className="grid grid-cols-5 gap-4">
            {weeklyPulse.dates.map((date, idx) => {
                const isToday = date === todayStr;
                const items = weeklyPulse.activity[date] || [];
                const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = new Date(date).getDate();

                return (
                    <div key={date} className={`flex flex-col rounded-xl border transition-all duration-300 ${isToday ? 'bg-white border-indigo-200 ring-2 ring-indigo-500/20 shadow-lg scale-[1.02] z-10' : 'bg-slate-50 border-slate-200 opacity-90'}`}>
                        <div className={`p-2 border-b flex justify-between items-center ${isToday ? 'bg-indigo-50 border-indigo-100' : 'border-slate-100'}`}>
                            <span className={`text-xs font-bold uppercase ${isToday ? 'text-indigo-700' : 'text-slate-500'}`}>{dayName}</span>
                            <span className={`text-xs font-bold ${isToday ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'} px-1.5 rounded`}>{dayNum}</span>
                        </div>
                        <div className="p-2 space-y-2 min-h-[120px] max-h-[200px] overflow-y-auto custom-scrollbar">
                            {items.length === 0 ? (
                                <div className="text-[10px] text-slate-400 text-center mt-4 italic">No active tasks</div>
                            ) : (
                                items.map((item, i) => (
                                    <div key={`${item.task}-${i}`} className="bg-white p-2 rounded shadow-sm border border-slate-100 text-xs group hover:border-indigo-300 transition-colors">
                                        <div className="font-medium text-slate-700 truncate mb-0.5" title={item.task}>{item.task}</div>
                                        <div className="text-[9px] text-indigo-400 mb-1.5 truncate">{item.module}</div>
                                        
                                        <div className="flex flex-wrap gap-1">
                                            {item.resources.map((res, ridx) => (
                                                <span key={ridx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600 border border-slate-200" title={res}>
                                                    {res}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        {isToday && (
                            <div className="bg-indigo-50 text-[10px] text-indigo-600 text-center py-1 font-bold border-t border-indigo-100 rounded-b-xl">
                                TODAY
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Project Status List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Project Timeline Status</h3>
                <span className="text-xs text-slate-400">Based on Task Dates</span>
            </div>
            <div className="flex-1 overflow-auto max-h-80 custom-scrollbar">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3">Project</th>
                            <th className="px-6 py-3 w-1/3">Timeline</th>
                            <th className="px-6 py-3 text-right">Progress</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {projectProgress.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-slate-700">
                                    {p.name}
                                    <div className="text-xs text-slate-400 font-normal mt-0.5">{p.status}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                        <span>{p.start !== '-' ? new Date(p.start!).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}</span>
                                        <span>{p.end !== '-' ? new Date(p.end!).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : ''}</span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ${p.progress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} 
                                            style={{ width: `${p.progress}%` }}
                                        ></div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-600">
                                    {p.progress.toFixed(0)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Right Column: Leaves & Unassigned */}
        <div className="flex flex-col gap-6">
             {/* Today's Leaves */}
             <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col max-h-80">
                 <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <CalendarOff size={16} className="text-orange-500" />
                        On Leave Today
                    </h3>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-0">
                    {todayLeaves.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 min-h-[150px]">
                            <CheckCircle2 size={32} className="text-green-500 mb-2" />
                            <p className="text-sm">Full Team Attendance</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {todayLeaves.map((l, idx) => (
                                <li key={idx} className="px-6 py-3 hover:bg-slate-50 flex items-center justify-between">
                                    <span className="text-sm font-medium text-slate-700">{l.resource}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${l.type === 'Public' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {l.reason}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
             </div>

             {/* Unassigned Tasks / Alerts */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:h-auto min-h-[200px]">
                 <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        Unassigned Work
                    </h3>
                </div>
                <div className="flex-1 overflow-auto custom-scrollbar p-0">
                    {stats.unassignedTasks.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                            <CheckCircle2 size={32} className="text-green-500 mb-2" />
                            <p className="text-sm">All tasks assigned!</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-100">
                            {stats.unassignedTasks.map((t, idx) => (
                                <li key={idx} className="px-6 py-3 hover:bg-slate-50 flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-slate-700">{t.taskName}</span>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{t.projectName}</span>
                                        <ChevronRight size={10} />
                                        <span>{t.moduleName}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
      </div>

      {/* Resource Conflict & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Conflict Detection Card (Grouped by Resource) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-80">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertOctagon size={16} className="text-red-500" />
                    Resource Overlap/Conflicts
                </h3>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                 {Object.keys(conflictsByResource).length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <CheckCircle2 size={32} className="text-green-500 mb-2" />
                        <p className="text-sm">No cross-module conflicts detected.</p>
                    </div>
                 ) : (
                     <div className="divide-y divide-slate-100">
                        {Object.entries(conflictsByResource).map(([resource, weeks]) => (
                            <div key={resource} className="bg-white p-0">
                                <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                    <span className="font-bold text-sm text-slate-700">{resource}</span>
                                    <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">{weeks.length} Weeks</span>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <tbody className="divide-y divide-slate-50">
                                        {weeks.map((c, idx) => (
                                            <tr key={`${resource}-${c.weekId}`} className="hover:bg-red-50/20">
                                                <td className="px-4 py-2 w-24 font-mono text-xs text-slate-500 border-r border-slate-50">{c.weekId}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col gap-1">
                                                        {c.modules.map(m => (
                                                            <span key={m} className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded w-fit truncate max-w-[200px]" title={m}>{m}</span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <span className={`font-bold text-xs ${c.total > 5 ? 'text-red-600' : 'text-orange-600'}`}>{c.total.toFixed(1)}d</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                     </div>
                 )}
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Resource Allocation by Role</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
              <Bar dataKey={Role.DEV} stackId="a" fill="#4f46e5" name="Dev Team" radius={[0, 0, 4, 4]} />
              <Bar dataKey={Role.PREP_DEV} stackId="a" fill="#14b8a6" name="Prep & Dev" />
              <Bar dataKey={Role.BA} stackId="a" fill="#8b5cf6" name="BA" />
              <Bar dataKey={Role.APP_SUPPORT} stackId="a" fill="#ef4444" name="App Support" />
              <Bar dataKey={Role.BRAND_SOLUTIONS} stackId="a" fill="#f97316" name="Brand Solutions" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};