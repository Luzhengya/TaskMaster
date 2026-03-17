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
  getDocFromServer
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

export const taskService = {
  // Test connection
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if(error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. ");
      }
    }
  },

  // Parent Tasks
  subscribeParentTasks(callback: (tasks: ParentTask[]) => void, showHidden = false) {
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
    const path = `sub_tasks/${id}`;
    try {
      await deleteDoc(doc(db, 'sub_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Task Templates
  subscribeTaskTemplates(callback: (templates: TaskTemplate[]) => void) {
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
    const path = `template_items/${id}`;
    try {
      await deleteDoc(doc(db, 'template_items', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async getTemplateItems(templateId: string) {
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
