
import React, { useMemo } from 'react';
// FIX: Removed WeekPoint from this import as it's not defined in types.ts
import { Project, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
// FIX: Imported WeekPoint from constants.ts where it is defined.
import { getTimeline, WeekPoint } from '../constants';

interface DashboardProps {
  projects: Project[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
}

// Define which roles get a specific color/bar in the chart
// FIX: Added 'as const' to ensure CHARTED_ROLES has a narrow, specific tuple type. This prevents TypeScript from widening it to Role[], which caused ChartedRole and ChartDataRow to be inferred incorrectly.
const CHARTED_ROLES = [Role.DEV, Role.QA, Role.UIUX, Role.BA] as const;
type ChartedRole = typeof CHARTED_ROLES[number];

// Define the shape of our chart data rows for type safety
type ChartDataRow = {
  name: string;
  total: number;
  Other: number;
} & {
  [key in ChartedRole]: number;
};


export const Dashboard: React.FC<DashboardProps> = ({ projects, timelineStart, timelineEnd }) => {
  
  const chartData = useMemo(() => {
    // 1. Generate a dynamic timeline that matches the planner's view
    const dynamicTimeline = getTimeline('week', timelineStart, timelineEnd);
    
    return dynamicTimeline.map(week => {
      // 2. Create a clean, typed summary object for each week
      const summary: ChartDataRow = {
        name: `${week.label} (${week.groupLabel.split(' ')[0]})`,
        [Role.DEV]: 0,
        [Role.QA]: 0,
        [Role.UIUX]: 0,
        [Role.BA]: 0,
        Other: 0,
        total: 0
      };

      projects.forEach(proj => {
        proj.modules.forEach(mod => {
          mod.tasks.forEach(task => {
            task.assignments.forEach(assignment => {
              const role = assignment.role;
              
              assignment.allocations.forEach(alloc => {
                if (alloc.weekId === week.id) {
                  // 3. Safely aggregate data, grouping non-primary roles into "Other"
                  if (CHARTED_ROLES.includes(role as ChartedRole)) {
                    summary[role as ChartedRole] += alloc.count;
                  } else {
                     summary.Other += alloc.count;
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
  }, [projects, timelineStart, timelineEnd]);

  const totalFP = projects.reduce((accP, p) => accP + p.modules.reduce((accM, m) => accM + m.functionPoints, 0), 0);
  const totalAllocatedDays = chartData.reduce((acc, week) => acc + week.total, 0);
  const totalModules = projects.reduce((acc, p) => acc + p.modules.length, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">Total MVP Function Points</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{totalFP}</p>
          <div className="mt-2 text-xs text-green-600 font-medium">Confirmed Scope</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">Total Resource Days Allocated</h3>
          <p className="text-3xl font-bold text-indigo-600 mt-2">{totalAllocatedDays.toFixed(0)}</p>
          <div className="mt-2 text-xs text-slate-400">Across {projects.length} projects</div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-slate-500 text-sm font-medium">Total Modules</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{totalModules}</p>
          <div className="mt-2 text-xs text-orange-600 font-medium">In Planning</div>
        </div>
      </div>

      {/* Main Charts */}
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
              <Bar dataKey={Role.DEV} stackId="a" fill="#4f46e5" name="Developers" />
              <Bar dataKey={Role.QA} stackId="a" fill="#10b981" name="QA" />
              <Bar dataKey={Role.UIUX} stackId="a" fill="#f59e0b" name="Design" />
              <Bar dataKey={Role.BA} stackId="a" fill="#64748b" name="Analysts" />
              <Bar dataKey="Other" stackId="a" fill="#94a3b8" name="Other" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80">
           <h3 className="text-lg font-bold text-slate-800 mb-4">Total Portfolio Effort</h3>
           <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tick={{fontSize: 10}} interval={Math.max(1, Math.floor(chartData.length / 10))} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
              <Area type="monotone" dataKey="total" stroke="#4f46e5" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
