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
  Columns,
  FileText
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

// Zero-pad a YYYY-M-D date string so string comparison matches chronological order.
// Imported dates aren't zero-padded ("2026-6-9") while <input type="date"> emits "2026-06-09".
function normalizeDate(d?: string): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

type ProjectStatus = 'completed' | 'delayed' | 'start_delayed' | 'in_progress' | 'not_started';
type ProjectFilter = 'all' | 'delayed' | 'start_delayed' | 'in_progress' | 'completed';

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
  const [filter, setFilter] = useState<ProjectFilter>('all');

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
    // Reordering rewrites global order indices, so only persist it in the unfiltered view.
    if (filter !== 'all') return;

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
    if (subTasks.length === 0) return { progress: 0, planned: 0, actual: 0, hasSubTasks: false, hasDelay: false, status: 'not_started' as ProjectStatus, maxSubTaskDueDate: '' };

    const completed = subTasks.filter(st => st.status === '済').length;
    const progress = Math.round((completed / subTasks.length) * 100);
    const hasDeadlineDelay = subTasks.some(st => st.status === '遅れ' || st.status === '期限遅れ');
    const hasStartDelay = subTasks.some(st => st.status === '着手遅れ');
    const hasDelay = hasDeadlineDelay || hasStartDelay;
    const planned = subTasks.reduce((acc, st) => acc + (st.planned_hours || 0), 0);
    const actual = subTasks.reduce((acc, st) => acc + (st.actual_hours || 0), 0);

    const maxSubTaskDueDate = subTasks.reduce((max, st) => {
      const d = normalizeDate(st.due_date);
      return d > max ? d : max;
    }, '');

    let status: ProjectStatus;
    if (progress === 100) status = 'completed';
    else if (hasDeadlineDelay) status = 'delayed';
    else if (hasStartDelay) status = 'start_delayed';
    else if (progress > 0) status = 'in_progress';
    else status = 'not_started';

    return { progress, planned, actual, hasSubTasks: true, hasDelay, maxSubTaskDueDate, status };
  };

  const STATUS_META: Record<Exclude<ProjectStatus, 'completed' | 'in_progress' | 'not_started'>, { label: string; dot: string; text: string; borderClass: string; iconBg: string }> = {
    delayed: { label: '遅延あり', dot: 'bg-red-500', text: 'text-red-600', borderClass: 'border-l-red-500', iconBg: 'bg-red-50 text-red-600' },
    start_delayed: { label: '着手遅れ', dot: 'bg-amber-400', text: 'text-amber-600', borderClass: 'border-l-amber-400', iconBg: 'bg-amber-50 text-amber-600' },
  };

  const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; dot: string; text: string; borderClass: string }> = {
    delayed:       { label: '遅延あり', dot: 'bg-red-500',   text: 'text-red-600',   borderClass: 'border-l-red-500' },
    start_delayed: { label: '着手遅れ', dot: 'bg-amber-400', text: 'text-amber-600', borderClass: 'border-l-amber-400' },
    in_progress:   { label: '進行中',   dot: 'bg-[#007aff]', text: 'text-[#007aff]', borderClass: 'border-l-[#007aff]' },
    not_started:   { label: '未着手',   dot: 'bg-gray-300',  text: 'text-gray-500',  borderClass: 'border-l-gray-300' },
    completed:     { label: '完了',     dot: 'bg-green-500', text: 'text-green-600', borderClass: 'border-l-green-500' },
  };

  const tasksWithStats = parentTasks.map(task => ({ task, stats: getProjectStats(task.id) }));
  const counts = {
    delayed: tasksWithStats.filter(t => t.stats.status === 'delayed').length,
    start_delayed: tasksWithStats.filter(t => t.stats.status === 'start_delayed').length,
    in_progress: tasksWithStats.filter(t => t.stats.status === 'in_progress').length,
    completed: tasksWithStats.filter(t => t.stats.status === 'completed').length,
  };
  const displayedTasks = filter === 'all'
    ? parentTasks
    : tasksWithStats.filter(t => t.stats.status === filter).map(t => t.task);

  const FILTER_TABS: { key: ProjectFilter; label: string; count?: number }[] = [
    { key: 'all', label: 'すべて' },
    { key: 'delayed', label: '遅延あり', count: counts.delayed },
    { key: 'start_delayed', label: '着手遅れ', count: counts.start_delayed },
    { key: 'in_progress', label: '進行中', count: counts.in_progress },
    { key: 'completed', label: '完了', count: counts.completed },
  ];

  const TAB_COLORS: Record<ProjectFilter, { active: string; countColor: string }> = {
    all:           { active: 'bg-[#1d1d1f] text-white', countColor: 'text-gray-500' },
    delayed:       { active: 'bg-red-500 text-white',   countColor: 'text-red-500' },
    start_delayed: { active: 'bg-amber-400 text-white', countColor: 'text-amber-500' },
    in_progress:   { active: 'bg-[#007aff] text-white', countColor: 'text-[#007aff]' },
    completed:     { active: 'bg-green-500 text-white', countColor: 'text-green-600' },
  };

  // Weekly report mode: group the (filtered) projects by status for a status-report layout.
  const displayedWithStats = displayedTasks.map(task => ({ task, stats: getProjectStats(task.id) }));
  const WEEKLY_GROUP_ORDER: ProjectStatus[] = ['delayed', 'start_delayed', 'in_progress', 'not_started', 'completed'];
  const weeklyGroups = WEEKLY_GROUP_ORDER
    .map(status => ({ status, items: displayedWithStats.filter(t => t.stats.status === status) }))
    .filter(g => g.items.length > 0);
  const now = new Date();
  const weekLabel = `${now.getFullYear()}年${now.getMonth() + 1}月 第${Math.ceil(now.getDate() / 7)}週`;
  const getDelayedSubTasks = (parentId: string) =>
    allSubTasks.filter(st => st.parent_task_id === parentId && (st.status === '遅れ' || st.status === '期限遅れ' || st.status === '着手遅れ'));

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
            <button
              onClick={() => settings && taskService.updateSettings(settings.id, { ...settings, ui_preferences: { ...settings.ui_preferences, view: 'weekly' } })}
              className={`p-1.5 rounded-lg transition-all ${settings?.ui_preferences.view === 'weekly' ? 'bg-white text-[#007aff] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
              title="週報モード"
            >
              <FileText size={18} />
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

      <div className="flex flex-wrap items-center gap-2 px-1">
        {FILTER_TABS.map(tab => {
          const active = filter === tab.key;
          const c = TAB_COLORS[tab.key];
          const hasCount = tab.count !== undefined && tab.count > 0;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors",
                active ? c.active : "text-[#86868b] hover:text-[#1d1d1f]"
              )}
            >
              <span>{tab.label}</span>
              {hasCount && (
                <span className={cn("text-xs font-bold", active ? "text-white" : c.countColor)}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {settings?.ui_preferences.view === 'weekly' ? (
        <div className="space-y-6">
          <div className="mac-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-[#007aff] rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#1d1d1f]">週報</h3>
                  <p className="text-sm text-[#86868b]">{weekLabel}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-[#1d1d1f]">{displayedTasks.length}</span>
                  <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">案件</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-red-600">{counts.delayed}</span>
                  <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">遅延あり</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-amber-600">{counts.start_delayed}</span>
                  <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">着手遅れ</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-green-600">{counts.completed}</span>
                  <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">完了</span>
                </div>
              </div>
            </div>
          </div>

          {weeklyGroups.map(group => {
            const meta = PROJECT_STATUS_META[group.status];
            return (
              <div key={group.status} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                  <h4 className={cn("text-sm font-bold", meta.text)}>{meta.label}</h4>
                  <span className="text-xs font-bold text-[#86868b]">{group.items.length}</span>
                </div>
                {group.items.map(({ task, stats }) => {
                  const { progress, planned, actual, status } = stats;
                  const delayedSubs = getDelayedSubTasks(task.id);
                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "mac-card p-5 cursor-pointer hover:shadow-md transition-all border-l-4",
                        meta.borderClass
                      )}
                      onClick={() => onSelectTask(task)}
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-[#1d1d1f] truncate">{task.name}</span>
                          {(status === 'delayed' || status === 'start_delayed') && (
                            <span className={cn("flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold", meta.text)}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", meta.dot)} />
                              {meta.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-shrink-0">
                          <Clock size={14} className="text-[#86868b]" />
                          <span className="text-[#86868b] font-medium">期日: {task.deadline || '—'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-[#007aff]'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[#1d1d1f] flex-shrink-0 w-10 text-right">{progress}%</span>
                        <div className="flex items-center gap-1 text-sm font-medium flex-shrink-0">
                          <span className="text-[#1d1d1f]">{planned}h</span>
                          <span className="text-[#86868b]">/</span>
                          <span className="text-[#007aff]">{actual}h</span>
                        </div>
                      </div>

                      {delayedSubs.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                          {delayedSubs.map(st => (
                            <div key={st.id} className="flex items-start gap-2 text-xs">
                              <AlertCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
                              <span className="font-medium text-[#1d1d1f] flex-shrink-0">{st.task_name}</span>
                              {st.delay_reason && <span className="text-[#86868b] truncate">— {st.delay_reason}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {displayedTasks.length === 0 && (
            <div className="mac-card border-dashed py-20 text-center">
              <p className="text-[#86868b] italic">
                {filter === 'all' ? 'プロジェクトが見つかりません。新規作成してください。' : '該当するプロジェクトがありません。'}
              </p>
            </div>
          )}
        </div>
      ) : (
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
                    {displayedTasks.map((task, index) => {
                      const { progress, planned, actual, hasSubTasks, maxSubTaskDueDate, status } = getProjectStats(task.id);
                      const isDeadlineWarning = !!maxSubTaskDueDate && !!task.deadline && normalizeDate(task.deadline) < maxSubTaskDueDate;
                      const statusMeta = status === 'delayed' || status === 'start_delayed' ? STATUS_META[status] : null;
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
                                    className={cn(
                                      "px-6 py-4 border-b border-black/5 transition-colors",
                                      colIdx === 0 && statusMeta && `border-l-4 ${statusMeta.borderClass}`
                                    )}
                                  >
                                    {colIdx === 0 && (
                                      <div {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-600">
                                        <GripVertical size={16} />
                                      </div>
                                    )}
                                    {colIdx === 1 && (
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={cn(
                                          "p-1.5 rounded-lg flex-shrink-0",
                                          statusMeta ? statusMeta.iconBg : "bg-blue-50 text-[#007aff]"
                                        )}>
                                          <Calendar size={16} />
                                        </div>
                                        <span className="font-bold text-[#1d1d1f] truncate">
                                          {task.name}
                                        </span>
                                        {statusMeta && (
                                          <span className={cn("flex items-center gap-1.5 flex-shrink-0 text-xs font-semibold", statusMeta.text)}>
                                            <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                                            {statusMeta.label}
                                          </span>
                                        )}
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
            {displayedTasks.length === 0 && !isAdding && (
              <div className="py-20 text-center">
                <p className="text-[#86868b] italic">
                  {filter === 'all' ? 'プロジェクトが見つかりません。新規作成してください。' : '該当するプロジェクトがありません。'}
                </p>
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
                {displayedTasks.map((task, index) => {
                  const { progress, planned, actual, hasSubTasks, maxSubTaskDueDate, status } = getProjectStats(task.id);
                  const isDeadlineWarning = !!maxSubTaskDueDate && !!task.deadline && normalizeDate(task.deadline) < maxSubTaskDueDate;
                  const statusMeta = status === 'delayed' || status === 'start_delayed' ? STATUS_META[status] : null;

                  return (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={cn(
                            "mac-card group hover:shadow-md transition-all cursor-pointer relative overflow-hidden",
                            statusMeta && `border-l-4 ${statusMeta.borderClass}`
                          )}
                          onClick={() => onSelectTask(task)}
                        >
                          <div className="p-5 flex flex-col h-full">
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <div {...provided.dragHandleProps} className="text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing flex-shrink-0">
                                  <GripVertical size={18} />
                                </div>
                                <div className={cn(
                                  "p-2 rounded-xl transition-colors flex-shrink-0",
                                  statusMeta ? statusMeta.iconBg : "bg-blue-50 text-[#007aff] group-hover:bg-[#007aff] group-hover:text-white"
                                )}>
                                  <Calendar size={18} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {statusMeta && (
                                  <span className={cn("flex items-center gap-1.5 text-xs font-semibold", statusMeta.text)}>
                                    <span className={cn("w-1.5 h-1.5 rounded-full", statusMeta.dot)} />
                                    {statusMeta.label}
                                  </span>
                                )}
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleHide(task.id);
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-[#007aff] transition-colors"
                                    title="非表示（履歴へ）"
                                  >
                                    <EyeOff size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteTarget({ id: task.id, name: task.name });
                                    }}
                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            <h3 className="text-lg font-bold text-[#1d1d1f] group-hover:text-[#007aff] transition-colors mb-2 truncate">
                              {task.name}
                            </h3>

                            <div className="flex items-center gap-2 text-sm mb-5">
                              <Clock size={14} className={isDeadlineWarning ? "text-red-500" : "text-[#86868b]"} />
                              <span className={cn(
                                "font-medium",
                                isDeadlineWarning ? "text-red-500 font-bold" : "text-[#86868b]"
                              )}>
                                期日: {task.deadline || '—'}
                              </span>
                            </div>

                            <div className="mt-auto space-y-3">
                              <div>
                                <div className="flex justify-between items-center text-xs font-medium mb-1.5">
                                  <span className="text-[#86868b]">進捗率</span>
                                  <span className="text-[#1d1d1f] font-bold">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${progress === 100 ? 'bg-green-500' : 'bg-[#007aff]'}`}
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">工数 (予定/実績)</span>
                                <div className="flex items-center gap-1 text-sm font-bold">
                                  <span className="text-[#1d1d1f]">{planned}h</span>
                                  <span className="text-[#86868b]">/</span>
                                  <span className="text-[#007aff]">{actual}h</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
                {displayedTasks.length === 0 && !isAdding && (
                  <div className="col-span-full py-20 text-center mac-card border-dashed">
                    <p className="text-[#86868b] italic">
                      {filter === 'all' ? 'プロジェクトが見つかりません。新規作成してください。' : '該当するプロジェクトがありません。'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Droppable>
        )}
      </DragDropContext>
      )}

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
