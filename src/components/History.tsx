import React, { useState, useEffect } from 'react';
import { ParentTask, SubTask, UserSettings } from '../types';
import { taskService } from '../services/taskService';
import { 
  History as HistoryIcon, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Trash2, 
  Eye,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryProps {
  onSelectTask: (task: ParentTask) => void;
  settings: UserSettings | null;
}

export const History: React.FC<HistoryProps> = ({ onSelectTask, settings }) => {
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([]);
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    const unsubscribe = taskService.subscribeParentTasks(setParentTasks, true);
    const unsubscribeSubTasks = taskService.subscribeAllSubTasks(setAllSubTasks);
    return () => {
      unsubscribe();
      unsubscribeSubTasks();
    };
  }, []);

  const handleRestore = async (id: string) => {
    try {
      await taskService.updateParentTask(id, { is_hidden: false });
    } catch (err) {
      console.error('Failed to restore project:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await taskService.deleteParentTask(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const getProjectStats = (parentId: string) => {
    const subTasks = allSubTasks.filter(st => st.parent_task_id === parentId);
    if (subTasks.length === 0) return { progress: 0, planned: 0, actual: 0, hasSubTasks: false, hasDelay: false };

    const completed = subTasks.filter(st => st.status === '済').length;
    const progress = Math.round((completed / subTasks.length) * 100);
    const hasDelay = subTasks.some(st => st.status.includes('遅れ'));
    const planned = subTasks.reduce((acc, st) => acc + (st.planned_hours || 0), 0);
    const actual = subTasks.reduce((acc, st) => acc + (st.actual_hours || 0), 0);

    return { progress, planned, actual, hasSubTasks: true, hasDelay };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">履歴</h2>
          <p className="text-[#86868b]">非表示にした過去の案件一覧</p>
        </div>
        <div className="p-2 bg-gray-100 text-gray-600 rounded-xl">
          <HistoryIcon size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {parentTasks.map((task) => {
          const stats = getProjectStats(task.id);
          
          return (
            <div 
              key={task.id} 
              className="mac-card group hover:shadow-md transition-all cursor-pointer relative"
              onClick={() => onSelectTask(task)}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={cn(
                    "p-2 rounded-xl transition-colors",
                    stats.hasDelay ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-600"
                  )}>
                    <Calendar size={20} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestore(task.id);
                      }}
                      className="p-2 text-gray-400 hover:text-[#007aff] transition-colors"
                      title="表示に戻す"
                    >
                      <Eye size={18} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ id: task.id, name: task.name });
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="完全に削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-[#1d1d1f] mb-1 group-hover:text-[#007aff] transition-colors">
                  {task.name}
                </h3>
                
                <div className="flex items-center gap-2 text-sm text-[#86868b] mb-4">
                  <Clock size={14} />
                  <span>期限: {task.deadline}</span>
                  {stats.hasDelay && (
                    <span className="flex items-center gap-1 text-red-500 font-bold ml-2">
                      <AlertTriangle size={12} />
                      遅延あり
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-[#86868b] uppercase tracking-widest">
                    <span>進捗率</span>
                    <span>{stats.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-500",
                        stats.hasDelay ? "bg-red-500" : "bg-[#007aff]"
                      )}
                      style={{ width: `${stats.progress}%` }}
                    />
                  </div>
                </div>

                <div className="pt-4 mt-6 flex items-center justify-between border-t border-gray-100">
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">予定</p>
                      <p className="text-sm font-bold text-[#1d1d1f]">{stats.planned}h</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">実績</p>
                      <p className="text-sm font-bold text-[#1d1d1f]">{stats.actual}h</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-[#007aff] group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          );
        })}

        {parentTasks.length === 0 && (
          <div className="col-span-full py-20 text-center mac-card border-dashed">
            <p className="text-[#86868b] italic">履歴はありません。</p>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-card max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold">削除の確認</h3>
            </div>
            <p className="text-[#1d1d1f] mb-6">
              プロジェクト「{deleteTarget.name}」を完全に削除しますか？<br />
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 bg-gray-100 text-[#1d1d1f] rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
