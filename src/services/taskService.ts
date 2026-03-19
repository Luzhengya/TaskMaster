import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  query, 
  where, 
  serverTimestamp,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ParentTask, SubTask, TaskTemplate, TemplateItem, UserSettings } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, shouldThrow = true) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (shouldThrow) {
    throw new Error(JSON.stringify(errInfo));
  }
}


const GUEST_STORAGE_KEY = 'taskmaster_guest_data';

interface GuestStore {
  parent_tasks: ParentTask[];
  sub_tasks: SubTask[];
  task_templates: TaskTemplate[];
  template_items: TemplateItem[];
  settings: UserSettings | null;
}

const getInitialGuestStore = (): GuestStore => ({
  parent_tasks: [
    {
      id: 'sample-p1',
      name: '【サンプル】新機能開発プロジェクト',
      deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      planned_hours: 40,
      actual_hours: 12,
      progress: 30,
      is_hidden: false,
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-p2',
      name: '【サンプル】システム保守・運用',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      planned_hours: 20,
      actual_hours: 18,
      progress: 90,
      is_hidden: false,
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  sub_tasks: [
    {
      id: 'sample-s1',
      parent_task_id: 'sample-p1',
      system: 'Frontend',
      task_name: 'UIコンポーネントの作成',
      status: '進行中',
      month: new Date().toISOString().slice(0, 7),
      week_number: 1,
      flag: 0,
      start_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      final_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      planned_hours: 8,
      actual_hours: 4,
      priority: 'A',
      is_in_report: true,
      daily_report_date: new Date().toISOString().split('T')[0],
      remarks: '順調に進んでいます',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-s2',
      parent_task_id: 'sample-p1',
      system: 'Backend',
      task_name: 'APIエンドポイントの実装',
      status: '未着手',
      month: new Date().toISOString().slice(0, 7),
      week_number: 2,
      flag: 0,
      start_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      final_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      planned_hours: 12,
      actual_hours: 0,
      priority: 'B',
      is_in_report: false,
      daily_report_date: '',
      remarks: '',
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-s3',
      parent_task_id: 'sample-p2',
      system: 'Infrastructure',
      task_name: 'サーバー証明書の更新',
      status: '済',
      month: new Date().toISOString().slice(0, 7),
      week_number: 1,
      flag: 0,
      start_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      due_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      final_deadline: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      planned_hours: 2,
      actual_hours: 2.5,
      priority: 'A',
      is_in_report: true,
      daily_report_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      remarks: '完了しました',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  task_templates: [
    {
      id: 'sample-t1',
      name: '標準開発フロー',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-t2',
      name: 'Webアプリ開発テンプレート',
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-t3',
      name: 'モバイルアプリ開発テンプレート',
      order: 2,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  template_items: [
    {
      id: 'sample-ti1',
      template_id: 'sample-t1',
      system: '共通',
      task_name: '要件定義',
      status: '未着手',
      planned_hours: 8,
      priority: 'A',
      remarks: '',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti2',
      template_id: 'sample-t1',
      system: '共通',
      task_name: '基本設計',
      status: '未着手',
      planned_hours: 16,
      priority: 'B',
      remarks: '',
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti3',
      template_id: 'sample-t2',
      system: 'Frontend',
      task_name: 'React環境構築',
      status: '未着手',
      planned_hours: 4,
      priority: 'A',
      remarks: '',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti4',
      template_id: 'sample-t2',
      system: 'Frontend',
      task_name: 'トップページ実装',
      status: '未着手',
      planned_hours: 8,
      priority: 'B',
      remarks: '',
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti5',
      template_id: 'sample-t2',
      system: 'Backend',
      task_name: 'DB設計・構築',
      status: '未着手',
      planned_hours: 8,
      priority: 'A',
      remarks: '',
      order: 2,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti6',
      template_id: 'sample-t3',
      system: 'iOS/Android',
      task_name: 'Flutter環境構築',
      status: '未着手',
      planned_hours: 4,
      priority: 'A',
      remarks: '',
      order: 0,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-ti7',
      template_id: 'sample-t3',
      system: 'Design',
      task_name: 'UI/UXデザイン作成',
      status: '未着手',
      planned_hours: 16,
      priority: 'A',
      remarks: '',
      order: 1,
      owner_id: 'guest',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  settings: {
    id: 'guest-settings',
    ai_models: [],
    ui_preferences: {
      view: 'table',
      opacity: 1,
      theme: 'light',
      font: 'Inter'
    },
    notification_rules: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
});

const loadGuestStore = (): GuestStore => {
  const stored = localStorage.getItem(GUEST_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse guest store:', e);
    }
  }
  return getInitialGuestStore();
};

// Simple observer system for guest mode
type GuestObserver = () => void;
const guestObservers: Set<GuestObserver> = new Set();

const notifyGuestObservers = () => {
  guestObservers.forEach(observer => observer());
};

const saveGuestStore = (store: GuestStore) => {
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(store));
  notifyGuestObservers();
};

let guestStore = loadGuestStore();

export const taskService = {
  isGuest: false,

  // Test connection
  async testConnection() {
    if (this.isGuest) return;
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  },

  async cleanupUserData(userId: string) {
    if (this.isGuest) {
      guestStore = getInitialGuestStore();
      saveGuestStore(guestStore);
      notifyGuestObservers();
      return;
    }
    console.log('Cleaning up data for user:', userId);
    const collections = ['parent_tasks', 'sub_tasks', 'task_templates', 'template_items', 'settings'];
    for (const colName of collections) {
      try {
        const q = query(collection(db, colName), where('owner_id', '==', userId));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
        console.log(`Cleaned up ${snapshot.size} documents from ${colName}`);
      } catch (error) {
        console.error(`Error cleaning up ${colName}:`, error);
      }
    }
  },

  // Parent Tasks
  subscribeParentTasks(callback: (tasks: ParentTask[]) => void, showHidden = false) {
    if (this.isGuest) {
      const update = () => {
        const filtered = guestStore.parent_tasks.filter(t => !!t.is_hidden === showHidden);
        callback(filtered);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'parent_tasks'),
      where('owner_id', '==', auth.currentUser.uid),
      where('is_hidden', '==', showHidden)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentTask));
      // Sort by order if available, otherwise by created_at
      tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'parent_tasks', false));
  },

  async addParentTask(task: Omit<ParentTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (this.isGuest) {
      const newTask: ParentTask = {
        ...task,
        id: Math.random().toString(36).substr(2, 9),
        is_hidden: false,
        order: guestStore.parent_tasks.length,
        owner_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      guestStore.parent_tasks.push(newTask);
      saveGuestStore(guestStore);
      return newTask.id;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'parent_tasks';
    try {
      // Get current count to set order
      const q = query(collection(db, path), where('owner_id', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const order = snapshot.size;

      const docRef = await addDoc(collection(db, path), {
        ...task,
        is_hidden: false,
        order,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateParentTask(id: string, task: Partial<ParentTask>) {
    if (this.isGuest) {
      const index = guestStore.parent_tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        guestStore.parent_tasks[index] = {
          ...guestStore.parent_tasks[index],
          ...task,
          updated_at: new Date().toISOString()
        };
        saveGuestStore(guestStore);
      }
      return;
    }
    const path = `parent_tasks/${id}`;
    try {
      await updateDoc(doc(db, 'parent_tasks', id), {
        ...task,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteParentTask(id: string) {
    if (this.isGuest) {
      guestStore.parent_tasks = guestStore.parent_tasks.filter(t => t.id !== id);
      guestStore.sub_tasks = guestStore.sub_tasks.filter(t => t.parent_task_id !== id);
      saveGuestStore(guestStore);
      return;
    }
    const path = `parent_tasks/${id}`;
    try {
      // Delete associated sub-tasks first
      const q = query(
        collection(db, 'sub_tasks'),
        where('parent_task_id', '==', id),
        where('owner_id', '==', auth.currentUser?.uid)
      );
      const subTasksSnapshot = await getDocs(q);
      const deletePromises = subTasksSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete parent task
      await deleteDoc(doc(db, 'parent_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async clearAllData() {
    if (this.isGuest) {
      guestStore.parent_tasks = [];
      guestStore.sub_tasks = [];
      saveGuestStore(guestStore);
      notifyGuestObservers();
      return;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    try {
      // Delete all parent tasks
      const pq = query(collection(db, 'parent_tasks'), where('owner_id', '==', auth.currentUser.uid));
      const pSnapshot = await getDocs(pq);
      const pDeletes = pSnapshot.docs.map(d => deleteDoc(d.ref));
      
      // Delete all sub tasks
      const sq = query(collection(db, 'sub_tasks'), where('owner_id', '==', auth.currentUser.uid));
      const sSnapshot = await getDocs(sq);
      const sDeletes = sSnapshot.docs.map(d => deleteDoc(d.ref));

      await Promise.all([...pDeletes, ...sDeletes]);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'all_data');
    }
  },

  // Sub Tasks
  subscribeAllSubTasks(callback: (tasks: SubTask[]) => void) {
    if (this.isGuest) {
      const update = () => {
        callback(guestStore.sub_tasks);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'sub_tasks'),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubTask));
      tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sub_tasks', false));
  },

  subscribeSubTasks(parentTaskId: string, callback: (tasks: SubTask[]) => void) {
    if (this.isGuest) {
      const update = () => {
        const filtered = guestStore.sub_tasks.filter(t => t.parent_task_id === parentTaskId);
        callback(filtered);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'sub_tasks'), 
      where('parent_task_id', '==', parentTaskId),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubTask));
      tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sub_tasks', false));
  },

  async addSubTask(task: Omit<SubTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (this.isGuest) {
      const newTask: SubTask = {
        ...task,
        id: Math.random().toString(36).substr(2, 9),
        is_in_report: false,
        order: guestStore.sub_tasks.filter(t => t.parent_task_id === task.parent_task_id).length,
        owner_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      guestStore.sub_tasks.push(newTask);
      saveGuestStore(guestStore);
      return newTask.id;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'sub_tasks';
    try {
      const q = query(collection(db, path), where('parent_task_id', '==', task.parent_task_id), where('owner_id', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const order = snapshot.size;

      const docRef = await addDoc(collection(db, path), {
        ...task,
        is_in_report: false,
        order,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  calculateDeadline(dueDate: string, plannedHours: number): string {
    const date = new Date(dueDate);
    let businessDaysToAdd = 0;

    if (plannedHours >= 1 && plannedHours < 3) {
      businessDaysToAdd = 1;
    } else if (plannedHours >= 3 && plannedHours < 5) {
      businessDaysToAdd = 2;
    } else if (plannedHours >= 5 && plannedHours < 8) {
      businessDaysToAdd = 4; // User said 3-4, I'll pick 4 for safety or 3. Let's use 4 as per "3-4".
    } else if (plannedHours >= 8) {
      businessDaysToAdd = 5; // 1 week business days
    }

    let addedDays = 0;
    while (addedDays < businessDaysToAdd) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
        addedDays++;
      }
    }

    return date.toISOString().split('T')[0];
  },

  async updateSubTask(id: string, task: Partial<SubTask>) {
    if (this.isGuest) {
      const index = guestStore.sub_tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        guestStore.sub_tasks[index] = {
          ...guestStore.sub_tasks[index],
          ...task,
          updated_at: new Date().toISOString()
        };
        saveGuestStore(guestStore);
      }
      return;
    }
    const path = `sub_tasks/${id}`;
    try {
      await updateDoc(doc(db, 'sub_tasks', id), {
        ...task,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteSubTask(id: string) {
    if (this.isGuest) {
      guestStore.sub_tasks = guestStore.sub_tasks.filter(t => t.id !== id);
      saveGuestStore(guestStore);
      return;
    }
    const path = `sub_tasks/${id}`;
    try {
      await deleteDoc(doc(db, 'sub_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Task Templates
  subscribeTaskTemplates(callback: (templates: TaskTemplate[]) => void) {
    if (this.isGuest) {
      const update = () => {
        callback([...guestStore.task_templates]);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'task_templates'),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate));
      templates.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(templates);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'task_templates', false));
  },

  async addTaskTemplate(template: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (this.isGuest) {
      const newTemplate: TaskTemplate = {
        ...template,
        id: Math.random().toString(36).substr(2, 9),
        order: guestStore.task_templates.length,
        owner_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      guestStore.task_templates.push(newTemplate);
      saveGuestStore(guestStore);
      return newTemplate.id;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'task_templates';
    try {
      const q = query(collection(db, path), where('owner_id', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const order = snapshot.size;

      const docRef = await addDoc(collection(db, path), {
        ...template,
        order,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateTaskTemplate(id: string, updates: Partial<TaskTemplate>) {
    if (this.isGuest) {
      const index = guestStore.task_templates.findIndex(t => t.id === id);
      if (index !== -1) {
        guestStore.task_templates[index] = {
          ...guestStore.task_templates[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        saveGuestStore(guestStore);
      }
      return;
    }
    const path = `task_templates/${id}`;
    try {
      await updateDoc(doc(db, 'task_templates', id), {
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteTaskTemplate(id: string) {
    if (this.isGuest) {
      guestStore.task_templates = guestStore.task_templates.filter(t => t.id !== id);
      guestStore.template_items = guestStore.template_items.filter(t => t.template_id !== id);
      saveGuestStore(guestStore);
      return;
    }
    const path = `task_templates/${id}`;
    try {
      // Delete associated template items first
      const q = query(
        collection(db, 'template_items'),
        where('template_id', '==', id),
        where('owner_id', '==', auth.currentUser?.uid)
      );
      const itemsSnapshot = await getDocs(q);
      const deletePromises = itemsSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete template
      await deleteDoc(doc(db, 'task_templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Template Items
  subscribeTemplateItems(templateId: string, callback: (items: TemplateItem[]) => void) {
    if (this.isGuest) {
      const update = () => {
        const filtered = guestStore.template_items.filter(t => t.template_id === templateId);
        callback(filtered);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'template_items'),
      where('template_id', '==', templateId),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateItem));
      items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(items);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'template_items', false));
  },

  async addTemplateItem(item: Omit<TemplateItem, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (this.isGuest) {
      const newItem: TemplateItem = {
        ...item,
        id: Math.random().toString(36).substr(2, 9),
        order: guestStore.template_items.filter(t => t.template_id === item.template_id).length,
        owner_id: 'guest',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      guestStore.template_items.push(newItem);
      saveGuestStore(guestStore);
      return newItem.id;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'template_items';
    try {
      const q = query(collection(db, path), where('template_id', '==', item.template_id), where('owner_id', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const order = snapshot.size;

      const docRef = await addDoc(collection(db, path), {
        ...item,
        order,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateTemplateItem(id: string, updates: Partial<TemplateItem>) {
    if (this.isGuest) {
      const index = guestStore.template_items.findIndex(t => t.id === id);
      if (index !== -1) {
        guestStore.template_items[index] = {
          ...guestStore.template_items[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        saveGuestStore(guestStore);
      }
      return;
    }
    const path = `template_items/${id}`;
    try {
      await updateDoc(doc(db, 'template_items', id), {
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async deleteTemplateItem(id: string) {
    if (this.isGuest) {
      guestStore.template_items = guestStore.template_items.filter(t => t.id !== id);
      saveGuestStore(guestStore);
      return;
    }
    const path = `template_items/${id}`;
    try {
      await deleteDoc(doc(db, 'template_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getTemplateItems(templateId: string) {
    if (this.isGuest) {
      return guestStore.template_items.filter(t => t.template_id === templateId);
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    const q = query(
      collection(db, 'template_items'),
      where('template_id', '==', templateId),
      where('owner_id', '==', auth.currentUser.uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateItem));
  },

  // Settings
  subscribeSettings(callback: (settings: UserSettings | null) => void) {
    if (this.isGuest) {
      const update = () => {
        callback(guestStore.settings);
      };
      update();
      guestObservers.add(update);
      return () => guestObservers.delete(update);
    }
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'settings'),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
      } else {
        const doc = snapshot.docs[0];
        callback({ id: doc.id, ...doc.data() } as UserSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings', false));
  },

  async updateSettings(id: string | undefined, settings: Partial<UserSettings>) {
    if (this.isGuest) {
      guestStore.settings = {
        ...(guestStore.settings || {
          id: 'guest-settings',
          owner_id: 'guest',
          ai_models: [],
          ui_preferences: { view: 'table', opacity: 1, theme: 'light', font: 'Inter' },
          notification_rules: [],
          updated_at: new Date().toISOString()
        }),
        ...settings,
        updated_at: new Date().toISOString()
      } as UserSettings;
      saveGuestStore(guestStore);
      return;
    }
    if (!auth.currentUser) throw new Error('User not authenticated');
    if (id) {
      const path = `settings/${id}`;
      try {
        await updateDoc(doc(db, 'settings', id), {
          ...settings,
          updated_at: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    } else {
      const path = 'settings';
      try {
        await addDoc(collection(db, path), {
          ...settings,
          owner_id: auth.currentUser.uid,
          updated_at: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  }
};
