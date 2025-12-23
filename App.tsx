const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => {
      if (isReadOnlyMode) return;
      
      let payload: any = { count };
      if (dayDate) {
          const project = projects.find(p => p.id === projectId);
          const module = project?.modules.find(m => m.id === moduleId);
          const task = module?.tasks.find(t => t.id === taskId);
          const assignment = task?.assignments.find(a => a.id === assignmentId);
          const allocation = assignment?.allocations.find(a => a.weekId === weekId);
          
          const currentDays = { ...(allocation?.days || {}) };
          currentDays[dayDate] = count;
          
          const totalCount = Object.values(currentDays).reduce((sum: number, val: number) => sum + val, 0);
          payload = { count: totalCount, days: currentDays };
      }

      await callSupabase('UPDATE allocation', payload,
          supabase.from('resource_allocations').upsert({
              assignment_id: assignmentId,
              week_id: weekId,
              ...payload
          }, { onConflict: 'assignment_id, week_id' })
      );
      
      fetchData(true);
  };