
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, X, Bot, Sparkles, User, Loader2, Trash2, Settings, Key, CheckCircle, AlertCircle, LogIn, LogOut, Copy, ExternalLink } from 'lucide-react';
import { Project, Resource, Role, ModuleType } from '../types';

// ─── Props ───────────────────────────────────────────────────────────
export interface AIAssistantProps {
  projects: Project[];
  resources: Resource[];
  githubToken?: string;
  githubUser?: { login: string; avatar_url: string } | null;
  githubLoginStatus?: 'idle' | 'waiting' | 'polling' | 'success' | 'error';
  githubDeviceCode?: { user_code: string; verification_uri: string } | null;
  githubLoginMessage?: string;
  isGitHubCheckNowLoading?: boolean;
  githubClientId?: string;
  onGitHubClientIdChange?: (id: string) => void;
  onGitHubLogin?: () => void;
  onGitHubCheckNow?: () => void;
  onGitHubLogout?: () => void;
  onAddProject: () => void;
  onAddModule: (projectId: string) => void;
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onUpdateProjectName: (projectId: string, name: string) => void;
  onUpdateModuleName: (projectId: string, moduleId: string, name: string) => void;
  onUpdateTaskName: (projectId: string, moduleId: string, taskId: string, name: string) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => void;
  onUpdateAssignmentSchedule: (assignmentId: string, startDate: string, duration: number) => void;
  onUpdateAssignmentProgress: (assignmentId: string, progress: number) => void;
  onUpdateAssignmentActualDate?: (assignmentId: string, actualDate: string | null) => void;
  onUpdateAllocationByAssignment?: (assignmentId: string, weekId: string, value: number, dayDate?: string) => void;
  onCopyAssignmentById?: (assignmentId: string) => void;
  onReorderModules?: (projectId: string, startIndex: number, endIndex: number) => void;
  onReorderTasks?: (projectId: string, moduleId: string, startIndex: number, endIndex: number) => void;
  onMoveTask?: (projectId: string, sourceModuleId: string, targetModuleId: string, sourceIndex: number, targetIndex: number) => void;
  onUpdateModuleType?: (projectId: string, moduleId: string, type: ModuleType) => void;
  onReorderAssignments?: (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => void;
  onShiftTask?: (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right' | 'left-working' | 'right-working') => void;
  onUpdateAssignmentDependency: (assignmentId: string, parentAssignmentId: string | null) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteModule: (projectId: string, moduleId: string) => void;
  onDeleteTask: (projectId: string, moduleId: string, taskId: string) => void;
  onDeleteAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onCollapseAllResourceRows?: () => void;
}

interface Message { id: string; role: 'user' | 'assistant'; text: string }
interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }
interface LLMMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }

const MAX_HISTORY_MESSAGES = 50; // Increased from 24 to allow longer conversations
const MAX_TOOL_CONTENT_CHARS = 3000; // Reduced to keep request body smaller
const HISTORY_TRIM_THRESHOLD = 60; // If history exceeds this, aggressively trim to MAX
const MODEL_CANDIDATES = ['gpt-4o', 'gpt-4o-mini'];
const DELETE_BLOCK_MESSAGE = 'Delete actions are disabled for AI to protect the existing timeline.';

const createSafeId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const copyTextSafe = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Use fallback below.
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
};

const parseRateLimitWaitSeconds = (message: string): number | null => {
  const byRetry = /retrying?\s+in\s+(\d+)\s*seconds?/i.exec(message);
  if (byRetry) return Number(byRetry[1]);

  const byWait = /wait\s+(\d+)\s*seconds?/i.exec(message);
  if (byWait) return Number(byWait[1]);

  return null;
};

const isRateLimitError = (message: string): boolean => /rate\s*limit/i.test(message);

