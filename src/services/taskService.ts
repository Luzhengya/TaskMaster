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

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
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
  throw new Error(JSON.stringify(errInfo));
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
  subscribeParentTasks(callback: (tasks: ParentTask[]) => void) {
    if (!auth.currentUser) return () => {};
    const q = query(
      collection(db, 'parent_tasks'),
      where('owner_id', '==', auth.currentUser.uid)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentTask));
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'parent_tasks'));
  },

  async addParentTask(task: Omit<ParentTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'parent_tasks';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...task,
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
        where('parent_task_id', '==', id)
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
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sub_tasks'));
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
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sub_tasks'));
  },

  async addSubTask(task: Omit<SubTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'sub_tasks';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...task,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
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
      callback(templates);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'task_templates'));
  },

  async addTaskTemplate(template: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    const path = 'task_templates';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...template,
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
      await deleteDoc(doc(db, 'task_templates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
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
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'settings'));
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
