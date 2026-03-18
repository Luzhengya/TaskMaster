import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signOut,
  signInAnonymously 
} from 'firebase/auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { SubTaskManagement } from './components/SubTaskManagement';
import { TemplateManagement } from './components/TemplateManagement';
import { History } from './components/History';
import { FileImport } from './components/FileImport';
import { DailyReport } from './components/DailyReport';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { taskService } from './services/taskService';
import { ParentTask, UserSettings } from './types';
import { LogIn, Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedParentTask, setSelectedParentTask] = useState<ParentTask | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    console.log('Setting up onAuthStateChanged listener...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? `User logged in: ${user.email}` : 'No user');
      setUser(user);
      if (user) {
        setIsGuest(user.isAnonymous);
        taskService.isGuest = user.isAnonymous;
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user || isGuest) {
      taskService.testConnection();
      
      const unsubscribeTasks = taskService.subscribeParentTasks(setParentTasks);
      const unsubscribeSettings = taskService.subscribeSettings((s) => {
        if (!s) {
          // Initialize default settings for new user
          taskService.updateSettings(undefined, {
            ai_models: [],
            ui_preferences: {
              view: 'table',
              opacity: 1,
              theme: 'light',
              font: 'Inter'
            },
            notification_rules: [
              { id: 'default', enabled: true, time: '09:00', content_types: ['today_tasks', 'delayed_tasks'], days_before_deadline: 3 }
            ]
          });
        } else {
          setSettings(s);
        }
      });

      return () => {
        unsubscribeTasks();
        unsubscribeSettings();
      };
    } else {
      // Clear data when no user
      setParentTasks([]);
      setSettings(null);
      setSelectedParentTask(null);
      setHighlightTaskId(null);
    }
  }, [user, isGuest]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    console.log('Starting Google login with popup...');
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to avoid automatic login with wrong account
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // Use signInWithPopup which is generally more reliable in modern browsers
      const result = await signInWithPopup(auth, provider);
      console.log('Google login successful, user:', result.user.email);
    } catch (error: any) {
      console.error('Google login failed:', error);
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setIsLoggingIn(true);
    console.log('Starting Microsoft login...');
    try {
      const provider = new OAuthProvider('microsoft.com');
      // Force account selection
      provider.setCustomParameters({ prompt: 'select_account' });
      
      await signInWithPopup(auth, provider);
      console.log('Microsoft login successful');
    } catch (error: any) {
      handleAuthError(error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuthError = (error: any) => {
    console.error('Auth error details:', error);
    
    const currentDomain = window.location.hostname;
    
    if (error.code === 'auth/popup-blocked') {
      alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。\n(Popup was blocked. Please allow popups for this site.)');
    } else if (error.code === 'auth/unauthorized-domain') {
      alert(`このドメイン(${currentDomain})はFirebaseで許可されていません。Firebase Consoleの「Authentication」>「Settings」>「Authorized domains」に現在のURLを追加してください。\n(This domain is not authorized. Please add ${currentDomain} to the "Authorized domains" list in Firebase Console.)`);
    } else if (error.code === 'auth/admin-restricted-operation') {
      console.log('Anonymous Auth is disabled. Using local guest mode.');
    } else if (error.code === 'auth/network-request-failed') {
      console.warn('Network request failed. Falling back to local guest mode.');
      alert('ネットワーク接続に失敗しました。オフラインか、Firebaseへの接続が遮断されている可能性があります。ゲストモードで続行できます。\n(Network request failed. You might be offline or the connection to Firebase is blocked. You can continue in Guest Mode.)');
    } else if (error.code === 'auth/popup-closed-by-user') {
      // User closed the popup, no need for alert
      console.log('User closed the login popup');
    } else {
      alert(`ログインに失敗しました: ${error.message || 'Unknown error'}\n(Error Code: ${error.code})`);
    }
  };

  console.log('App Render:', { isAuthReady, user: !!user, isGuest });

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <div className="text-center">
          <Loader2 className="animate-spin text-[#007aff] mx-auto mb-4" size={40} />
          <p className="text-sm text-[#86868b]">Initializing...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    console.log('Rendering Login Screen');
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7] p-4">
        <div className="max-w-md w-full mac-card p-12 text-center">
          <div className="w-20 h-20 bg-[#F5F5F7] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
            <LogIn size={40} className="text-[#007aff]" />
          </div>
          <h1 className="text-4xl font-bold text-[#1d1d1f] mb-4 tracking-tight">TaskMaster</h1>
          <p className="text-[#86868b] mb-10 leading-relaxed text-sm">
            Your personal productivity hub. Manage tasks, import reports, and get AI-powered summaries with a clean macOS experience.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full py-4 bg-white text-[#1d1d1f] border border-black/10 rounded-2xl font-bold shadow-sm hover:bg-gray-50 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              )}
              {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
            <button
              onClick={handleMicrosoftLogin}
              disabled={isLoggingIn}
              className="w-full py-4 bg-[#2f2f2f] text-white rounded-2xl font-bold shadow-lg hover:bg-black hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <img src="https://www.microsoft.com/favicon.ico" className="w-5 h-5" alt="Microsoft" />
              )}
              {isLoggingIn ? 'Signing in...' : 'Sign in with Microsoft'}
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-black/5 space-y-4">
            <button 
              onClick={async () => {
                setIsLoggingIn(true);
                console.log('Attempting guest login...');
                try {
                  // Try Firebase Anonymous Auth first
                  await signInAnonymously(auth);
                  setIsGuest(true);
                  taskService.isGuest = true;
                  console.log('Firebase anonymous login successful');
                } catch (error: any) {
                  // Silent fallback for expected admin-restricted-operation (Anonymous Auth disabled)
                  if (error.code !== 'auth/admin-restricted-operation') {
                    console.warn('Firebase anonymous login failed, falling back to local guest mode:', error);
                  }
                  
                  taskService.isGuest = true;
                  setIsGuest(true);
                  console.log('Local guest mode activated');
                } finally {
                  setIsLoggingIn(false);
                }
              }}
              disabled={isLoggingIn}
              className="w-full py-3 bg-gray-100 text-[#1d1d1f] rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              Try as Guest (Local Mode)
            </button>
            <p className="text-[10px] text-[#86868b]">
              Guest mode saves data in your browser's local storage.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    const wasAnonymous = user?.isAnonymous || isGuest;
    if (wasAnonymous) {
      console.log('Cleaning up guest data before logout...');
      try {
        if (user) {
          await taskService.cleanupUserData(user.uid);
        } else {
          await taskService.cleanupUserData('guest');
        }
      } catch (error) {
        console.error('Failed to cleanup guest data:', error);
      }
    }
    await signOut(auth);
    if (wasAnonymous) {
      setIsGuest(false);
      taskService.isGuest = false;
      window.location.reload();
    }
  };

  const renderContent = () => {
    if (selectedParentTask) {
      return (
        <SubTaskManagement 
          parentTask={selectedParentTask} 
          onBack={() => {
            setSelectedParentTask(null);
            setHighlightTaskId(null);
          }} 
          highlightTaskId={highlightTaskId}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard parentTasks={parentTasks} onSelectTask={setSelectedParentTask} settings={settings} />;
      case 'templates':
        return <TemplateManagement />;
      case 'history':
        return <History onSelectTask={setSelectedParentTask} settings={settings} />;
      case 'import':
        return <FileImport onImportComplete={() => setActiveTab('dashboard')} />;
      case 'reports':
        return (
          <DailyReport 
            onJumpToTask={(task) => {
              const parent = parentTasks.find(p => p.id === task.parent_task_id);
              if (parent) {
                setSelectedParentTask(parent);
                setHighlightTaskId(task.id);
              }
            }} 
          />
        );
      case 'settings':
        return <Settings />;
      case 'tasks':
        return (
          <div className="p-12 text-center mac-card">
            <h3 className="text-xl font-bold mb-2 text-[#1d1d1f]">タスク一覧</h3>
            <p className="text-[#86868b] text-sm">案件一覧からプロジェクトを選択して詳細タスクを管理してください。</p>
          </div>
        );
      default:
        return <Dashboard parentTasks={parentTasks} onSelectTask={setSelectedParentTask} settings={settings} />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedParentTask(null);
          setHighlightTaskId(null);
        }} 
        user={user}
        onLogout={handleLogout}
      >
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}
