import React, { useState, useEffect } from 'react';
import { ParentTask, SubTask, UserSettings, TaskTemplate } from '../types';
import { 
  Plus, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  Trash2, 
  Download, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  LayoutGrid, 
  List, 
  BookTemplate,
  GripVertical,
  EyeOff,
  Type,
  Columns
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Resizable } from 'react-resizable';
import { taskService } from '../services/taskService';
import ExcelJS from 'exceljs';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DashboardProps {
  parentTasks: ParentTask[];
  onSelectTask: (task: ParentTask) => void;
  settings: UserSettings | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ parentTasks, onSelectTask, settings }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPlannedHours, setNewPlannedHours] = useState<number>(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);

  useEffect(() => {
    const unsubscribe = taskService.subscribeAllSubTasks(setAllSubTasks);
    const unsubscribeTemplates = taskService.subscribeTaskTemplates(setTemplates);
    return () => {
      unsubscribe();
      unsubscribeTemplates();
    };
  }, []);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Table Enhancements State
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({
    0: 40,   // Drag handle
    1: 300,  // Project Name
    2: 150,  // Due Date
    3: 150,  // Hours
    4: 150,  // Progress
    5: 120   // Actions
  });

  const ResizableTh = ({ index, children, title }: { index: number, children?: React.ReactNode, title?: string }) => {
    const width = columnWidths[index];

    return (
      <Resizable
        width={width}
        height={0}
        onResize={(_, { size }) => {
          setColumnWidths(prev => ({ ...prev, [index]: size.width }));
        }}
        draggableOpts={{ enableUserSelectHack: false }}
        handle={
          <div
            className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-400 z-50"
            onClick={e => e.stopPropagation()}
          />
        }
      >
        <th
          style={{ 
            width,
            minWidth: width,
            maxWidth: width,
            position: 'relative',
            zIndex: 40
          }}
          className="px-6 py-4 text-[10px] font-bold text-[#86868b] uppercase tracking-widest bg-gray-50 border-b border-black/5"
        >
          <div className="flex items-center justify-between group/th">
            <span className="truncate" title={title}>{children}</span>
          </div>
        </th>
      </Resizable>
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newDueDate) return;
    
    const calculatedDeadline = taskService.calculateDeadline(newDueDate, newPlannedHours);

    try {
      const parentId = await taskService.addParentTask({
        name: newName,
        deadline: calculatedDeadline,
        planned_hours: newPlannedHours,
        actual_hours: 0,
        progress: 0
      });

      if (parentId && selectedTemplateId) {
        const items = await taskService.getTemplateItems(selectedTemplateId);
        const addPromises = items.map(item => taskService.addSubTask({
          parent_task_id: parentId,
          system: item.system,
          month: '',
          daily_report_date: new Date().toISOString().split('T')[0],
          start_date: '',
          due_date: newDueDate,
          final_deadline: taskService.calculateDeadline(newDueDate, item.planned_hours),
          status: '未着手',
          task_name: item.task_name,
          planned_hours: item.planned_hours,
          actual_hours: 0,
          priority: item.priority,
          remarks: item.remarks,
          week_number: 0,
          flag: 0
        }));
        await Promise.all(addPromises);
      }

      setNewName('');
      setNewDueDate('');
      setNewPlannedHours(0);
      setSelectedTemplateId('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to add project:', err);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(parentTasks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update local state for immediate feedback
    // Note: parentTasks is passed as prop, so we might need to handle this in App.tsx or just update DB
    // For now, let's update the DB for each item's order
    const updatePromises = items.map((item, index) => 
      taskService.updateParentTask(item.id, { order: index })
    );
    await Promise.all(updatePromises);
  };

  const handleHide = async (id: string) => {
    try {
      await taskService.updateParentTask(id, { is_hidden: true });
    } catch (err) {
      console.error('Failed to hide project:', err);
    }
  };

  const confirmClearAll = () => {
    setIsClearingAll(false);
    taskService.clearAllData().catch(err => {
      console.error('Failed to clear data:', err);
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    taskService.deleteParentTask(targetId).catch(err => {
      console.error('Failed to delete project:', err);
    });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('WeeklyReport');
      sheet.addRow(['Project Name', 'Deadline', 'Planned Hours', 'Created At']);
      parentTasks.forEach(t => {
        sheet.addRow([
          t.name,
          t.deadline,
          t.planned_hours,
          new Date(t.created_at).toLocaleDateString(),
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Weekly_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
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

    const lastSubTaskDeadline = subTasks.reduce((max, st) => {
      if (!st.final_deadline) return max;
      return st.final_deadline > max ? st.final_deadline : max;
    }, '');

    return { progress, planned, actual, hasSubTasks: true, hasDelay, lastSubTaskDeadline };
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">プロジェクト</h2>
          <p className="text-[#86868b]">案件と期限の管理</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => settings && taskService.updateSettings(settings.id, { ...settings, ui_preferences: { ...settings.ui_preferences, view: 'grid' } })}
              className={`p-1.5 rounded-lg transition-all ${settings?.ui_preferences.view === 'grid' ? 'bg-white text-[#007aff] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => settings && taskService.updateSettings(settings.id, { ...settings, ui_preferences: { ...settings.ui_preferences, view: 'table' } })}
              className={`p-1.5 rounded-lg transition-all ${settings?.ui_preferences.view === 'table' ? 'bg-white text-[#007aff] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
              title="Table View"
            >
              <List size={18} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsClearingAll(true)}
              className="mac-button bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center gap-2 text-xs sm:text-sm"
            >
              <Trash2 size={18} />
              <span className="hidden xs:inline">全データクリア</span>
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="mac-button mac-button-secondary flex items-center gap-2 text-xs sm:text-sm"
            >
              <Download size={18} />
              <span className="hidden xs:inline">{isExporting ? 'Exporting...' : '週報エクスポート'}</span>
            </button>
            <button
              onClick={() => setIsAdding(true)}
              className="mac-button mac-button-primary flex items-center gap-2 text-xs sm:text-sm"
            >
              <Plus size={18} />
              <span>新規プロジェクト</span>
            </button>
          </div>
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
              <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2">期日</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mac-input w-full"
                required
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2">予定工数(h)</label>
              <input
                type="number"
                value={newPlannedHours}
                onChange={(e) => setNewPlannedHours(parseFloat(e.target.value) || 0)}
                className="mac-input w-full"
                min="0"
                step="0.5"
              />
            </div>
            <div className="w-64">
              <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2">テンプレ (任意)</label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="mac-input w-full"
              >
                <option value="">なし</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
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

      <DragDropContext onDragEnd={onDragEnd}>
        {settings?.ui_preferences.view === 'table' ? (
          <div className="mac-card overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0 min-w-[800px]">
              <thead className="sticky top-[56px] lg:top-0 z-50">
                <tr className="mac-table-header border-b border-black/5">
                  <ResizableTh index={0} />
                  <ResizableTh index={1} title="プロジェクト名">プロジェクト名</ResizableTh>
                  <ResizableTh index={2} title="期日">期日</ResizableTh>
                  <ResizableTh index={3} title="工数 (予定/実績)">工数 (予定/実績)</ResizableTh>
                  <ResizableTh index={4} title="進捗">進捗</ResizableTh>
                  <ResizableTh index={5} title="アクション">アクション</ResizableTh>
                </tr>
              </thead>
              <Droppable droppableId="projects-table">
                {(provided) => (
                  <tbody 
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="divide-y divide-black/5"
                  >
                    {parentTasks.map((task, index) => {
                      const { progress, planned, actual, hasSubTasks, hasDelay, lastSubTaskDeadline } = getProjectStats(task.id);
                      const isDeadlineWarning = lastSubTaskDeadline && task.deadline && task.deadline < lastSubTaskDeadline;
                      return (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided) => (
                            <tr 
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "mac-table-row cursor-pointer group transition-colors",
                                progress === 100 ? "bg-[#f5f5f7]" : ""
                              )}
                              onClick={() => onSelectTask(task)}
                            >
                              {[0, 1, 2, 3, 4, 5].map(colIdx => {
                                const width = columnWidths[colIdx];
                                
                                return (
                                  <td 
                                    key={colIdx}
                                    style={{ 
                                      width,
                                      minWidth: width,
                                      maxWidth: width,
                                      position: 'relative',
                                      zIndex: 1
                                    }}
                                    className="px-6 py-4 border-b border-black/5 transition-colors"
                                  >
                                    {colIdx === 0 && (
                                      <div {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-600">
                                        <GripVertical size={16} />
                                      </div>
                                    )}
                                    {colIdx === 1 && (
                                      <div className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${hasDelay ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-[#007aff]'}`}>
                                          <Calendar size={16} />
                                        </div>
                                        <span className="font-bold text-[#1d1d1f] truncate">
                                          {task.name}
                                        </span>
                                        {hasDelay && <AlertCircle size={14} className="text-red-500 animate-pulse flex-shrink-0" />}
                                      </div>
                                    )}
                                    {colIdx === 2 && (
                                      <div className="flex items-center gap-2">
                                        <Clock size={14} className={cn("flex-shrink-0", isDeadlineWarning ? "text-red-500" : "")} />
                                        <input
                                          type="date"
                                          value={task.deadline}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={async (e) => {
                                            e.stopPropagation();
                                            await taskService.updateParentTask(task.id, { deadline: e.target.value });
                                          }}
                                          className={cn(
                                            "bg-transparent focus:outline-none border-none p-0 text-sm cursor-pointer w-full",
                                            isDeadlineWarning ? "text-red-500 font-bold" : "text-[#86868b]"
                                          )}
                                        />
                                      </div>
                                    )}
                                    {colIdx === 3 && (
                                      <div className="flex items-center gap-2 text-sm font-medium">
                                        <span className="text-[#1d1d1f]">{planned}h</span>
                                        <span className="text-[#86868b]">/</span>
                                        <span className="text-[#007aff]">{actual}h</span>
                                      </div>
                                    )}
                                    {colIdx === 4 && (
                                      hasSubTasks ? (
                                        <div className="flex items-center gap-3 w-full">
                                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                              className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-[#007aff]'}`}
                                              style={{ width: `${progress}%` }}
                                            />
                                          </div>
                                          <span className="text-[10px] font-bold text-[#1d1d1f] flex-shrink-0">{progress}%</span>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-[#86868b] italic">No tasks</span>
                                      )
                                    )}
                                    {colIdx === 5 && (
                                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleHide(task.id);
                                          }}
                                          className="p-2 text-gray-300 hover:text-[#007aff] transition-colors"
                                          title="非表示（履歴へ）"
                                        >
                                          <EyeOff size={16} />
                                        </button>
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteTarget({ id: task.id, name: task.name });
                                          }}
                                          className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                        <ChevronRight size={16} className="text-gray-300" />
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </table>
            {parentTasks.length === 0 && !isAdding && (
              <div className="py-20 text-center">
                <p className="text-[#86868b] italic">プロジェクトが見つかりません。新規作成してください。</p>
              </div>
            )}
          </div>
        ) : (
          <Droppable droppableId="projects-grid" direction="horizontal">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {parentTasks.map((task, index) => {
                  const { progress, planned, actual, hasSubTasks, hasDelay, lastSubTaskDeadline } = getProjectStats(task.id);
                  const isDeadlineWarning = lastSubTaskDeadline && task.deadline && task.deadline < lastSubTaskDeadline;
                  
                  return (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="mac-card group hover:shadow-md transition-all cursor-pointer relative"
                          onClick={() => onSelectTask(task)}
                        >
                          <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex gap-2">
                                <div {...provided.dragHandleProps} className="p-2 text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                                  <GripVertical size={20} />
                                </div>
                                <div className={cn(
                                  "p-2 rounded-xl transition-colors",
                                  hasDelay ? "bg-red-50 text-red-600" : "bg-blue-50 text-[#007aff] group-hover:bg-[#007aff] group-hover:text-white"
                                )}>
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
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHide(task.id);
                                  }}
                                  className="p-2 text-gray-300 hover:text-[#007aff] transition-colors"
                                  title="非表示（履歴へ）"
                                >
                                  <EyeOff size={18} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget({ id: task.id, name: task.name });
                                  }}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                            
                            <h3 className="text-xl font-bold text-[#1d1d1f] mb-1 group-hover:text-[#007aff] transition-colors">
                              {task.name}
                            </h3>
                            
                            <div className="flex items-center gap-2 text-sm mt-2">
                              <Clock size={14} className={isDeadlineWarning ? "text-red-500" : "text-[#86868b]"} />
                              <span className={cn(
                                "font-medium",
                                isDeadlineWarning ? "text-red-500" : "text-[#86868b]"
                              )}>
                                期日: {task.deadline}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 mt-3">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">予定工数</span>
                                <span className="text-sm font-bold text-[#1d1d1f]">{planned}h</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">実績工数</span>
                                <span className="text-sm font-bold text-[#1d1d1f]">{actual}h</span>
                              </div>
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
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                {parentTasks.length === 0 && !isAdding && (
                  <div className="col-span-full py-20 text-center mac-card border-dashed">
                    <p className="text-[#86868b] italic">プロジェクトが見つかりません。新規作成してください。</p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        )}
      </DragDropContext>

      {(deleteTarget || isClearingAll) && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="mac-card max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-lg font-bold">削除の確認</h3>
            </div>
            <p className="text-[#1d1d1f] mb-6">
              {isClearingAll 
                ? '全てのデータを削除しますか？この操作は取り消せません。' 
                : `「${deleteTarget?.name}」と全ての関連タスクを削除しますか？`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => (isClearingAll ? confirmClearAll() : confirmDelete())}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                削除する
              </button>
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setIsClearingAll(false);
                }}
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
