import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedParentTask, setSelectedParentTask] = useState<ParentTask | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
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
    }
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Force account selection to avoid automatic login with wrong account
      provider.setCustomParameters({ prompt: 'select_account' });
      
      // Use signInWithPopup which is generally more reliable in modern browsers
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error messages based on common Firebase Auth error codes
      if (error.code === 'auth/popup-blocked') {
        alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。\n(Popup was blocked. Please allow popups for this site.)');
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('このドメインはFirebaseで許可されていません。Firebase Consoleの「承認済みドメイン」に現在のURLを追加してください。\n(This domain is not authorized. Please add your Vercel URL to the "Authorized domains" list in Firebase Console.)');
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need for alert
      } else {
        alert('ログインに失敗しました: ' + error.message);
      }
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]">
        <Loader2 className="animate-spin text-[#007aff]" size={40} />
      </div>
    );
  }

  if (!user) {
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
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-[#007aff] text-white rounded-2xl font-bold shadow-lg hover:bg-[#0062cc] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

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
      <Layout activeTab={activeTab} setActiveTab={(tab) => {
        setActiveTab(tab);
        setSelectedParentTask(null);
      }} user={user}>
        {renderContent()}
      </Layout>
    </ErrorBoundary>
  );
}
