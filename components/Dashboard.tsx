import React, { useMemo } from 'react';
import { Project, Role, WeeklySummary, ResourceAllocation } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { getTimeline, DEFAULT_START, DEFAULT_END, calculateWorkingDaysBetween, formatDateForInput } from '../constants';
import { AlertCircle, CheckCircle2, Clock, Users, Briefcase, ChevronRight, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Dashboard: React.FC<DashboardProps> = ({ projects }) => {
  
  const GLOBAL_TIMELINE_DATA = useMemo(() => getTimeline('week', DEFAULT_START, DEFAULT_END), []);
  const today = new Date();
  const todayStr = formatDateForInput(today);

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-80">
             <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Top Utilized Resources</h3>
                <span className="text-xs text-slate-400">Total Man-Days</span>
            </div>
            <div className="flex-1 overflow-auto p-4">
                 <div className="space-y-4">
                     {resourceUtilization.map((r, idx) => (
                         <div key={r.name} className="flex items-center gap-4">
                             <div className="w-6 text-center font-bold text-slate-300 text-sm">#{idx + 1}</div>
                             <div className="flex-1">
                                 <div className="flex justify-between text-sm mb-1">
                                     <span className="font-medium text-slate-700">{r.name}</span>
                                     <span className="font-bold text-indigo-600">{r.days.toFixed(1)}d</span>
                                 </div>
                                 <div className="w-full bg-slate-100 rounded-full h-1.5">
                                     <div 
                                        className="h-full bg-indigo-500 rounded-full" 
                                        style={{ width: `${Math.min(100, (r.days / (stats.totalAllocatedDays || 1)) * 100 * 5)}%` }} // Visual scaling
                                    ></div>
                                 </div>
                             </div>
                         </div>
                     ))}
                     {resourceUtilization.length === 0 && <div className="text-center text-slate-400 py-8">No resource data available.</div>}
                 </div>
            </div>
        </div>
      </div>
    </div>
  );
};