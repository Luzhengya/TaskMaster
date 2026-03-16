import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
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
    const q = query(collection(db, 'parent_tasks'), where('owner_id', '==', auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ParentTask));
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'parent_tasks'));
  },

  async addParentTask(task: Omit<ParentTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const path = 'parent_tasks';
    try {
      return await addDoc(collection(db, path), {
        ...task,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
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
      await deleteDoc(doc(db, 'parent_tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
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
      where('owner_id', '==', auth.currentUser.uid),
      where('parent_task_id', '==', parentTaskId)
    );
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubTask));
      callback(tasks);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sub_tasks'));
  },

  async addSubTask(task: Omit<SubTask, 'id' | 'created_at' | 'updated_at' | 'owner_id'>) {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const path = 'sub_tasks';
    try {
      return await addDoc(collection(db, path), {
        ...task,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
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

  // Settings
  subscribeSettings(callback: (settings: UserSettings | null) => void) {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'settings'), where('owner_id', '==', auth.currentUser.uid));
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
    if (!auth.currentUser) throw new Error('Not authenticated');
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