const truncateText = (text: string, maxChars: number): string => {
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated to fit model limits]`;
};

const proactivelyTrimHistory = (history: LLMMessage[], maxMessages: number): LLMMessage[] => {
  if (history.length <= maxMessages) return history;
  // Remove older user/assistant message pairs, keeping most recent and tool results
  let trimmed = history.slice(-maxMessages);
  // Ensure we don't cut in the middle of a tool-call response pair
  while (trimmed.length > 2 && trimmed[0].role === 'tool') {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
};

const prepareHistoryForModel = (history: LLMMessage[]): LLMMessage[] => {
  // Keep a bounded history, but ensure complete tool-call+response sequences are never split.
  let recentStart = Math.max(0, history.length - MAX_HISTORY_MESSAGES);

  // If we're slicing in the middle of a tool-reply sequence, back up to the start of that sequence.
  if (recentStart > 0) {
    const sliceMsg = history[recentStart];
    
    // If the slice starts with a tool message, back up to find its assistant caller
    if (sliceMsg?.role === 'tool') {
      let backIdx = recentStart - 1;
      // Scan backward over any preceding tool messages
      while (backIdx >= 0 && history[backIdx]?.role === 'tool') {
        backIdx--;
      }
      // Now backIdx should be at the assistant (or earlier)
      if (backIdx >= 0 && history[backIdx]?.role === 'assistant') {
        recentStart = backIdx; // Include the full tool sequence
      }
    }
  }

  const recent = history.slice(recentStart);

  // First pass: collect all valid tool_call_ids from all assistants in recent history
  const validToolCallIds = new Set<string>();
  for (const msg of recent) {
    if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        validToolCallIds.add(tc.id);
      }
    }
  }

  // Second pass: build sanitized history, keeping only tool messages that match valid IDs
  const sanitized: LLMMessage[] = [];
  for (const msg of recent) {
    if (msg.role !== 'tool') {
      sanitized.push(msg);
    } else if (validToolCallIds.has(msg.tool_call_id || '')) {
      sanitized.push(msg);
    }
    // else: drop orphan tool messages
  }

  return sanitized.map(msg => {
    if (msg.role !== 'tool' || !msg.content) return msg;
    return { ...msg, content: truncateText(msg.content, MAX_TOOL_CONTENT_CHARS) };
  });
};

const TOOLS = [
  { type: 'function' as const, function: { name: 'listProjects', description: 'List all projects with IDs, names, and module count.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function' as const, function: { name: 'getProjectDetails', description: 'Get full structure of a project (modules, tasks, assignments with schedule/progress/resource/dependencies).', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } } },
  { type: 'function' as const, function: { name: 'addProject', description: 'Create a new project. Optionally provide name; the tool will apply it only to the newly created project and return projectId.', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: [] } } },
  { type: 'function' as const, function: { name: 'createPhasedProjectTimeline', description: 'Create a new project with N sequential phases and real assignment schedules bounded by start/end dates.', parameters: { type: 'object', properties: { projectName: { type: 'string' }, phaseCount: { type: 'number' }, startDate: { type: 'string', description: 'YYYY-MM-DD' }, endDate: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['projectName', 'phaseCount', 'startDate', 'endDate'] } } },
  { type: 'function' as const, function: { name: 'addModule', description: 'Add a new module to a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } } },
  { type: 'function' as const, function: { name: 'addTask', description: 'Add a new task to a module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskName: { type: 'string' }, role: { type: 'string', description: `One of: ${Object.values(Role).join(', ')}` } }, required: ['projectId', 'moduleId', 'taskName'] } } },
  { type: 'function' as const, function: { name: 'addAssignment', description: 'Add a new assignment to an existing task.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, role: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId'] } } },
  { type: 'function' as const, function: { name: 'updateProjectName', description: 'Rename a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, name: { type: 'string' } }, required: ['projectId', 'name'] } } },
  { type: 'function' as const, function: { name: 'updateModuleName', description: 'Rename a module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, name: { type: 'string' } }, required: ['projectId', 'moduleId', 'name'] } } },
  { type: 'function' as const, function: { name: 'updateTaskName', description: 'Rename a task.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, name: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId', 'name'] } } },
  { type: 'function' as const, function: { name: 'assignResource', description: 'Assign a person to an assignment.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, assignmentId: { type: 'string' }, resourceName: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId', 'assignmentId', 'resourceName'] } } },
  { type: 'function' as const, function: { name: 'assignResourceBulk', description: 'Assign a person to multiple assignments in one call. Use for requests like "apply to all" or "every assignment".', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, assignmentIds: { type: 'array', items: { type: 'string' } }, resourceName: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId', 'assignmentIds', 'resourceName'] } } },
  { type: 'function' as const, function: { name: 'updateSchedule', description: 'Update start date & duration (working days) of an assignment.', parameters: { type: 'object', properties: { assignmentId: { type: 'string' }, startDate: { type: 'string', description: 'YYYY-MM-DD' }, duration: { type: 'number' } }, required: ['assignmentId', 'startDate', 'duration'] } } },
  { type: 'function' as const, function: { name: 'updateAllocation', description: 'Update allocation value for an assignment at week/day granularity.', parameters: { type: 'object', properties: { assignmentId: { type: 'string' }, weekId: { type: 'string', description: 'YYYY-WW' }, value: { type: 'number' }, dayDate: { type: 'string', description: 'Optional YYYY-MM-DD for day-level allocation inside the week.' } }, required: ['assignmentId', 'weekId', 'value'] } } },
  { type: 'function' as const, function: { name: 'updateProgress', description: 'Update progress (0-100) of an assignment.', parameters: { type: 'object', properties: { assignmentId: { type: 'string' }, progress: { type: 'number' } }, required: ['assignmentId', 'progress'] } } },
  { type: 'function' as const, function: { name: 'updateActualDate', description: 'Set or clear actual completion date for an assignment. To clear it, omit actualDate or pass null.', parameters: { type: 'object', properties: { assignmentId: { type: 'string' }, actualDate: { type: 'string', description: 'YYYY-MM-DD. Optional; null/omit to clear.' } }, required: ['assignmentId'] } } },
  { type: 'function' as const, function: { name: 'updateActualDateBulk', description: 'Set or clear actual completion date for multiple assignments in one call. Use this for "clear actual dates" / "apply to all" requests.', parameters: { type: 'object', properties: { assignmentIds: { type: 'array', items: { type: 'string' } }, actualDate: { type: 'string', description: 'YYYY-MM-DD. Omit/null to clear.' } }, required: ['assignmentIds'] } } },
  { type: 'function' as const, function: { name: 'syncModuleActualDatesToPlannedEnd', description: 'For a module, set each assignment actual completion date to its planned end date based on startDate + duration (working days). Optional resourceNames filter.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, resourceNames: { type: 'array', items: { type: 'string' }, description: 'Optional list of resource names to limit updates.' } }, required: ['projectId', 'moduleId'] } } },
  { type: 'function' as const, function: { name: 'copyAssignment', description: 'Duplicate an assignment (including allocations where available) by assignment ID.', parameters: { type: 'object', properties: { assignmentId: { type: 'string' } }, required: ['assignmentId'] } } },
  { type: 'function' as const, function: { name: 'reorderModules', description: 'Reorder modules within a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, startIndex: { type: 'number' }, endIndex: { type: 'number' } }, required: ['projectId', 'startIndex', 'endIndex'] } } },
  { type: 'function' as const, function: { name: 'reorderTasks', description: 'Reorder tasks within a module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, startIndex: { type: 'number' }, endIndex: { type: 'number' } }, required: ['projectId', 'moduleId', 'startIndex', 'endIndex'] } } },
  { type: 'function' as const, function: { name: 'moveTask', description: 'Move a task between modules or position within a target module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, sourceModuleId: { type: 'string' }, targetModuleId: { type: 'string' }, sourceIndex: { type: 'number' }, targetIndex: { type: 'number' } }, required: ['projectId', 'sourceModuleId', 'targetModuleId', 'sourceIndex', 'targetIndex'] } } },
  { type: 'function' as const, function: { name: 'updateModuleType', description: 'Update module type (MILESTONE, STANDARD, KEY_PHASE, MVP, PRODUCTION).', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, type: { type: 'string' } }, required: ['projectId', 'moduleId', 'type'] } } },
  { type: 'function' as const, function: { name: 'reorderAssignments', description: 'Reorder assignments inside a task.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, startIndex: { type: 'number' }, endIndex: { type: 'number' } }, required: ['projectId', 'moduleId', 'taskId', 'startIndex', 'endIndex'] } } },
  { type: 'function' as const, function: { name: 'shiftTaskTimeline', description: 'Shift an entire task timeline. direction: left, right, left-working, right-working.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, direction: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId', 'direction'] } } },
  { type: 'function' as const, function: { name: 'setDependency', description: 'Set or clear a finish-to-start dependency. To REMOVE a dependency, call with parentAssignmentId omitted or explicitly null.', parameters: { type: 'object', properties: { childAssignmentId: { type: 'string', description: 'The assignment that depends on another' }, parentAssignmentId: { type: 'string', description: 'The assignment that must finish first. Omit or pass null to REMOVE the dependency.' } }, required: ['childAssignmentId'] } } },
  { type: 'function' as const, function: { name: 'clearModuleDependencies', description: 'Remove ALL dependency links from every assignment inside a specific module. Use this when asked to clear/cancel dependencies in a module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' } }, required: ['projectId', 'moduleId'] } } },
  { type: 'function' as const, function: { name: 'deleteProject', description: 'Delete a project.', parameters: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } } },
  { type: 'function' as const, function: { name: 'deleteModule', description: 'Delete a module.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' } }, required: ['projectId', 'moduleId'] } } },
  { type: 'function' as const, function: { name: 'deleteTask', description: 'Delete a task.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId'] } } },
  { type: 'function' as const, function: { name: 'deleteAssignment', description: 'Delete an assignment.', parameters: { type: 'object', properties: { projectId: { type: 'string' }, moduleId: { type: 'string' }, taskId: { type: 'string' }, assignmentId: { type: 'string' } }, required: ['projectId', 'moduleId', 'taskId', 'assignmentId'] } } },
  { type: 'function' as const, function: { name: 'listResources', description: 'List all available resources/people.', parameters: { type: 'object', properties: {}, required: [] } } },
];

const SYSTEM_PROMPT = `You are the OMS Resource Master AI Copilot — a project management assistant.
You help users manage projects, modules, tasks, assignments, schedules, dependencies, and resources.

