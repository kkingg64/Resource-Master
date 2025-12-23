                  {/* Dependency Column Header */}
                  <div title="Dependency" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}>
                    <Link2 size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('dependency', dependencyColWidth, e)}></div>
                  </div>

                  {Object.values(yearHeaders).map((group: any, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-700 border-r border-slate-300 uppercase tracking-wider h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                </div>
                {showMonthRow && (
                  <div className="flex bg-slate-100 border-b border-slate-200 sticky top-8 z-40 h-8 items-center">
                    <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full" style={stickyStyle}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    {Object.values(monthHeaders).map((group: any, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-600 border-r border-slate-200 uppercase h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                  </div>
                )}
                <div className={`flex bg-slate-50 border-b border-slate-200 sticky z-40 shadow-sm h-8 items-center ${showMonthRow ? 'top-16' : 'top-8'}`}>
...
                                <div key={assignment.id} className={`flex border-b border-slate-100 group/assign ${draggedAssignment?.taskId === task.id && draggedAssignment?.index === assignmentIndex ? 'opacity-30' : ''} ${datePickerState.assignmentId === assignment.id ? 'relative z-40' : ''}`} draggable={!isReadOnly} onDragStart={(e) => handleAssignmentDragStart(e, task.id, assignmentIndex)} onDragOver={handleAssignmentDragOver} onDrop={(e) => handleAssignmentDrop(e, project.id, module.id, task.id, assignmentIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'assignment', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id, assignmentId: assignment.id }); }}>
                                  <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-10 flex items-center justify-between border-l-[3px] ${roleStyle.border} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                    <div className="flex-1 overflow-hidden flex items-center gap-2 pl-12">
                                      <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="w-full text-[11px] text-slate-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-600 disabled:cursor-default disabled:hover:text-slate-600">
                                          <option value="Unassigned">Unassigned</option>
                                          {Object.entries(groupedResources).map(([category, resList]) => ( <optgroup label={category} key={category}>{(resList as Resource[]).map(r => <option key={r.id} value={r.name}>{r.name} {r.type === 'External' ? '(Ext.)' : ''}</option>)}</optgroup> ))}
                                      </select>
                                    </div>
                                  </div>
                                  
                                  {/* Assignment Details Columns */}
...
                                     ) : (
                                         !isReadOnly && (
                                            <div className="opacity-0 group-hover/dep:opacity-100 w-full flex justify-center">
                                                <select 
                                                    className="w-4 h-4 opacity-0 absolute inset-0 cursor-pointer" 
                                                    value="" 
                                                    onChange={(e) => onUpdateAssignmentDependency(assignment.id, e.target.value)}
                                                >
                                                    <option value="">Add Dependency...</option>
                                                    {Object.entries(groupedParents).map(([group, opts]) => (
                                                        <optgroup key={group} label={group}>
                                                            {(opts as typeof possibleParents).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <Link size={10} className="text-slate-300 hover:text-indigo-500" />
                                            </div>
                                         )
                                     )}
                                  </div>
...