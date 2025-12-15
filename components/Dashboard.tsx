
import React, { useMemo } from 'react';
import { Project, Role, WeeklySummary, ResourceAllocation } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { getTimeline, DEFAULT_START, DEFAULT_END, calculateWorkingDaysBetween, formatDateForInput, getWeekIdFromDate, getWeekdaysForWeekId } from '../constants';
import { AlertCircle, CheckCircle2, Clock, Users, Briefcase, ChevronRight, AlertTriangle, AlertOctagon, CalendarDays, Activity } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Dashboard: React.FC<DashboardProps> = ({ projects }) => {
  
  const GLOBAL_TIMELINE_DATA = useMemo(() => getTimeline('week', DEFAULT_START, DEFAULT_END), []);
  const today = new Date();
  const todayStr = formatDateForInput(today);
  const currentWeekId = getWeekIdFromDate(today);

  // 1. Calculate General Stats
  const stats = useMemo(() => {
    let totalFP = 0;
    let totalAllocatedDays = 0;
    let unassignedCount = 0;
    const unassignedTasks: { projectName: string, moduleName: string, taskName: string }[] = [];

    projects.forEach(p => {
        p.modules.forEach(m => {
            totalFP += m.functionPoints;
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

    return { totalFP, totalAllocatedDays, unassignedCount, unassignedTasks };
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

  // 5. Conflict Detection
  const conflicts = useMemo(() => {
    const usage: Record<string, Record<string, { total: number, modules: Set<string> }>> = {};
    
    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (a.resourceName && a.resourceName !== 'Unassigned') {
                        a.allocations.forEach(alloc => {
                            if (!usage[a.resourceName!]) usage[a.resourceName!] = {};
                            if (!usage[a.resourceName!][alloc.weekId]) usage[a.resourceName!][alloc.weekId] = { total: 0, modules: new Set() };
                            
                            usage[a.resourceName!][alloc.weekId].total += alloc.count;
                            usage[a.resourceName!][alloc.weekId].modules.add(`${p.name} • ${m.name}`);
                        });
                    }
                });
            });
        });
    });

    const result: { resource: string, weekId: string, total: number, modules: string[] }[] = [];
    Object.entries(usage).forEach(([res, weeks]) => {
        Object.entries(weeks).forEach(([weekId, data]) => {
            // Conflict if allocated more than 5 days OR works on multiple modules
            if (data.modules.size > 1) {
                result.push({ 
                    resource: res, 
                    weekId, 
                    total: data.total, 
                    modules: Array.from(data.modules) 
                });
            }
        });
    });
    
    return result.sort((a,b) => a.weekId.localeCompare(b.weekId));
  }, [projects]);

  // 6. Weekly Pulse (Daily Activity)
  const weeklyPulse = useMemo(() => {
    const weekDates = getWeekdaysForWeekId(currentWeekId);
    const activityByDay: Record<string, { id: string, resource: string, task: string, module: string, role: string }[]> = {};
    
    weekDates.forEach(d => activityByDay[d] = []);

    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    if (!a.resourceName || a.resourceName === 'Unassigned') return;
                    
                    const alloc = a.allocations.find(al => al.weekId === currentWeekId);
                    if (alloc) {
                        // If days breakdown exists, use it. Otherwise assume roughly even distribution if full week count > 0
                        // For visualization accuracy, we rely on `days` map if available.
                        if (alloc.days && Object.keys(alloc.days).length > 0) {
                            Object.entries(alloc.days).forEach(([date, count]) => {
                                if (activityByDay[date] && count > 0) {
                                    activityByDay[date].push({
                                        id: a.id,
                                        resource: a.resourceName!,
                                        task: t.name,
                                        module: m.name,
                                        role: a.role
                                    });
                                }
                            });
                        } else if (alloc.count > 0) {
                            // Fallback: Show on all days if just weekly total (legacy behavior support)
                            weekDates.forEach(date => {
                                activityByDay[date].push({
                                    id: a.id,
                                    resource: a.resourceName!,
                                    task: t.name,
                                    module: m.name,
                                    role: a.role
                                });
                            });
                        }
                    }
                });
            });
        });
    });
    return { dates: weekDates, activity: activityByDay };
  }, [projects, currentWeekId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full overflow-y-auto custom-scrollbar p-1">
      
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
                    <span className="text-xs text-slate-400">Function Points</span>
                </div>
            </div>
             <div className="mt-4 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded w-fit">
                Est. Size
            </div>
        </div>
      </div>

      {/* Weekly Pulse Section (New) */}
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
                                    <div key={`${item.id}-${i}`} className="bg-white p-2 rounded shadow-sm border border-slate-100 text-xs group hover:border-indigo-300 transition-colors">
                                        <div className="font-bold text-slate-700 truncate" title={item.resource}>{item.resource}</div>
                                        <div className="text-[10px] text-slate-500 truncate" title={item.task}>{item.task}</div>
                                        <div className="text-[9px] text-indigo-400 mt-1 truncate">{item.module}</div>
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
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
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

        {/* Unassigned Tasks / Alerts */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-80 lg:h-auto">
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

      {/* Resource Conflict & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Conflict Detection Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-80">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertOctagon size={16} className="text-red-500" />
                    Resource Overlap/Conflicts
                </h3>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
                 {conflicts.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <CheckCircle2 size={32} className="text-green-500 mb-2" />
                        <p className="text-sm">No cross-module conflicts detected.</p>
                    </div>
                 ) : (
                     <table className="w-full text-sm text-left">
                        <thead className="bg-white text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-2">Resource</th>
                                <th className="px-4 py-2">Week</th>
                                <th className="px-4 py-2">Total Load</th>
                                <th className="px-4 py-2">Conflicts</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {conflicts.map((c, idx) => (
                                <tr key={idx} className="hover:bg-red-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{c.resource}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.weekId}</td>
                                    <td className={`px-4 py-3 font-bold ${c.total > 5 ? 'text-red-600' : 'text-orange-600'}`}>{c.total.toFixed(1)}d</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            {c.modules.map(m => (
                                                <span key={m} className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded w-fit truncate max-w-[150px]" title={m}>{m}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
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