Current Date: ${new Date().toISOString().split('T')[0]}

Guidelines:
- Be concise and direct. Respond in the same language the user uses.
- Use tools to query data before answering questions about project structure.
- For any create/update action request, you must execute tools first; do not claim success unless the tool call has completed successfully.
- Default role is 'EP Dev Team' if not specified.
- Dates are YYYY-MM-DD. Duration is in working days.
- Progress is 0–100.
- Actual completion date is optional and uses YYYY-MM-DD.
- When user says "assign X to task Y", first look up the task to get assignmentId, then call assignResource.
- For requests that say "all", "every", or "apply to all", do not stop after one record. Use assignResourceBulk (or multiple assignResource calls) until all matched assignments are updated.
- For bulk updates, always report requested count, updated count, and skipped count.
- For "set actual end date to planned end date" requests on a whole module (or all resources in a module), prefer syncModuleActualDatesToPlannedEnd.
- For "clear actual date" requests, use updateActualDateBulk when multiple assignments are involved and return requested/updated/skipped counts.
- Confirm destructive actions (delete) before executing.
- Do not perform any delete actions. Timeline deletions are disabled for AI.
- If user refers to items by name, use listProjects/getProjectDetails to find IDs first.
- For create-project requests: MUST use addProject (with name when provided). Do NOT rename any existing project to satisfy creation requests.
- Use updateProjectName only when the user explicitly asks to rename an existing project.
- If user asks for a project with phases between a start/end boundary, use createPhasedProjectTimeline.
- If user asks for a project with phases between a start/end boundary, use createPhasedProjectTimeline.
- createPhasedProjectTimeline is an atomic tool: after calling it successfully, do NOT call addProject, addModule, addTask, addAssignment, or updateSchedule for that same request unless the user explicitly asks for a separate follow-up change.
- To remove ALL dependencies in a module, use clearModuleDependencies (pass projectId + moduleId).
- To remove a single dependency, use setDependency with only childAssignmentId (omit parentAssignmentId).
- ALWAYS call getProjectDetails before setDependency, updateProgress, updateActualDate, updateActualDateBulk, syncModuleActualDatesToPlannedEnd, or clearModuleDependencies to obtain correct IDs.

CRITICAL FOR TIMELINE CREATION:
- When creating a project with phases/modules, you MUST also create tasks within those modules and assignments for those tasks with SCHEDULE information.
- For each phase/module, create at least one task with a corresponding assignment.
- ALWAYS call updateSchedule() after creating an assignment to set startDate and duration.
- For boundary requests (e.g. "Phase 1 starts on X and last phase ends on Y"), timeline MUST end on Y (within working-day logic), not an earlier arbitrary date.
- Calculate dates intelligently:
  * Start dates should be sequential and realistic (e.g., Phase 1 starts today or soon, Phase 2 starts after Phase 1 ends)
  * Use current date as reference: ${new Date().toISOString().split('T')[0]}
  * Each phase should have a duration in working days (typically 3-10 days per phase)
  * Phases should NOT overlap unless explicitly requested
