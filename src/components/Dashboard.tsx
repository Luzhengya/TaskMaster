import React, { useState } from 'react';
import { ParentTask, SubTask } from '../types';
import { Plus, Calendar, Clock, AlertTriangle, ChevronRight, Trash2, Download } from 'lucide-react';
import { taskService } from '../services/taskService';
import * as XLSX from 'xlsx';

interface DashboardProps {
  parentTasks: ParentTask[];
  onSelectTask: (task: ParentTask) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ parentTasks, onSelectTask }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDeadline) return;
    
    await taskService.addParentTask({
      name: newName,
      deadline: newDeadline,
      planned_hours: 1
    });
    
    setNewName('');
    setNewDeadline('');
    setIsAdding(false);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // In a real app, we'd fetch all subtasks for all parent tasks
      // For this demo, we'll just export the parent tasks list as a summary
      const data = parentTasks.map(t => ({
        'Project Name': t.name,
        'Deadline': t.deadline,
        'Planned Hours': t.planned_hours,
        'Created At': new Date(t.created_at).toLocaleDateString()
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "WeeklyReport");
      XLSX.writeFile(wb, `Weekly_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold">Project Overview</h2>
          <p className="text-gray-500">Manage your main cases and deadlines</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-black/5 text-gray-600 rounded-2xl font-medium shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <Download size={20} />
            <span>{isExporting ? 'Exporting...' : 'Weekly Report'}</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-medium shadow-lg hover:bg-[#4A4A30] transition-all"
          >
            <Plus size={20} />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Project Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                placeholder="e.g. System Upgrade 2026"
                required
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Deadline</label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5A5A40]/20"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-6 py-3 bg-[#5A5A40] text-white rounded-xl font-medium"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentTasks.map((task) => (
          <div
            key={task.id}
            className="group bg-white rounded-3xl p-6 shadow-sm border border-black/5 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative"
            onClick={() => onSelectTask(task)}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-[#F5F5F0] rounded-2xl text-[#5A5A40]">
                <Calendar size={24} />
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this project and all its sub-tasks?')) {
                    taskService.deleteParentTask(task.id);
                  }
                }}
                className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <h3 className="text-xl font-serif font-bold mb-2 group-hover:text-[#5A5A40] transition-colors">
              {task.name}
            </h3>
            
            <div className="space-y-3 mt-6">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>Deadline: {task.deadline}</span>
              </div>
              
              <div className="pt-4 flex items-center justify-between border-t border-black/5">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">View Details</span>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-[#5A5A40] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        ))}

        {parentTasks.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center bg-white/50 rounded-3xl border border-dashed border-gray-300">
            <p className="text-gray-400 italic">No projects found. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
