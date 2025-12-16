import React, { useState, useEffect, useCallback } from 'react';
import { 
  Project, Resource, Holiday, Role, LogEntry, 
  WeekPoint, ProjectModule, ProjectTask, TaskAssignment 
} from './types';
import { 
  DEFAULT_START, DEFAULT_END, addWeeksToPoint, 
  GOV_HOLIDAYS_DB, getDateFromWeek, formatDateForInput 
} from './constants';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Resources } from './components/Resources';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { DebugLog } from './components/DebugLog';
import { AIAssistant } from './components/AIAssistant';
import { VersionHistory } from './components/VersionHistory';
import { 
  LayoutDashboard, Calendar as CalendarIcon, Calculator, 
  Users, Settings as SettingsIcon, Globe 
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('planner');
  const [projects, setProjects] = useState<Project[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  
  const [showHistory, setShowHistory] = useState(false);

  // Mock initial data load
  const fetchData = async (force = false) => {
    setIsRefreshing(true);
    // In a real app, fetch from Supabase here.
    // For now, we'll just simulate a delay or load from localStorage if we implemented that.
    setTimeout(() => {
        setIsRefreshing(false);
    }, 500);
  };

  useEffect(() => {
      fetchData();
  }, []);

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
      setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
      setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

  // --- Project/Module/Task Handlers ---

  const addProject = () => {
    const newProject: Project = { id: crypto.randomUUID(), name: "New Project", modules: [] };
    setProjects(prev => [...prev, newProject]);
  };

  const updateProjectName = (id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const deleteProject = (id: string) => {
    if(window.confirm("Delete project?")) setProjects(prev => prev.filter(p => p.id !== id));
  };

  const addModule = (projectId: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const newModule: ProjectModule = { 
            id: crypto.randomUUID(), name: "New Module", tasks: [], 
            legacyFunctionPoints: 0, functionPoints: 0 
        };
        return { ...p, modules: [...p.modules, newModule] };
    }));
  };

  const updateModuleName = (projectId: string, moduleId: string, name: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, name } : m) };
    }));
  };

  const deleteModule = (projectId: string, moduleId: string) => {
      if(window.confirm("Delete module?")) {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return { ...p, modules: p.modules.filter(m => m.id !== moduleId) };
        }));
      }
  };

  const reorderModules = (projectId: string, startIndex: number, endIndex: number) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        const result = Array.from(p.modules);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);
        return { ...p, modules: result };
    }));
  };

  const addTask = (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
     setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            const newTask: ProjectTask = {
                id: taskId || crypto.randomUUID(),
                name: taskName,
                assignments: [{
                    id: crypto.randomUUID(),
                    role: role,
                    allocations: [],
                    duration: 5 // Default duration
                }]
            };
            return { ...m, tasks: [...m.tasks, newTask] };
        })};
    }));
  };

  const updateTaskName = (projectId: string, moduleId: string, taskId: string, name: string) => {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, name } : t) };
        })};
    }));
  };

  const deleteTask = (projectId: string, moduleId: string, taskId: string) => {
      if(window.confirm("Delete task?")) {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return { ...p, modules: p.modules.map(m => {
                if (m.id !== moduleId) return m;
                return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
            })};
        }));
      }
  };

  const reorderTasks = (projectId: string, moduleId: string, startIndex: number, endIndex: number) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            const result = Array.from(m.tasks);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return { ...m, tasks: result };
        })};
    }));
  };

  const onShiftTask = (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
      // Implement shifting logic if needed, typically adjusting dates
      console.log("Shift task not implemented");
  };

  // --- Assignment Handlers ---

  const addAssignment = (projectId: string, moduleId: string, taskId: string, role: Role) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => {
                if (t.id !== taskId) return t;
                const newAssignment: TaskAssignment = {
                    id: crypto.randomUUID(),
                    role: role,
                    allocations: [],
                    duration: 5
                };
                return { ...t, assignments: [...t.assignments, newAssignment] };
            })};
        })};
    }));
  };

  const updateAssignmentResourceName = (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => {
                if (t.id !== taskId) return t;
                return { ...t, assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, resourceName: name } : a) };
            })};
        })};
    }));
  };

  const updateAllocation = (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => {
                if (t.id !== taskId) return t;
                return { ...t, assignments: t.assignments.map(a => {
                    if (a.id !== assignmentId) return a;
                    // Deep copy allocations
                    let newAllocations = [...a.allocations];
                    let allocation = newAllocations.find(al => al.weekId === weekId);
                    
                    if (dayDate) {
                        // Day-level update
                        if (!allocation) {
                            allocation = { weekId, count: 0, days: {} };
                            newAllocations.push(allocation);
                        }
                        const newDays = { ...(allocation.days || {}), [dayDate]: value };
                        // Recalculate weekly total
                        const weeklyTotal = Object.values(newDays).reduce((sum, val) => sum + val, 0);
                        allocation.days = newDays;
                        allocation.count = weeklyTotal;
                    } else {
                        // Week-level update
                        if (!allocation) {
                             newAllocations.push({ weekId, count: value, days: {} });
                        } else {
                             allocation.count = value;
                             // Clear days if setting week total directly? Or distribute?
                             // Simple approach: clear days to rely on week total
                             allocation.days = {}; 
                        }
                    }
                    return { ...a, allocations: newAllocations };
                })};
            })};
        })};
    }));
  };

  const updateAssignmentDependency = (assignmentId: string, parentAssignmentId: string | null) => {
      setProjects(prev => {
          // Deep clone
          const newProjects = JSON.parse(JSON.stringify(prev));
          newProjects.forEach((p: Project) => {
              p.modules.forEach(m => {
                  m.tasks.forEach(t => {
                      t.assignments.forEach(a => {
                          if (a.id === assignmentId) {
                              a.parentAssignmentId = parentAssignmentId;
                          }
                      });
                  });
              });
          });
          return newProjects;
      });
  };
  
  const onCopyAssignment = (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => {
                if (t.id !== taskId) return t;
                const source = t.assignments.find(a => a.id === assignmentId);
                if (!source) return t;
                const copy = { ...source, id: crypto.randomUUID(), resourceName: 'Unassigned' };
                return { ...t, assignments: [...t.assignments, copy] };
            })};
        })};
    }));
  };

  const reorderAssignments = (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
            if (m.id !== moduleId) return m;
            return { ...m, tasks: m.tasks.map(t => {
                if (t.id !== taskId) return t;
                const result = Array.from(t.assignments);
                const [removed] = result.splice(startIndex, 1);
                result.splice(endIndex, 0, removed);
                return { ...t, assignments: result };
            })};
        })};
    }));
  };
  
  const updateAssignmentSchedule = (assignmentId: string, startDate: string, duration: number) => {
      setProjects(prev => {
          const newProjects = JSON.parse(JSON.stringify(prev));
          newProjects.forEach((p: Project) => {
              p.modules.forEach(m => {
                  m.tasks.forEach(t => {
                      t.assignments.forEach(a => {
                          if (a.id === assignmentId) {
                              a.startDate = startDate;
                              a.duration = duration;
                              // Calculate startWeekId if needed
                              if (startDate) {
                                  const d = new Date(startDate);
                                  // Simplified week calculation
                                  // Use getWeekIdFromDate from constants if available or custom logic
                              }
                          }
                      });
                  });
              });
          });
          return newProjects;
      });
  };

  const updateAssignmentProgress = (assignmentId: string, progress: number) => {
      setProjects(prev => {
          const newProjects = JSON.parse(JSON.stringify(prev));
          newProjects.forEach((p: Project) => {
              p.modules.forEach(m => {
                  m.tasks.forEach(t => {
                      t.assignments.forEach(a => {
                          if (a.id === assignmentId) {
                              a.progress = progress;
                          }
                      });
                  });
              });
          });
          return newProjects;
      });
  };

  const deleteAssignment = (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if(window.confirm("Delete assignment?")) {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return { ...p, modules: p.modules.map(m => {
                if (m.id !== moduleId) return m;
                return { ...m, tasks: m.tasks.map(t => {
                    if (t.id !== taskId) return t;
                    return { ...t, assignments: t.assignments.filter(a => a.id !== assignmentId) };
                })};
            })};
        }));
      }
  };

  // --- Estimator Handlers ---

  const updateFunctionPoints = (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number, feVelocity: number, feTeamSize: number, beVelocity: number, beTeamSize: number) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, modules: p.modules.map(m => {
              if (m.id !== moduleId) return m;
              return { 
                  ...m, 
                  legacyFunctionPoints: legacyFp, 
                  frontendFunctionPoints: frontendFp,
                  backendFunctionPoints: backendFp,
                  prepVelocity, prepTeamSize, 
                  frontendVelocity: feVelocity, frontendTeamSize: feTeamSize,
                  backendVelocity: beVelocity, backendTeamSize: beTeamSize
              };
          })};
      }));
  };

  const updateModuleComplexity = (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: any) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, modules: p.modules.map(m => {
              if (m.id !== moduleId) return m;
              return type === 'frontend' ? { ...m, frontendComplexity: complexity } : { ...m, backendComplexity: complexity };
          })};
      }));
  };

  const updateModuleStartDate = (projectId: string, moduleId: string, startDate: string | null) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, modules: p.modules.map(m => {
              if (m.id !== moduleId) return m;
              return { ...m, startDate: startDate || undefined };
          })};
      }));
  };

  const updateModuleStartTask = (projectId: string, moduleId: string, startTaskId: string | null) => {
       setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, modules: p.modules.map(m => {
              if (m.id !== moduleId) return m;
              return { ...m, startTaskId: startTaskId || undefined };
          })};
      }));
  };
  
  const updateModuleDeliveryTask = (projectId: string, moduleId: string, deliveryTaskId: string | null) => {
       setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, modules: p.modules.map(m => {
              if (m.id !== moduleId) return m;
              return { ...m, deliveryTaskId: deliveryTaskId || undefined };
          })};
      }));
  };

  // --- Resource Handlers ---

  const addResource = async (name: string, category: Role, region: string, type: 'Internal' | 'External') => {
      const newRes: Resource = { id: crypto.randomUUID(), name, category, holiday_region: region, type, individual_holidays: [] };
      setResources(prev => [...prev, newRes]);
  };

  const deleteResource = async (id: string) => {
      if(window.confirm("Delete resource?")) setResources(prev => prev.filter(r => r.id !== id));
  };

  const updateResourceCategory = async (id: string, category: Role) => {
      setResources(prev => prev.map(r => r.id === id ? { ...r, category } : r));
  };

  const updateResourceRegion = async (id: string, region: string | null) => {
      setResources(prev => prev.map(r => r.id === id ? { ...r, holiday_region: region || undefined } : r));
  };

  const updateResourceType = async (id: string, type: 'Internal' | 'External') => {
      setResources(prev => prev.map(r => r.id === id ? { ...r, type } : r));
  };

  const updateResourceName = async (id: string, name: string) => {
      setResources(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const addIndividualHolidays = async (resourceId: string, items: { date: string, name: string }[]) => {
      setResources(prev => prev.map(r => {
          if (r.id !== resourceId) return r;
          const newHolidays = items.map(i => ({ id: crypto.randomUUID(), date: i.date, name: i.name, resource_id: resourceId }));
          return { ...r, individual_holidays: [...(r.individual_holidays || []), ...newHolidays] };
      }));
  };

  const deleteIndividualHoliday = async (holidayId: string) => {
      setResources(prev => prev.map(r => {
          if (!r.individual_holidays) return r;
          return { ...r, individual_holidays: r.individual_holidays.filter(h => h.id !== holidayId) };
      }));
  };

  // --- Holiday Handlers ---
  
  const addHoliday = async (newHolidays: Omit<Holiday, 'id'>[]) => {
      const added = newHolidays.map(h => ({ ...h, id: crypto.randomUUID() }));
      setHolidays(prev => [...prev, ...added]);
  };

  const deleteHoliday = async (id: string) => {
      setHolidays(prev => prev.filter(h => h.id !== id));
  };

  const deleteHolidaysByCountry = async (country: string) => {
      setHolidays(prev => prev.filter(h => h.country !== country));
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 flex-shrink-0 bg-slate-900 flex flex-col items-center py-4 gap-4 z-50 shadow-xl">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg mb-2">
                <Calculator className="text-white w-6 h-6" />
            </div>
            
            <button 
                onClick={() => setActiveTab('dashboard')} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title="Dashboard"
            >
                <LayoutDashboard size={20} />
            </button>
            <button 
                onClick={() => setActiveTab('planner')} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title="Planner"
            >
                <CalendarIcon size={20} />
            </button>
            <button 
                onClick={() => setActiveTab('estimator')} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title="Estimator"
            >
                <Calculator size={20} />
            </button>
            <button 
                onClick={() => setActiveTab('resources')} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title="Resources"
            >
                <Users size={20} />
            </button>
             <button 
                onClick={() => setActiveTab('holidays')} 
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title="Holidays"
            >
                <Globe size={20} />
            </button>
            
            <div className="mt-auto flex flex-col gap-4">
                 <button 
                    onClick={() => setActiveTab('settings')} 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                    title="Settings"
                >
                    <SettingsIcon size={20} />
                </button>
            </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
            <div className="flex-1 p-4 overflow-hidden">
                {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
                {activeTab === 'planner' && (
                    <div className="h-full">
                        <PlannerGrid 
                            projects={projects} 
                            holidays={holidays}
                            resources={resources}
                            timelineStart={timelineStart}
                            timelineEnd={timelineEnd}
                            onExtendTimeline={handleExtendTimeline}
                            onUpdateAllocation={updateAllocation}
                            onUpdateAssignmentResourceName={updateAssignmentResourceName}
                            onUpdateAssignmentDependency={updateAssignmentDependency}
                            onAddTask={addTask}
                            onAddAssignment={addAssignment}
                            onCopyAssignment={onCopyAssignment}
                            onReorderModules={reorderModules}
                            onReorderTasks={reorderTasks}
                            onReorderAssignments={reorderAssignments}
                            onShiftTask={onShiftTask}
                            onUpdateAssignmentSchedule={updateAssignmentSchedule}
                            onUpdateAssignmentProgress={updateAssignmentProgress}
                            onAddProject={addProject}
                            onAddModule={addModule}
                            onUpdateProjectName={updateProjectName}
                            onUpdateModuleName={updateModuleName}
                            onUpdateTaskName={updateTaskName}
                            onDeleteProject={deleteProject}
                            onDeleteModule={deleteModule}
                            onDeleteTask={deleteTask}
                            onDeleteAssignment={deleteAssignment}
                            onImportPlan={(p) => { if(!isReadOnlyMode) setProjects(p); }}
                            onShowHistory={() => setShowHistory(true)}
                            onRefresh={() => fetchData(true)}
                            saveStatus={saveStatus}
                            isRefreshing={isRefreshing}
                            isReadOnly={isReadOnlyMode}
                        />
                    </div>
                )}
                {activeTab === 'estimator' && (
                    <div className="h-full">
                        <Estimator 
                            projects={projects} 
                            holidays={holidays}
                            onUpdateFunctionPoints={updateFunctionPoints}
                            onReorderModules={reorderModules}
                            onUpdateModuleComplexity={updateModuleComplexity}
                            onUpdateModuleStartDate={updateModuleStartDate}
                            onUpdateModuleDeliveryTask={updateModuleDeliveryTask}
                            onUpdateModuleStartTask={updateModuleStartTask}
                            isReadOnly={isReadOnlyMode}
                        />
                    </div>
                )}
                {activeTab === 'resources' && (
                    <div className="h-full overflow-y-auto custom-scrollbar">
                       <Resources 
                          resources={resources}
                          onAddResource={addResource}
                          onDeleteResource={deleteResource}
                          onUpdateResourceCategory={updateResourceCategory}
                          onUpdateResourceRegion={updateResourceRegion}
                          onUpdateResourceType={updateResourceType}
                          onUpdateResourceName={updateResourceName}
                          onAddIndividualHoliday={addIndividualHolidays}
                          onDeleteIndividualHoliday={deleteIndividualHoliday}
                          isReadOnly={isReadOnlyMode}
                       />
                    </div>
                )}
                {activeTab === 'holidays' && (
                    <div className="h-full overflow-hidden">
                        <AdminSettings 
                            holidays={holidays}
                            onAddHolidays={addHoliday}
                            onDeleteHoliday={deleteHoliday}
                            onDeleteHolidaysByCountry={deleteHolidaysByCountry}
                        />
                    </div>
                )}
                {activeTab === 'settings' && !isReadOnlyMode && (
                    <div className="max-w-4xl mx-auto h-full overflow-y-auto custom-scrollbar">
                       <Settings 
                            isDebugLogEnabled={isDebugLogEnabled} 
                            setIsDebugLogEnabled={setIsDebugLogEnabled} 
                            isAIEnabled={isAIEnabled}
                            setIsAIEnabled={setIsAIEnabled}
                       />
                    </div>
                )}
            </div>
        </div>

        {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
        {isAIEnabled && <AIAssistant projects={projects} resources={resources} onAddTask={addTask} onAssignResource={updateAssignmentResourceName} />}
        {showHistory && <VersionHistory onClose={() => setShowHistory(false)} onRestore={() => {}} onSaveCurrent={async () => {}} />}
    </div>
  );
};

export default App;