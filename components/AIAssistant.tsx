
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Sparkles, User, Loader2, ChevronDown, Trash2, Maximize2, Minimize2 } from 'lucide-react';
import { Project, Resource, Role } from '../types';

interface AIAssistantProps {
  projects: Project[];
  resources: Resource[];
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
  onAssignResource: (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

// Groq/OpenAI Compatible Types
interface GroqToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ projects, resources, onAddTask, onAssignResource }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const projectsRef = useRef(projects);
  const resourcesRef = useRef(resources);
  
  // We maintain a separate history for the LLM context to handle tool calls correctly without cluttering the UI
  const conversationHistory = useRef<GroqMessage[]>([]);

  // Keep refs updated for tool usage
  useEffect(() => {
    projectsRef.current = projects;
    resourcesRef.current = resources;
  }, [projects, resources]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  const getApiKey = () => {
    // 1. Check standard Vite variables (prefixed with VITE_)
    if ((import.meta as any).env.VITE_GROQ_API_KEY) return (import.meta as any).env.VITE_GROQ_API_KEY;
    if ((import.meta as any).env.VITE_API_KEY) return (import.meta as any).env.VITE_API_KEY;

    // 2. Check injected process.env variables (from vite.config.ts define)
    // We use a try-catch and specific checks to ensure safe replacement by the bundler
    try {
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env?.GROQ_API_KEY) return process.env.GROQ_API_KEY;
      // @ts-ignore
      if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    } catch (e) {
      // Fallback for safety
    }
    
    return null;
  };