- Example flow for "Create project X with phases A, B, C":
  1. Add project X
  2. Add module "Phase A"
  3. Add task "Phase A Work"
  4. Add assignment for that task
  5. Call updateSchedule() with startDate=${new Date().toISOString().split('T')[0]} and duration=5
  6. Repeat for Phases B and C, adjusting dates so each starts after the previous ends
  7. Confirm with timeline summary`;

export const AIAssistant: React.FC<AIAssistantProps> = (props) => {
  const {
    projects, resources, githubToken, githubUser,
    githubLoginStatus, githubDeviceCode, githubLoginMessage, isGitHubCheckNowLoading, githubClientId,
    onGitHubClientIdChange, onGitHubLogin, onGitHubCheckNow, onGitHubLogout,
    onAddProject, onAddModule, onAddTask, onAddAssignment,
    onUpdateProjectName, onUpdateModuleName, onUpdateTaskName,
    onUpdateAssignmentResourceName, onUpdateAssignmentSchedule,
    onUpdateAssignmentProgress, onUpdateAssignmentActualDate, onUpdateAllocationByAssignment,
    onCopyAssignmentById, onReorderModules, onReorderTasks, onMoveTask, onUpdateModuleType,
    onReorderAssignments, onShiftTask, onUpdateAssignmentDependency,
    onDeleteProject, onDeleteModule, onDeleteTask, onDeleteAssignment,
    onCollapseAllResourceRows,
  } = props;

  // Use prop token if available, otherwise fall back to local PAT
  const [localToken, setLocalToken] = useState(() => localStorage.getItem('oms_github_token') || '');
  const token = githubToken || localToken;

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectsRef = useRef(projects);
  const resourcesRef = useRef(resources);
  const conversationHistory = useRef<LLMMessage[]>([]);
  const guardedTimelineProjectIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { resourcesRef.current = resources; }, [resources]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isOpen]);

  const handleSaveKey = (key: string) => {
    const t = key.trim();
    setLocalToken(t);
    localStorage.setItem('oms_github_token', t);
    setTestStatus('idle');
    setTestMessage('');
    setShowSettings(false);
  };

  const testConnection = async () => {
    if (!token) { setTestStatus('error'); setTestMessage('No token.'); return; }
    setTestStatus('testing');
    try {
      const res = await fetch('/api/github-models', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'ping' }], max_tokens: 5 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || res.statusText); }
      setTestStatus('success');
      setTestMessage('Connected!');
    } catch (e: any) { setTestStatus('error'); setTestMessage(e.message || 'Failed'); }
  };

  const executeTools = useCallback(async (toolCalls: ToolCall[]): Promise<LLMMessage[]> => {
    const results: LLMMessage[] = [];
    let shouldCollapseResourceRows = false;
    const actualDateMap: Record<string, string> = (() => {
      try {
        const raw = localStorage.getItem('oms_assignment_actual_dates_v1');
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {};
      } catch {
        return {};
      }
    })();

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const fmt = (d: Date) => {
      const y = d.getFullYear();
      const m = `${d.getMonth() + 1}`.padStart(2, '0');
      const day = `${d.getDate()}`.padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const parseYmd = (s: string) => new Date(s.replace(/-/g, '/'));
    const isWorkingDay = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
    const countWorkingDaysInclusive = (start: Date, end: Date) => {
      if (end < start) return 0;
      let c = 0;
      const d = new Date(start);
      while (d <= end) {
        if (isWorkingDay(d)) c++;
        d.setDate(d.getDate() + 1);
      }
      return c;
    };
    const addWorkingDaysInclusive = (start: Date, workingDays: number) => {
      const d = new Date(start);
      while (!isWorkingDay(d)) d.setDate(d.getDate() + 1);
      if (workingDays <= 1) return d;
      let remaining = workingDays - 1;
      while (remaining > 0) {
        d.setDate(d.getDate() + 1);
        if (isWorkingDay(d)) remaining--;
      }
      return d;
    };
    const nextWorkingDay = (after: Date) => {
      const d = new Date(after);
      d.setDate(d.getDate() + 1);
      while (!isWorkingDay(d)) d.setDate(d.getDate() + 1);
      return d;
    };

    for (const call of toolCalls) {
      let args: any = {};
      try { args = JSON.parse(call.function.arguments); } catch {}
      let result: any = { error: 'Unknown function' };
      try {
        switch (call.function.name) {
          case 'listProjects':
            result = projectsRef.current.map(p => ({ id: p.id, name: p.name, modules: p.modules.length }));
            break;
          case 'getProjectDetails': {
            const p = projectsRef.current.find(x => x.id === args.projectId);
            if (!p) { result = { error: 'Project not found' }; break; }
            result = { id: p.id, name: p.name, modules: p.modules.map(m => ({ id: m.id, name: m.name, type: m.type, tasks: m.tasks.map(t => ({ id: t.id, name: t.name, assignments: t.assignments.map(a => ({ id: a.id, role: a.role, resource: a.resourceName || 'Unassigned', startDate: a.startDate, duration: a.duration, progress: a.progress ?? 0, actualDate: actualDateMap[a.id] || null, parentAssignmentId: a.parentAssignmentId || null })) })) })) };
            break;
          }
          case 'addProject': {
            const beforeIds = new Set(projectsRef.current.map((p) => p.id));
            await Promise.resolve(onAddProject() as any);

            // Wait briefly for parent state to update so we can identify the new project safely.
            let createdProjectId: string | null = null;
            for (let i = 0; i < 12; i++) {
              const created = projectsRef.current.find((p) => !beforeIds.has(p.id));
              if (created) {
                createdProjectId = created.id;
                break;
              }
              await new Promise((r) => setTimeout(r, 120));
            }

            if (createdProjectId && typeof args.name === 'string' && args.name.trim()) {
              await Promise.resolve(onUpdateProjectName(createdProjectId, args.name.trim()) as any);
            }

            result = {
              success: true,
              projectId: createdProjectId,
              nameApplied: Boolean(createdProjectId && typeof args.name === 'string' && args.name.trim())
            };
            break;
          }
          case 'createPhasedProjectTimeline': {
            const projectName = String(args.projectName || '').trim();
            const phaseCount = Math.max(1, Math.floor(Number(args.phaseCount || 0)));
            const startDate = String(args.startDate || '').trim();
            const endDate = String(args.endDate || '').trim();

            if (!projectName || !startDate || !endDate || !phaseCount) {
              result = { error: 'Missing required args. Need projectName, phaseCount, startDate, endDate.' };
              break;
            }

            const start = parseYmd(startDate);
            const end = parseYmd(endDate);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
              result = { error: 'Invalid date range. Use YYYY-MM-DD and ensure endDate >= startDate.' };
              break;
            }

            const totalWorkingDays = countWorkingDaysInclusive(start, end);
            if (totalWorkingDays < phaseCount) {
              result = { error: `Date range has only ${totalWorkingDays} working days; cannot fit ${phaseCount} phases with at least 1 day each.` };
              break;
            }

            const beforeIds = new Set(projectsRef.current.map((p) => p.id));
            await Promise.resolve(onAddProject() as any);

            let projectId: string | null = null;
            for (let i = 0; i < 16; i++) {
              const created = projectsRef.current.find((p) => !beforeIds.has(p.id));
              if (created) {
                projectId = created.id;
                break;
              }
              await sleep(120);
            }

            if (!projectId) {
              result = { error: 'Failed to detect newly created project.' };
              break;
            }

            await Promise.resolve(onUpdateProjectName(projectId, projectName) as any);

            const base = Math.floor(totalWorkingDays / phaseCount);
            const rem = totalWorkingDays % phaseCount;
            const phaseDurations = Array.from({ length: phaseCount }, (_, i) => base + (i < rem ? 1 : 0));

            const phaseSummaries: Array<{ phase: string; startDate: string; endDate: string; duration: number }> = [];
            let cursor = new Date(start);

            for (let i = 0; i < phaseCount; i++) {
              const moduleName = `Phase ${i + 1}`;
              const phaseDuration = phaseDurations[i];

              const projectNow = projectsRef.current.find((p) => p.id === projectId);
              const beforeModuleIds = new Set((projectNow?.modules || []).map((m) => m.id));
              await Promise.resolve(onAddModule(projectId) as any);

              let moduleId: string | null = null;
              for (let t = 0; t < 16; t++) {
                const p = projectsRef.current.find((x) => x.id === projectId);
                const createdModule = p?.modules.find((m) => !beforeModuleIds.has(m.id));
                if (createdModule) {
                  moduleId = createdModule.id;
                  await Promise.resolve(onUpdateModuleName(projectId, moduleId, moduleName) as any);
                  break;
                }
                await sleep(120);
              }
              if (!moduleId) continue;

              const taskId = createSafeId();
              await Promise.resolve(onAddTask(projectId, moduleId, taskId, `${moduleName} Work`, Role.DEV) as any);

              let assignmentId: string | null = null;
              for (let t = 0; t < 20; t++) {
                const ass = projectsRef.current
                  .find((p) => p.id === projectId)?.modules
                  .find((m) => m.id === moduleId)?.tasks
                  .find((tk) => tk.id === taskId)?.assignments?.[0];
                if (ass) {
                  assignmentId = ass.id;
                  break;
                }
                await sleep(120);
              }
              if (!assignmentId) continue;

              const phaseStart = new Date(cursor);
              const phaseEnd = addWorkingDaysInclusive(phaseStart, phaseDuration);

              await Promise.resolve(onUpdateAssignmentSchedule(assignmentId, fmt(phaseStart), phaseDuration) as any);

              phaseSummaries.push({
                phase: moduleName,
                startDate: fmt(phaseStart),
                endDate: fmt(phaseEnd),
                duration: phaseDuration,
              });

              cursor = nextWorkingDay(phaseEnd);
            }

            result = {
              success: true,
              projectId,
              projectName,
              requested: { startDate, endDate, phaseCount },
              timeline: phaseSummaries,
            };
            guardedTimelineProjectIdsRef.current.add(projectId);
            shouldCollapseResourceRows = true;
            break;
          }
          case 'addModule': {
            if (guardedTimelineProjectIdsRef.current.has(args.projectId)) {
              result = { success: false, skipped: true, reason: 'Skipped duplicate addModule because createPhasedProjectTimeline already created the phase modules for this request.' };
              break;
            }
            onAddModule(args.projectId);
            result = { success: true };
            break;
          }
          case 'addTask': {
            if (guardedTimelineProjectIdsRef.current.has(args.projectId)) {
              result = { success: false, skipped: true, reason: 'Skipped duplicate addTask because createPhasedProjectTimeline already created tasks for this request.' };
              break;
            }
            const tid = createSafeId();
            const role = Object.values(Role).includes(args.role as Role) ? args.role as Role : Role.DEV;
            onAddTask(args.projectId, args.moduleId, tid, args.taskName, role);
            result = { success: true, taskId: tid };
            shouldCollapseResourceRows = true;
            break;
          }
          case 'addAssignment': {
            if (guardedTimelineProjectIdsRef.current.has(args.projectId)) {
              result = { success: false, skipped: true, reason: 'Skipped duplicate addAssignment because createPhasedProjectTimeline already created assignments for this request.' };
              break;
            }
            const role = Object.values(Role).includes(args.role as Role) ? args.role as Role : Role.DEV;
            onAddAssignment(args.projectId, args.moduleId, args.taskId, role);
            result = { success: true };
            shouldCollapseResourceRows = true;
            break;
          }
          case 'updateProjectName': onUpdateProjectName(args.projectId, args.name); result = { success: true }; break;
          case 'updateModuleName': onUpdateModuleName(args.projectId, args.moduleId, args.name); result = { success: true }; break;
          case 'updateTaskName': onUpdateTaskName(args.projectId, args.moduleId, args.taskId, args.name); result = { success: true }; break;
          case 'assignResource': onUpdateAssignmentResourceName(args.projectId, args.moduleId, args.taskId, args.assignmentId, args.resourceName); result = { success: true }; break;
          case 'assignResourceBulk': {
            const assignmentIds = Array.isArray(args.assignmentIds)
              ? Array.from(new Set(args.assignmentIds.map((id: any) => String(id).trim()).filter(Boolean)))
              : [];
            if (assignmentIds.length === 0) {
              result = { error: 'assignmentIds must be a non-empty array of IDs.' };
              break;
            }

            const project = projectsRef.current.find((p) => p.id === args.projectId);
            const module = project?.modules.find((m) => m.id === args.moduleId);
            const task = module?.tasks.find((t) => t.id === args.taskId);
            if (!task) {
              result = { error: 'Project/module/task not found. Use getProjectDetails to retrieve correct IDs.' };
              break;
            }

            const taskAssignmentIds = new Set(task.assignments.map((a) => a.id));
            const validIds = assignmentIds.filter((id) => taskAssignmentIds.has(id));
            const skippedIds = assignmentIds.filter((id) => !taskAssignmentIds.has(id));

            for (const assignmentId of validIds) {
              await Promise.resolve(onUpdateAssignmentResourceName(args.projectId, args.moduleId, args.taskId, assignmentId, args.resourceName) as any);
            }

            result = {
              success: true,
              requested: assignmentIds.length,
              updated: validIds.length,
              skipped: skippedIds.length,
              skippedIds,
            };
            break;
          }
          case 'updateSchedule': onUpdateAssignmentSchedule(args.assignmentId, args.startDate, args.duration); result = { success: true }; break;
          case 'updateAllocation': {
            if (!onUpdateAllocationByAssignment) {
              result = { error: 'Allocation update is not enabled in this app instance.' };
              break;
            }
            const value = Number(args.value);
            if (!Number.isFinite(value)) {
              result = { error: 'Invalid allocation value. Provide a numeric value.' };
              break;
            }
            const dayDate = args.dayDate ? String(args.dayDate).trim() : undefined;
            if (dayDate && !/^\d{4}-\d{2}-\d{2}$/.test(dayDate)) {
              result = { error: 'Invalid dayDate format. Use YYYY-MM-DD.' };
              break;
            }
            onUpdateAllocationByAssignment(args.assignmentId, args.weekId, value, dayDate);
            result = { success: true };
            break;
          }
          case 'updateProgress': {
            const rawProgress = Number(args.progress);
            if (!Number.isFinite(rawProgress)) {
              result = { error: 'Invalid progress value. Provide a number between 0 and 100.' };
              break;
            }
            const progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
            onUpdateAssignmentProgress(args.assignmentId, progress);
            result = { success: true, progress };
            break;
          }
          case 'updateActualDate': {
            if (!onUpdateAssignmentActualDate) {
              result = { error: 'Actual date update is not enabled in this app instance.' };
              break;
            }
            const allAssignments = projectsRef.current.flatMap((p) => p.modules.flatMap((m) => m.tasks.flatMap((t) => t.assignments)));
            const target = allAssignments.find((a) => a.id === args.assignmentId);
            if (!target) {
              result = { error: `Assignment '${args.assignmentId}' not found. Use getProjectDetails to retrieve correct IDs.` };
              break;
            }
            const rawDate = args.actualDate;
            const actualDate = (!rawDate || rawDate === 'null' || rawDate === 'undefined') ? null : String(rawDate).trim();
            if (actualDate && !/^\d{4}-\d{2}-\d{2}$/.test(actualDate)) {
              result = { error: 'Invalid actualDate format. Use YYYY-MM-DD.' };
              break;
            }
            onUpdateAssignmentActualDate(args.assignmentId, actualDate);
            result = { success: true, assignmentId: args.assignmentId, actualDate: actualDate || null };
            break;
          }
          case 'updateActualDateBulk': {
            if (!onUpdateAssignmentActualDate) {
              result = { error: 'Actual date update is not enabled in this app instance.' };
              break;
            }
            const ids = Array.isArray(args.assignmentIds)
              ? Array.from(new Set(args.assignmentIds.map((id: any) => String(id).trim()).filter(Boolean)))
              : [];
            if (ids.length === 0) {
              result = { error: 'assignmentIds must be a non-empty array of IDs.' };
              break;
            }

            const rawDate = args.actualDate;
            const actualDate = (!rawDate || rawDate === 'null' || rawDate === 'undefined') ? null : String(rawDate).trim();
            if (actualDate && !/^\d{4}-\d{2}-\d{2}$/.test(actualDate)) {
              result = { error: 'Invalid actualDate format. Use YYYY-MM-DD.' };
              break;
            }

            const allAssignments = projectsRef.current.flatMap((p) => p.modules.flatMap((m) => m.tasks.flatMap((t) => t.assignments)));
            const validSet = new Set(allAssignments.map((a) => a.id));
            const validIds = ids.filter((id) => validSet.has(id));
            const skippedIds = ids.filter((id) => !validSet.has(id));

            for (const assignmentId of validIds) {
              await Promise.resolve(onUpdateAssignmentActualDate(assignmentId, actualDate) as any);
            }

            result = {
              success: true,
              requested: ids.length,
              updated: validIds.length,
              skipped: skippedIds.length,
              actualDate: actualDate || null,
              skippedIds,
            };
            break;
          }
          case 'syncModuleActualDatesToPlannedEnd': {
            if (!onUpdateAssignmentActualDate) {
              result = { error: 'Actual date update is not enabled in this app instance.' };
              break;
            }
            const project = projectsRef.current.find((p) => p.id === args.projectId);
            const module = project?.modules.find((m) => m.id === args.moduleId);
            if (!module) {
              result = { error: 'Module not found. Use getProjectDetails to obtain correct IDs.' };
              break;
            }

            const resourceFilter = Array.isArray(args.resourceNames)
              ? new Set(args.resourceNames.map((n: any) => String(n).trim().toLowerCase()).filter(Boolean))
              : null;

            let requested = 0;
            let updated = 0;
            const skipped: Array<{ assignmentId: string; reason: string }> = [];

            for (const task of module.tasks) {
              for (const assignment of task.assignments) {
                const resourceName = String(assignment.resourceName || 'Unassigned');
                if (resourceFilter && !resourceFilter.has(resourceName.toLowerCase())) {
                  continue;
                }
                requested += 1;

                if (!assignment.startDate || !Number.isFinite(Number(assignment.duration)) || Number(assignment.duration) <= 0) {
                  skipped.push({ assignmentId: assignment.id, reason: 'Missing or invalid startDate/duration' });
                  continue;
                }

                const plannedEnd = addWorkingDaysInclusive(parseYmd(assignment.startDate), Number(assignment.duration));
                const plannedEndYmd = fmt(plannedEnd);
                await Promise.resolve(onUpdateAssignmentActualDate(assignment.id, plannedEndYmd) as any);
                updated += 1;
              }
            }

            result = {
              success: true,
              moduleId: module.id,
              moduleName: module.name,
              requested,
              updated,
              skipped: skipped.length,
              skippedAssignments: skipped,
            };
            break;
          }
          case 'copyAssignment': {
            if (!onCopyAssignmentById) {
              result = { error: 'Copy assignment is not enabled in this app instance.' };
              break;
            }
            onCopyAssignmentById(args.assignmentId);
            result = { success: true };
            break;
          }
          case 'reorderModules': {
            if (!onReorderModules) {
              result = { error: 'Module reordering is not enabled in this app instance.' };
              break;
            }
            onReorderModules(args.projectId, Number(args.startIndex), Number(args.endIndex));
            result = { success: true };
            break;
          }
          case 'reorderTasks': {
            if (!onReorderTasks) {
              result = { error: 'Task reordering is not enabled in this app instance.' };
              break;
            }
            onReorderTasks(args.projectId, args.moduleId, Number(args.startIndex), Number(args.endIndex));
            result = { success: true };
            break;
          }
          case 'moveTask': {
            if (!onMoveTask) {
              result = { error: 'Task move is not enabled in this app instance.' };
              break;
            }
            onMoveTask(args.projectId, args.sourceModuleId, args.targetModuleId, Number(args.sourceIndex), Number(args.targetIndex));
            result = { success: true };
            break;
          }
          case 'updateModuleType': {
            if (!onUpdateModuleType) {
              result = { error: 'Module type update is not enabled in this app instance.' };
              break;
            }
            const moduleType = String(args.type) as ModuleType;
            if (!Object.values(ModuleType).includes(moduleType)) {
              result = { error: `Invalid module type. Use one of: ${Object.values(ModuleType).join(', ')}` };
              break;
            }
            onUpdateModuleType(args.projectId, args.moduleId, moduleType);
            result = { success: true, type: moduleType };
            break;
          }
          case 'reorderAssignments': {
            if (!onReorderAssignments) {
              result = { error: 'Assignment reordering is not enabled in this app instance.' };
              break;
            }
            onReorderAssignments(args.projectId, args.moduleId, args.taskId, Number(args.startIndex), Number(args.endIndex));
            result = { success: true };
            break;
          }
          case 'shiftTaskTimeline': {
            if (!onShiftTask) {
              result = { error: 'Task timeline shift is not enabled in this app instance.' };
              break;
            }
            const dir = String(args.direction) as 'left' | 'right' | 'left-working' | 'right-working';
            if (!['left', 'right', 'left-working', 'right-working'].includes(dir)) {
              result = { error: 'Invalid direction. Use left, right, left-working, or right-working.' };
              break;
            }
            onShiftTask(args.projectId, args.moduleId, args.taskId, dir);
            result = { success: true, direction: dir };
            break;
          }
          case 'setDependency': {
            // Normalise parentAssignmentId: LLM sometimes sends the string "null" instead of JSON null
            const rawParent = args.parentAssignmentId;
            const parentId: string | null = (!rawParent || rawParent === 'null' || rawParent === 'undefined') ? null : rawParent;
            // Validate child assignment exists
            const allAssignments = projectsRef.current.flatMap(p => p.modules.flatMap(m => m.tasks.flatMap(t => t.assignments)));
            const childExists = allAssignments.some(a => a.id === args.childAssignmentId);
            if (!childExists) { result = { error: `Assignment '${args.childAssignmentId}' not found. Use getProjectDetails to retrieve correct IDs.` }; break; }
            onUpdateAssignmentDependency(args.childAssignmentId, parentId);
            result = { success: true, action: parentId ? `dependency set to ${parentId}` : 'dependency removed' };
            break;
          }
          case 'clearModuleDependencies': {
            const proj = projectsRef.current.find(p => p.id === args.projectId);
            const mod = proj?.modules.find(m => m.id === args.moduleId);
            if (!mod) { result = { error: 'Module not found. Use listProjects/getProjectDetails to find IDs.' }; break; }
            let cleared = 0;
            mod.tasks.forEach(t => t.assignments.forEach(a => {
              if (a.parentAssignmentId) {
                onUpdateAssignmentDependency(a.id, null);
                cleared++;
              }
            }));
            result = { success: true, cleared, message: `Cleared ${cleared} dependency link(s) in module '${mod.name}'` };
            break;
          }
          case 'deleteProject':
          case 'deleteModule':
          case 'deleteTask':
          case 'deleteAssignment':
            result = { success: false, error: DELETE_BLOCK_MESSAGE };
            break;
          case 'listResources': result = resourcesRef.current.map(r => ({ name: r.name, category: r.category })); break;
        }
      } catch (e: any) { result = { error: e.message }; }
      const toolContent = truncateText(JSON.stringify(result), MAX_TOOL_CONTENT_CHARS);
      results.push({ role: 'tool', tool_call_id: call.id, content: toolContent });
    }

    if (shouldCollapseResourceRows) {
      onCollapseAllResourceRows?.();
    }

    return results;
  }, [onAddProject, onAddModule, onAddTask, onAddAssignment, onUpdateProjectName, onUpdateModuleName, onUpdateTaskName, onUpdateAssignmentResourceName, onUpdateAssignmentSchedule, onUpdateAssignmentProgress, onUpdateAssignmentActualDate, onUpdateAllocationByAssignment, onCopyAssignmentById, onReorderModules, onReorderTasks, onMoveTask, onUpdateModuleType, onReorderAssignments, onShiftTask, onUpdateAssignmentDependency, onDeleteProject, onDeleteModule, onDeleteTask, onDeleteAssignment, onCollapseAllResourceRows]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    guardedTimelineProjectIdsRef.current.clear();
    const userMsg: Message = { id: createSafeId(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      if (!token) throw new Error('GitHub token not set. Click the gear icon to configure.');
      conversationHistory.current.push({ role: 'user', content: userMsg.text });
      let turns = 0;
      let finalContent = '';
      let modelIndex = 0;
      while (turns < 16) {
        const modelHistory = prepareHistoryForModel(conversationHistory.current);
        const model = MODEL_CANDIDATES[modelIndex];
        const res = await fetch('/api/github-models', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...modelHistory], tools: TOOLS, tool_choice: 'auto' }),
        });
        if (!res.ok) {
          let m = `API Error: ${res.status}`;
          try {
            const d = await res.json();
            m = d.error?.message || m;
          } catch {}

          // If current model is rate-limited, try the next model automatically.
          if (isRateLimitError(m) && modelIndex < MODEL_CANDIDATES.length - 1) {
            modelIndex += 1;
            continue;
          }
          throw new Error(m);
        }
        const data = await res.json();
        const msg = data.choices[0].message;
        conversationHistory.current.push(msg);
        if (msg.tool_calls?.length) {
          const toolResults = await executeTools(msg.tool_calls);
          conversationHistory.current.push(...toolResults);
          // Proactively trim if history is getting large
          if (conversationHistory.current.length > HISTORY_TRIM_THRESHOLD) {
            conversationHistory.current = proactivelyTrimHistory(conversationHistory.current, MAX_HISTORY_MESSAGES);
          }
          turns++;
        } else { finalContent = msg.content || ''; break; }
      }
      setMessages(prev => [...prev, { id: createSafeId(), role: 'assistant', text: finalContent || 'Done.' }]);
    } catch (err: any) {
      const msg = String(err?.message || 'Unknown error');
      const isTooLarge = msg.toLowerCase().includes('request body too large');
      
      // If context is too large, trim history and retry once
      if (isTooLarge && conversationHistory.current.length > HISTORY_TRIM_THRESHOLD) {
        // Keep system message, trim to last MAX_HISTORY_MESSAGES, then retry
        conversationHistory.current = conversationHistory.current.slice(-Math.max(20, MAX_HISTORY_MESSAGES - 10));
        
        // Retry the request with trimmed history
        try {
          const modelHistory = prepareHistoryForModel(conversationHistory.current);
          const model = MODEL_CANDIDATES[0];
          const retryRes = await fetch('/api/github-models', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...modelHistory], tools: TOOLS, tool_choice: 'auto' }),
          });
          if (retryRes.ok) {
            const retryData = await retryRes.json();
            const retryMsg = retryData.choices[0].message;
            conversationHistory.current.push(retryMsg);
            const finalContent = retryMsg.content || '';
            setMessages(prev => [...prev, { id: createSafeId(), role: 'assistant', text: finalContent || 'Done.' }]);
            return; // Success
          }
        } catch {}
        // If retry fails, show helpful message
        setMessages(prev => [...prev, { id: createSafeId(), role: 'assistant', text: 'Context was too large. I trimmed the chat history. Please try your last request again, or clear with the trash icon to start fresh.' }]);
      } else {
        const waitSeconds = parseRateLimitWaitSeconds(msg);
        const waitMinutes = waitSeconds ? Math.max(1, Math.ceil(waitSeconds / 60)) : null;

        const friendly = isTooLarge
          ? 'Your request context got too large. I trimmed the chat history. Please try again, or start a new chat with the trash icon for best results.'
          : isRateLimitError(msg)
            ? `Rate limit reached for the AI endpoint. Please retry in about ${waitMinutes ?? '?'} minute(s).`
          : `Error: ${msg}`;
        setMessages(prev => [...prev, { id: createSafeId(), role: 'assistant', text: friendly }]);
      }
    } finally { setIsLoading(false); }
  };

  // Full-height panel layout (no modal)
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-slate-900 px-4 py-3 flex items-center justify-between text-white shadow-sm border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold text-base">
          <Bot size={20} />
          <span>AI Copilot</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowSettings(!showSettings)} className="hover:bg-slate-700 p-1.5 rounded transition-colors" title="Token Settings"><Settings size={18} /></button>
          <button onClick={() => { setMessages([]); conversationHistory.current = []; }} className="hover:bg-slate-700 p-1.5 rounded transition-colors" title="Clear Chat"><Trash2 size={18} /></button>
        </div>
      </div>

      {showSettings ? (
        /* Settings Panel */
        <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Logged-in status banner */}
            {githubUser && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg sticky top-0">
                <img src={githubUser.avatar_url} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-green-800 truncate">Signed in as {githubUser.login}</div>
                </div>
                {onGitHubLogout && (
                  <button onClick={onGitHubLogout} className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 flex-shrink-0">
                    <LogOut size={14} /> Sign out
                  </button>
                )}
              </div>
            )}

            {!githubToken && (
              <>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Sign in with GitHub to enable AI features, or paste a Personal Access Token with <code className="bg-slate-200 px-1 rounded text-[11px]">models:read</code> scope.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">OAuth App Client ID</label>
                  <input type="text" value={githubClientId || ''} onChange={e => onGitHubClientIdChange?.(e.target.value)} placeholder="Ov23li..." className="w-full p-2.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500 outline-none font-mono bg-white" />
                  <p className="text-[11px] text-slate-500 leading-relaxed">Use the client ID from your GitHub OAuth App settings, not your email address. Device flow must be enabled in app settings.</p>
                </div>
                {!githubDeviceCode && githubLoginStatus !== 'polling' && (
                  <button onClick={onGitHubLogin} disabled={!githubClientId?.trim() || githubLoginStatus === 'waiting'} className="w-full py-2 bg-slate-900 text-white rounded text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    {githubLoginStatus === 'waiting' ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                    {githubLoginStatus === 'waiting' ? 'Starting...' : 'Sign in with GitHub'}
                  </button>
                )}
                {githubDeviceCode && githubLoginStatus === 'polling' && (
                  <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
                    <p className="text-xs text-slate-600 font-medium">1. Copy this code:</p>
                    <div className="flex items-center justify-center gap-2 bg-slate-50 p-3 rounded border border-slate-200">
                      <code className="text-3xl font-bold tracking-[0.4em] text-slate-900 select-all">{githubDeviceCode.user_code}</code>
                      <button onClick={() => { void copyTextSafe(githubDeviceCode.user_code); }} className="p-1.5 hover:bg-slate-200 rounded flex-shrink-0" title="Copy code"><Copy size={16} className="text-slate-500" /></button>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">2. Open GitHub and enter the code:</p>
                    <a href={githubDeviceCode.verification_uri} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition-colors">
                      <ExternalLink size={14} /> Open GitHub
                    </a>
                    <button onClick={onGitHubCheckNow} disabled={isGitHubCheckNowLoading} className="w-full py-2 bg-slate-100 border border-slate-300 text-slate-700 rounded text-xs font-medium hover:bg-slate-200 disabled:opacity-60 transition-colors">
                      {isGitHubCheckNowLoading ? 'Checking now...' : 'I have authorized, check now'}
                    </button>
                    {githubLoginMessage && <div className="text-[11px] text-slate-500 text-center p-2 bg-slate-50 rounded border border-slate-100">{githubLoginMessage}</div>}
                  </div>
                )}
                {githubLoginStatus === 'success' && <div className="text-xs text-green-600 flex items-center gap-2 p-2 bg-green-50 rounded border border-green-100"><CheckCircle size={14} /> {githubLoginMessage || 'Signed in!'}</div>}
                {githubLoginStatus === 'error' && <div className="text-xs text-red-600 flex items-center gap-2 p-2 bg-red-50 rounded border border-red-100"><AlertCircle size={14} /> {githubLoginMessage || 'Sign-in failed.'}</div>}
                <div className="border-t border-slate-200 pt-3"></div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase block">Personal Access Token</label>
                  <input type="password" value={localToken} onChange={e => setLocalToken(e.target.value)} placeholder="github_pat_..." className="w-full p-2.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-slate-500 focus:border-slate-500 outline-none bg-white" />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={testConnection} disabled={testStatus === 'testing' || !token} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-2 rounded font-medium disabled:opacity-50 flex items-center gap-1">
                    {testStatus === 'testing' && <Loader2 size={14} className="animate-spin" />}
                    Test Connection
                  </button>
                  {testStatus === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={14} /> Connected</span>}
                  {testStatus === 'error' && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {testMessage}</span>}
                </div>
              </>
            )}

            {githubToken && !showSettings && (
              <div className="text-xs text-slate-500 text-center py-2">Token configured ✓</div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-3 border-t border-slate-200 bg-white flex-shrink-0">
            <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded transition-colors">Done</button>
            {!githubToken && <button onClick={() => handleSaveKey(localToken)} className="px-4 py-1.5 text-sm bg-slate-900 text-white rounded hover:bg-slate-800 font-medium transition-colors">Save</button>}
          </div>
        </div>
      ) : (
        /* Chat View */
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm py-12">
                <Sparkles className="w-12 h-12 mb-3 text-slate-300" />
                <p className="font-medium">Welcome to AI Copilot</p>
                <p className="text-xs text-slate-500 mt-2 text-center px-4">Try asking me to:</p>
                <ul className="text-xs text-slate-500 mt-3 space-y-1 text-center">
                  <li>• Show me all projects</li>
                  <li>• Add a task called "API Integration"</li>
                  <li>• Update project schedule</li>
                </ul>
                {!token && (
                  <div className="mt-6 text-center">
                    <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded border border-red-100 mb-2">Sign in with GitHub to enable AI features</p>
                    <button onClick={() => setShowSettings(true)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors font-medium">
                      <LogIn size={14} /> Open GitHub Sign-in
                    </button>
                  </div>
                )}
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${msg.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`flex-1 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`px-3 py-2 rounded-lg text-sm leading-relaxed max-w-[85%] ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'}`}>
                    <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 animate-in fade-in">
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-700"><Bot size={16} /></div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-slate-200 p-3 flex-shrink-0">
            <form onSubmit={handleSend} className="flex gap-2 items-end">
              <textarea 
                ref={textareaRef}
                value={input} 
                onChange={(e) => {
                  setInput(e.target.value);
                  if (textareaRef.current) {
                    textareaRef.current.style.height = 'auto';
                    textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 400) + 'px';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                placeholder={token ? 'Ask anything... (Shift+Enter for new line)' : 'Sign in to chat'} 
                disabled={!token} 
                rows={2}
                className="flex-1 bg-slate-100 border-none rounded-lg px-4 py-2 text-sm placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50 transition-colors resize-none overflow-y-auto max-h-[400px] leading-relaxed"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading || !token} 
                className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Send message (or press Enter)"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
