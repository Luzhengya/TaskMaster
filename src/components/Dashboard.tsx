import React, { useState, useEffect } from 'react';
import { ParentTask, SubTask } from '../types';
import { Plus, Calendar, Clock, AlertTriangle, ChevronRight, Trash2, Download, Layers, CheckCircle2, AlertCircle } from 'lucide-react';
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
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);

  useEffect(() => {
    const unsubscribe = taskService.subscribeAllSubTasks(setAllSubTasks);
    return () => unsubscribe();
  }, []);

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

  const handleClearAll = async () => {
    if (confirm('全てのデータを削除しますか？この操作は取り消せません。')) {
      await taskService.clearAllData();
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
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

  const getProjectStats = (parentId: string) => {
    const subTasks = allSubTasks.filter(st => st.parent_task_id === parentId);
    if (subTasks.length === 0) return { progress: 0, hasSubTasks: false, hasDelay: false };

    const completed = subTasks.filter(st => st.status === '済').length;
    const progress = Math.round((completed / subTasks.length) * 100);
    const hasDelay = subTasks.some(st => st.status.includes('遅れ'));

    return { progress, hasSubTasks: true, hasDelay };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">プロジェクト</h2>
          <p className="text-[#86868b]">案件と期限の管理</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClearAll}
            className="mac-button bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center gap-2"
          >
            <Trash2 size={18} />
            <span>全データクリア</span>
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="mac-button mac-button-secondary flex items-center gap-2"
          >
            <Download size={18} />
            <span>{isExporting ? 'Exporting...' : '週報エクスポート'}</span>
          </button>
          <button
            onClick={() => setIsAdding(true)}
            className="mac-button mac-button-primary flex items-center gap-2"
          >
            <Plus size={18} />
            <span>新規プロジェクト</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="mac-card p-6 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleAdd} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2">プロジェクト名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mac-input w-full"
                placeholder="例: システム更新 2026"
                required
              />
            </div>
            <div className="w-48">
              <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2">期限</label>
              <input
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                className="mac-input w-full"
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="mac-button mac-button-primary"
              >
                作成
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="mac-button mac-button-secondary"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentTasks.map((task) => {
          const { progress, hasSubTasks, hasDelay } = getProjectStats(task.id);
          
          return (
            <div
              key={task.id}
              className="mac-card group hover:shadow-md transition-all cursor-pointer relative"
              onClick={() => onSelectTask(task)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <div className="p-2 bg-blue-50 text-[#007aff] rounded-xl group-hover:bg-[#007aff] group-hover:text-white transition-colors">
                      <Calendar size={20} />
                    </div>
                    {hasSubTasks && (
                      <div className="p-2 bg-gray-100 text-gray-600 rounded-xl" title="子タスクあり">
                        <Layers size={20} />
                      </div>
                    )}
                    {hasDelay && (
                      <div className="p-2 bg-red-50 text-red-600 rounded-xl animate-pulse" title="遅延あり">
                        <AlertCircle size={20} />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('このプロジェクトと全ての関連タスクを削除しますか？')) {
                        taskService.deleteParentTask(task.id);
                      }
                    }}
                    className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-[#1d1d1f] mb-1 group-hover:text-[#007aff] transition-colors">
                  {task.name}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-[#86868b] mt-2">
                  <Clock size={14} />
                  <span>期限: {task.deadline}</span>
                </div>

                {hasSubTasks && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-[#86868b]">進捗率</span>
                      <span className="text-[#1d1d1f]">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-[#007aff]'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="pt-4 mt-6 flex items-center justify-between border-t border-gray-100">
                  <span className="text-xs font-bold text-[#86868b] uppercase tracking-widest">詳細を表示</span>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-[#007aff] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          );
        })}

        {parentTasks.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center mac-card border-dashed">
            <p className="text-[#86868b] italic">プロジェクトが見つかりません。新規作成してください。</p>
          </div>
        )}
      </div>
    </div>
  );
};
