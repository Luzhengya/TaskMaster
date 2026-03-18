export type SubTaskStatus = '遅れ' | '済' | '進行中' | '未着手' | '保留' | '着手遅れ' | '期限遅れ' | '着着手遅れ';
export type Priority = 'A' | 'B' | 'C';

export interface ParentTask {
  id: string;
  name: string;
  deadline: string; // This will be used as "期日" (Due Date)
  planned_hours: number;
  actual_hours?: number;
  progress?: number;
  is_hidden?: boolean;
  order?: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

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
  delay_reason?: string;
  impact_assessment?: '小' | '中' | '大';
  is_in_report?: boolean;
  order?: number;
  weekday?: string;
  week?: string;
  week_number: number;
  flag: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  order?: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  system: string;
  task_name: string;
  status: SubTaskStatus;
  planned_hours: number;
  priority: Priority;
  remarks: string;
  order?: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface UserSettings {
  id: string;
  ai_models: any[];
  ui_preferences: {
    view: 'table' | 'grid';
    opacity: number;
    theme: 'light' | 'dark';
    font: string;
  };
  notification_rules: NotificationRule[];
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  enabled: boolean;
  time: string;
  content_types: ('today_tasks' | 'delayed_tasks')[];
  days_before_deadline: number;
}
