import React, { useState } from 'react';
import { Project, Role } from '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { Sparkles, X, LoaderCircle, AlertTriangle } from 'lucide-react';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanGenerated: (projects: Project[]) => void;
}

const responseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The name of the project." },
      modules: {
        type: Type.ARRAY,
        description: "A list of modules within the project.",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "The name of the module." },
            functionPoints: { type: Type.INTEGER, description: "An estimated size of this module in Function Points (FP)." },
            tasks: {
              type: Type.ARRAY,
              description: "A list of tasks required to complete the module.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The name of the task." },
                  assignments: {
                    type: Type.ARRAY,
                    description: "A list of roles assigned to this task.",
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        role: { 
                          type: Type.STRING, 
                          description: `The role required for the task. Must be one of: ${Object.values(Role).join(', ')}`
                        },
                      },
                      required: ['role']
                    }
                  }
                },
                required: ['name', 'assignments']
              }
            }
          },
          required: ['name', 'functionPoints', 'tasks']
        }
      }
    },
    required: ['name', 'modules']
  }
};


export const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, onPlanGenerated }) => {
  const [prompt, setPrompt] = useState('An e-commerce OMS with modules for order capture, inventory management, and fulfillment. It should integrate with Shopify and a 3rd party logistics provider.');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a project description.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

      const fullPrompt = `
        You are an expert project manager specializing in Order Management System (OMS) implementations.
        Based on the following project description, generate a detailed project plan for a single project.
        The plan should include relevant modules, and for each module, a list of tasks with appropriate team roles assigned.
        Return the plan as a JSON object that adheres to the provided schema.
        
        Project Description: "${prompt}"
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: responseSchema,
        },
      });

      const jsonText = response.text.trim();
      const generatedProjects = JSON.parse(jsonText) as Project[];
      
      // Validate roles
      const validRoles = new Set(Object.values(Role));
      generatedProjects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments = t.assignments.filter(a => validRoles.has(a.role));
            });
        });
      });

      onPlanGenerated(generatedProjects);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate plan. Please check your API key and try again. Details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            AI Project Assistant
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-4">
          <div>
            <label htmlFor="ai-prompt" className="block text-sm font-medium text-slate-700 mb-2">
              Describe your project
            </label>
            <textarea
              id="ai-prompt"
              rows={5}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="e.g., An OMS for a fashion brand with inventory and fulfillment modules..."
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">Provide a high-level overview. The AI will structure it into modules, tasks, and roles.</p>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Generation Failed</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </main>

        <footer className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl flex justify-end">
          <button 
            onClick={handleGenerate} 
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-wait"
          >
            {isLoading ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
               <>
                <Sparkles size={16} />
                Generate Plan
               </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
};
