export interface ParentTask {
  id: string;
  name: string;
  deadline: string;
  planned_hours: number;
  created_at: string;
  updated_at: string;
  owner_id: string;
}

export type SubTaskStatus = '遅れ' | '済' | '進行中' | '未着手' | '保留' | '着着手遅れ' | '期限遅れ';
export type Priority = 'A' | 'B' | 'C';

export interface SubTask {
  id: string;
  parent_task_id: string;
  system: string;
  month: string;
  daily_report_date: string;
  start_date: string;
  due_date: string;
  final_deadline: string;
  status: SubTaskStatus;
  task_name: string;
  planned_hours: number;
  actual_hours: number;
  priority: Priority;
  remarks: string;
  week_number: number;
  flag: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  task_name: string;
  planned_hours: number;
  priority: Priority;
  remarks: string;
  owner_id: string;
}

export interface AIModelConfig {
  name: string;
  apiKey: string;
  endpoint?: string;
  enabled: boolean;
}

export interface NotificationRule {
  id: string;
  enabled: boolean;
  time: string;
  content_types: ('today_tasks' | 'deadline_soon' | 'delayed_tasks')[];
  days_before_deadline: number;
}

export interface UserSettings {
  id: string;
  owner_id: string;
  ai_models: AIModelConfig[];
  ui_preferences: {
    view: 'calendar' | 'kanban' | 'table';
    opacity: number;
    theme: 'light' | 'dark' | 'blue';
    font: string;
  };
  notification_rules: NotificationRule[];
  updated_at: string;
}
