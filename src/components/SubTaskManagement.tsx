import React, { useState, useEffect } from 'react';
import { ParentTask, SubTask, SubTaskStatus, Priority } from '../types';
import { taskService } from '../services/taskService';
import { 
  Plus, 
  Lock, 
  Unlock, 
  Trash2, 
  Save, 
  AlertCircle, 
  ChevronLeft,
  Copy
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SubTaskManagementProps {
  parentTask: ParentTask;
  onBack: () => void;
}

export const SubTaskManagement: React.FC<SubTaskManagementProps> = ({ parentTask, onBack }) => {
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isLocked, setIsLocked] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = taskService.subscribeSubTasks(parentTask.id, setSubTasks);
    return () => unsubscribe();
  }, [parentTask.id]);

  const handleAddRow = async () => {
    await taskService.addSubTask({
      parent_task_id: parentTask.id,
      system: '',
      month: '',
      daily_report_date: new Date().toISOString().split('T')[0],
      start_date: '',
      due_date: '',
      final_deadline: '',
      status: '未着手',
      task_name: 'New Task',
      planned_hours: 0,
      actual_hours: 0,
      priority: 'B',
      remarks: '',
      week_number: 0,
      flag: 0
    });
  };

  const handleUpdate = async (id: string, updates: Partial<SubTask>) => {
    await taskService.updateSubTask(id, updates);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this task?')) {
      await taskService.deleteSubTask(id);
    }
  };

  const statusColors: Record<SubTaskStatus, string> = {
    '遅れ': 'bg-red-100 text-red-700',
    '済': 'bg-green-100 text-green-700',
    '進行中': 'bg-blue-100 text-blue-700',
    '未着手': 'bg-gray-100 text-gray-700',
    '保留': 'bg-yellow-100 text-yellow-700',
    '着着手遅れ': 'bg-orange-100 text-orange-700',
    '期限遅れ': 'bg-red-200 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-serif font-bold">{parentTask.name}</h2>
            <p className="text-gray-500">Deadline: {parentTask.deadline}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all",
              isLocked ? "bg-gray-100 text-gray-500" : "bg-[#5A5A40] text-white shadow-md"
            )}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
          </button>
          {!isLocked && (
            <button
              onClick={handleAddRow}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#5A5A40] text-[#5A5A40] rounded-xl font-medium hover:bg-[#5A5A40] hover:text-white transition-all"
            >
              <Plus size={18} />
              <span>Add Task</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-bottom border-black/5">
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">System</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Task Name</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Deadline</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Planned</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Actual</th>
                <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Priority</th>
                {!isLocked && <th className="px-4 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {subTasks.map((task) => {
                const isOverdue = task.final_deadline && task.final_deadline > parentTask.deadline;
                
                return (
                  <tr 
                    key={task.id} 
                    className={cn(
                      "group transition-colors",
                      isOverdue ? "bg-red-50" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={task.system}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { system: e.target.value })}
                        className="w-full bg-transparent focus:outline-none disabled:cursor-default"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={task.task_name}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { task_name: e.target.value })}
                        className="w-full bg-transparent font-medium focus:outline-none disabled:cursor-default"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { status: e.target.value as SubTaskStatus })}
                        className={cn(
                          "px-2 py-1 rounded-lg text-xs font-bold focus:outline-none disabled:appearance-none",
                          statusColors[task.status]
                        )}
                      >
                        {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={task.final_deadline}
                          disabled={isLocked}
                          onChange={(e) => handleUpdate(task.id, { final_deadline: e.target.value })}
                          className={cn(
                            "bg-transparent focus:outline-none disabled:appearance-none",
                            isOverdue && "text-red-600 font-bold"
                          )}
                        />
                        {isOverdue && <AlertCircle size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={task.planned_hours}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { planned_hours: Number(e.target.value) })}
                        className="w-16 bg-transparent focus:outline-none disabled:cursor-default"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={task.actual_hours}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { actual_hours: Number(e.target.value) })}
                        className="w-16 bg-transparent focus:outline-none disabled:cursor-default"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.priority}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { priority: e.target.value as Priority })}
                        className="bg-transparent focus:outline-none disabled:appearance-none"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </td>
                    {!isLocked && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {subTasks.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-gray-400 italic">No sub-tasks found. Import from Excel or add manually.</p>
          </div>
        )}
      </div>
    </div>
  );
};
