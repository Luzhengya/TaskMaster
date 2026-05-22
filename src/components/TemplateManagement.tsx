import React, { useState, useEffect } from 'react';
import { TaskTemplate, TemplateItem, Priority, SubTaskStatus } from '../types';
import { taskService } from '../services/taskService';
import { EditableCell } from './EditableCell';
import { 
  Plus, 
  Trash2, 
  ChevronLeft,
  Calendar,
  Clock,
  ChevronRight,
  Save,
  AlertCircle
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TemplateManagement: React.FC = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [isAddingTemplate, setIsAddingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

  useEffect(() => {
    const unsubscribe = taskService.subscribeTaskTemplates(setTemplates);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedTemplate) {
      const unsubscribe = taskService.subscribeTemplateItems(selectedTemplate.id, setTemplateItems);
      return () => unsubscribe();
    } else {
      setTemplateItems([]);
    }
  }, [selectedTemplate]);

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      await taskService.addTaskTemplate({
        name: newTemplateName,
      });
      setNewTemplateName('');
      setIsAddingTemplate(false);
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTarget) return;
    try {
      await taskService.deleteTaskTemplate(deleteTarget.id);
      setDeleteTarget(null);
      if (selectedTemplate?.id === deleteTarget.id) {
        setSelectedTemplate(null);
      }
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const handleAddItem = async () => {
    if (!selectedTemplate) return;
    await taskService.addTemplateItem({
      template_id: selectedTemplate.id,
      system: '',
      task_name: '新規タスク',
      status: '未着手',
      planned_hours: 0,
      priority: 'B',
      remarks: ''
    });
  };

  const handleUpdateItem = async (id: string, updates: Partial<TemplateItem>) => {
    await taskService.updateTemplateItem(id, updates);
  };

  const handleDeleteItem = async (id: string) => {
    await taskService.deleteTemplateItem(id);
  };

  const statusColors: Record<SubTaskStatus, string> = {
    '遅れ': 'bg-red-100 text-red-700',
    '済': 'bg-green-100 text-green-700',
    '進行中': 'bg-blue-100 text-blue-700',
    '未着手': 'bg-gray-100 text-gray-700',
    '保留': 'bg-yellow-100 text-yellow-700',
    '着手遅れ': 'bg-orange-50 text-orange-600',
    '期限遅れ': 'bg-red-200 text-red-800',
  };

  if (selectedTemplate) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedTemplate(null)} 
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">{selectedTemplate.name}</h2>
              <p className="text-[#86868b]">作成日: {new Date(selectedTemplate.created_at).toLocaleString()}</p>
            </div>
          </div>
          
          <button
            onClick={handleAddItem}
            className="mac-button mac-button-primary flex items-center gap-2"
          >
            <Plus size={18} />
            <span>タスク追加</span>
          </button>
        </div>

        <div className="mac-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">システム</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">タスク名</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">ステータス</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest w-24">予定工数</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest w-24">優先度</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest">備考</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#86868b] uppercase tracking-widest w-16 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {templateItems.map((item) => (
                  <tr key={item.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2">
                      <EditableCell
                        value={item.system}
                        onSave={(val) => handleUpdateItem(item.id, { system: val as string })}
                        className="text-sm"
                        placeholder="システム名"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <EditableCell
                        value={item.task_name}
                        onSave={(val) => handleUpdateItem(item.id, { task_name: val as string })}
                        className="font-medium text-sm"
                        placeholder="タスク名"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.status}
                        onChange={(e) => handleUpdateItem(item.id, { status: e.target.value as SubTaskStatus })}
                        className={cn(
                          "px-2 py-0.5 rounded-md text-[10px] font-bold focus:outline-none",
                          statusColors[item.status]
                        )}
                      >
                        {Object.keys(statusColors).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <EditableCell
                        type="number"
                        value={isNaN(item.planned_hours) ? 0 : item.planned_hours}
                        onSave={(val) => handleUpdateItem(item.id, { planned_hours: val as number })}
                        className="w-16 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.priority}
                        onChange={(e) => handleUpdateItem(item.id, { priority: e.target.value as Priority })}
                        className="bg-transparent focus:outline-none text-sm"
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <EditableCell
                        value={item.remarks || ''}
                        onSave={(val) => handleUpdateItem(item.id, { remarks: val as string })}
                        className="text-sm"
                        placeholder="備考..."
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {templateItems.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-[#86868b] italic text-sm">タスクがありません。「タスク追加」ボタンから作成してください。</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">テンプレ管理</h2>
          <p className="text-[#86868b]">案件作成時に使用するタスクセットの管理</p>
        </div>
        <button
          onClick={() => setIsAddingTemplate(true)}
          className="mac-button mac-button-primary flex items-center gap-2"
        >
          <Plus size={18} />
          <span>新規テンプレ</span>
        </button>
      </div>

      {isAddingTemplate && (
        <div className="mac-card p-6 animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-lg font-bold mb-4">新規テンプレ作成</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="テンプレ名を入力..."
              className="mac-input flex-1"
              autoFocus
            />
            <button
              onClick={handleCreateTemplate}
              className="mac-button mac-button-primary"
            >
              作成
            </button>
            <button
              onClick={() => setIsAddingTemplate(false)}
              className="mac-button mac-button-secondary"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div
            key={template.id}
            className="mac-card group hover:shadow-md transition-all cursor-pointer relative"
            onClick={() => setSelectedTemplate(template)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Calendar size={20} />
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget({ id: template.id, name: template.name });
                  }}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <h3 className="text-xl font-bold text-[#1d1d1f] mb-1 group-hover:text-[#007aff] transition-colors">
                {template.name}
              </h3>
              
              <div className="flex items-center gap-2 text-sm text-[#86868b] mt-2">
                <Clock size={14} />
                <span>作成日: {new Date(template.created_at).toLocaleDateString()}</span>
              </div>
              
              <div className="pt-4 mt-6 flex items-center justify-between border-t border-gray-100">
                <span className="text-xs font-bold text-[#86868b] uppercase tracking-widest">詳細・編集</span>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-[#007aff] group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && !isAddingTemplate && (
          <div className="col-span-full py-20 text-center mac-card border-dashed">
            <p className="text-[#86868b] italic">テンプレが見つかりません。新規作成してください。</p>
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
              テンプレ「{deleteTarget.name}」を削除しますか？<br />
              <span className="text-xs text-red-500">※含まれるタスクもすべて削除されます。</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteTemplate}
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