  const executeTools = async (toolCalls: GroqToolCall[]): Promise<GroqMessage[]> => {
    const results: GroqMessage[] = [];

    for (const call of toolCalls) {
      const functionName = call.function.name;
      let functionArgs: any = {};
      
      try {
        functionArgs = JSON.parse(call.function.arguments);
      } catch (e) {
        console.error("Failed to parse tool arguments", e);
      }

      let result: any = { error: 'Unknown function' };

      try {
        if (functionName === 'listProjects') {
          result = projectsRef.current.map(p => ({ id: p.id, name: p.name, moduleCount: p.modules.length }));
        } else if (functionName === 'getProjectDetails') {
          const { projectId } = functionArgs;
          const project = projectsRef.current.find(p => p.id === projectId);
          if (project) {
            result = {
              name: project.name,
              modules: project.modules.map(m => ({
                id: m.id,
                name: m.name,
                tasks: m.tasks.map(t => ({ 
                  id: t.id, 
                  name: t.name, 
                  assignments: t.assignments.map(a => ({ id: a.id, resource: a.resourceName })) 
                }))
              }))
            };
          } else {
            result = { error: 'Project not found' };
          }
        } else if (functionName === 'addTask') {
          const { projectId, moduleId, taskName, role } = functionArgs;
          const newTaskId = crypto.randomUUID();
          const roleEnum = Object.values(Role).includes(role as Role) ? role as Role : Role.DEV;
          onAddTask(projectId, moduleId, newTaskId, taskName, roleEnum);
          result = { success: true, taskId: newTaskId, message: `Task '${taskName}' added.` };
        } else if (functionName === 'assignResource') {
          const { projectId, moduleId, taskId, resourceName } = functionArgs;
          const project = projectsRef.current.find(p => p.id === projectId);
          const module = project?.modules.find(m => m.id === moduleId);
          const task = module?.tasks.find(t => t.id === taskId);

          if (task && task.assignments.length > 0) {
            const assignmentId = task.assignments[0].id;
            onAssignResource(projectId, moduleId, taskId, assignmentId, resourceName);
            result = { success: true, message: `Assigned ${resourceName} to task.` };
          } else {
            result = { error: 'Task or assignment slot not found. Create a task first.' };
          }
        }
      } catch (e: any) {
        result = { error: e.message };
      }

      results.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
    }

    return results;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error("API Key not found. Please set VITE_GROQ_API_KEY or API_KEY in your environment.");

      // Add user message to LLM history
      conversationHistory.current.push({ role: 'user', content: userMsg.text });

      const systemMessage: GroqMessage = {
        role: 'system',
        content: `You are an expert Project Management AI Assistant for the OMS Resource Master system. 
          Your goal is to help the user manage their project plans, tasks, and resources.
          
          Current Date: ${new Date().toLocaleDateString()}
          
          Guidelines:
          - Be concise and helpful.
          - Use tools to query project structure or perform actions.
          - When adding tasks, default to 'Dev Team' role if not specified.
          - If a user asks about "allocation" or "timeline", explain that you can add tasks/assignments but they should view the visual grid for timeline adjustments.`
      };

      const toolsDefinition = [
        {
          type: "function",
          function: {
            name: "listProjects",
            description: "Get a list of all projects with their IDs and module counts.",
            parameters: { type: "object", properties: {}, required: [] },
          },
        },
        {
          type: "function",
          function: {
            name: "getProjectDetails",
            description: "Get detailed structure (modules and tasks) of a specific project.",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "The ID of the project" }
              },
              required: ["projectId"]
            },
          },
        },
        {
          type: "function",
          function: {
            name: "addTask",
            description: "Add a new task to a specific module in a project.",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "The ID of the project" },
                moduleId: { type: "string", description: "The ID of the module" },
                taskName: { type: "string", description: "Name of the task" },
                role: { type: "string", description: "Primary role needed (e.g., DEV, BA, QA)" }
              },
              required: ["projectId", "moduleId", "taskName"]
            },
          },
        },
        {
          type: "function",
          function: {
            name: "assignResource",
            description: "Assign a resource to a task assignment.",
            parameters: {
              type: "object",
              properties: {
                projectId: { type: "string", description: "The ID of the project" },
                moduleId: { type: "string", description: "The ID of the module" },
                taskId: { type: "string", description: "The ID of the task" },
                resourceName: { type: "string", description: "Name of the resource to assign" }
              },
              required: ["projectId", "moduleId", "taskId", "resourceName"]
            },
          },
        },
      ];

      // Loop to handle potential multiple tool calls (max 5 turns to prevent infinite loops)
      let turnCount = 0;
      let finalContent = '';

      while (turnCount < 5) {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [systemMessage, ...conversationHistory.current],
            tools: toolsDefinition,
            tool_choice: "auto"
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error?.message || 'Groq API Error');
        }

        const data = await response.json();
        const choice = data.choices[0];
        const message = choice.message;

        // Append assistant message to history
        conversationHistory.current.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
          // Execute tools and loop back
          const toolResults = await executeTools(message.tool_calls);
          conversationHistory.current.push(...toolResults);
          turnCount++;
        } else {
          // Final response
          finalContent = message.content;
          break;
        }
      }

      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: finalContent || "Done." }]);

    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMessage = error.message || "Unknown error";
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: `Sorry, I encountered an error: ${errorMessage}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-20 right-4 bg-indigo-600 text-white rounded-full p-3 shadow-lg hover:bg-indigo-700 z-50 transition-all hover:scale-105"
        title="Open AI Assistant"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-50 animate-in fade-in slide-in-from-bottom-5 overflow-hidden font-sans">
      <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2 font-semibold">
          <Bot size={20} />
          <span>AI Assistant (Groq)</span>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setMessages([])} className="hover:bg-indigo-500 p-1 rounded transition-colors" title="Clear Chat"><Trash2 size={18} /></button>
            <button onClick={toggleOpen} className="hover:bg-indigo-500 p-1 rounded transition-colors"><X size={18} /></button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
            <div className="text-center text-slate-400 mt-10 text-sm">
                <Sparkles className="w-10 h-10 mx-auto mb-2 text-indigo-300" />
                <p>Hi! I can help you plan resources.</p>
                <p>Try "Add a backend task to Project X"</p>
            </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-600'}`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={`p-3 rounded-2xl text-sm max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-slate-600"><Bot size={16} /></div>
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-slate-500 text-xs">
                    <Loader2 size={14} className="animate-spin" /> Thinking...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
        <input 
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask me to add tasks or check status..."
          className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading}
          className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};
