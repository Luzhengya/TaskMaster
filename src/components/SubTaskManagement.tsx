import React, { useState, useEffect } from 'react';
import { ParentTask, SubTask, SubTaskStatus, Priority } from '../types';
import { taskService } from '../services/taskService';
import { 
  Plus, 
  Lock, 
  Unlock, 
  Trash2, 
  AlertCircle, 
  ChevronLeft,
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
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{parentTask.name}</h2>
            <p className="text-[#86868b]">最終期限: {parentTask.deadline}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
              isLocked ? "bg-gray-200 text-gray-600" : "bg-[#007aff] text-white shadow-sm"
            )}
          >
            {isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            <span>{isLocked ? '閲覧モード' : '編集モード'}</span>
          </button>
          {!isLocked && (
            <button
              onClick={handleAddRow}
              className="mac-button mac-button-secondary flex items-center gap-2"
            >
              <Plus size={18} />
              <span>タスク追加</span>
            </button>
          )}
        </div>
      </div>

      <div className="mac-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">システム</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">タスク名</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">ステータス</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">開始日</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">期日</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">期限</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest w-20">予定</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest w-20">実績</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">優先度</th>
                <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">備考</th>
                {!isLocked && <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subTasks.map((task) => {
                const isOverdue = task.final_deadline && task.final_deadline > parentTask.deadline;
                const isDelayed = task.status.includes('遅れ');
                
                return (
                  <tr 
                    key={task.id} 
                    className={cn(
                      "group transition-colors",
                      isOverdue ? "bg-red-50" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={task.system}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { system: e.target.value })}
                        className="w-full bg-transparent focus:outline-none disabled:cursor-default text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={task.task_name}
                          disabled={isLocked}
                          onChange={(e) => handleUpdate(task.id, { task_name: e.target.value })}
                          className="w-full bg-transparent font-medium focus:outline-none disabled:cursor-default text-sm"
                        />
                        {isDelayed && <AlertCircle size={14} className="text-red-500 animate-pulse" />}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={task.status}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { status: e.target.value as SubTaskStatus })}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold focus:outline-none disabled:appearance-none",
                          statusColors[task.status]
                        )}
                      >
                        {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={task.start_date || ''}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { start_date: e.target.value })}
                        className="bg-transparent focus:outline-none disabled:appearance-none text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="date"
                        value={task.due_date || ''}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { due_date: e.target.value })}
                        className="bg-transparent focus:outline-none disabled:appearance-none text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={task.final_deadline}
                          disabled={isLocked}
                          onChange={(e) => handleUpdate(task.id, { final_deadline: e.target.value })}
                          className={cn(
                            "bg-transparent focus:outline-none disabled:appearance-none text-sm",
                            isOverdue && "text-red-600 font-bold"
                          )}
                        />
                        {isOverdue && <AlertCircle size={14} className="text-red-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={isNaN(task.planned_hours) ? '' : task.planned_hours}
                        disabled={isLocked}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdate(task.id, { planned_hours: isNaN(val) ? 0 : val });
                        }}
                        className="w-16 bg-transparent focus:outline-none disabled:cursor-default text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={isNaN(task.actual_hours) ? '' : task.actual_hours}
                        disabled={isLocked}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          handleUpdate(task.id, { actual_hours: isNaN(val) ? 0 : val });
                        }}
                        className="w-16 bg-transparent focus:outline-none disabled:cursor-default text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={task.priority}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { priority: e.target.value as Priority })}
                        className="bg-transparent focus:outline-none disabled:appearance-none text-sm"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={task.remarks || ''}
                        disabled={isLocked}
                        onChange={(e) => handleUpdate(task.id, { remarks: e.target.value })}
                        className="w-full bg-transparent focus:outline-none disabled:cursor-default text-sm"
                        placeholder="備考..."
                      />
                    </td>
                    {!isLocked && (
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
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
            <p className="text-[#86868b] italic text-sm">タスクが見つかりません。Excelからインポートするか、手動で追加してください。</p>
          </div>
        )}
      </div>
    </div>
  );
};
