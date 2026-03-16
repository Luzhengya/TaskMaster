export type SubTaskStatus = '遅れ' | '済' | '進行中' | '未着手' | '保留' | '着手遅れ' | '期限遅れ';
export type Priority = 'A' | 'B' | 'C';

export interface ParentTask {
  id: string;
  name: string;
  deadline: string;
  planned_hours: number;
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
  weekday: string;
  week: string;
  week_number: number;
  flag: number;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  system: string;
  task_name: string;
  planned_hours: number;
  priority: Priority;
  created_at: string;
  updated_at: string;
  owner_id?: string;
}

export interface UserSettings {
  id: string;
  ui_preferences: {
    view: 'table' | 'grid';
    opacity: number;
    theme: 'light' | 'dark';
    font: string;
  };
  notification_rules: NotificationRule[];
}

export interface NotificationRule {
  id: string;
  enabled: boolean;
  time: string;
  content_types: ('today_tasks' | 'delayed_tasks')[];
  days_before_deadline: number;
}
