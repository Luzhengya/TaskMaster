import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { SubTaskManagement } from './components/SubTaskManagement';
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

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0]">
        <Loader2 className="animate-spin text-[#5A5A40]" size={40} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-12 text-center border border-black/5">
          <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-8">
            <LogIn size={40} className="text-[#5A5A40]" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-[#1A1A1A] mb-4">TaskMaster AI</h1>
          <p className="text-gray-500 mb-10 leading-relaxed">
            Your personal productivity hub. Manage tasks, import reports, and get AI-powered summaries.
          </p>
          <button
            onClick={handleLogin}
            className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold shadow-xl hover:bg-[#4A4A30] hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
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
          onBack={() => setSelectedParentTask(null)} 
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard parentTasks={parentTasks} onSelectTask={setSelectedParentTask} />;
      case 'import':
        return <FileImport onImportComplete={() => setActiveTab('dashboard')} />;
      case 'reports':
        return <DailyReport />;
      case 'settings':
        return <Settings />;
      case 'tasks':
        return (
          <div className="p-12 text-center bg-white rounded-3xl border border-black/5">
            <h3 className="text-xl font-serif font-bold mb-2">Task List View</h3>
            <p className="text-gray-400">Select a project from the Dashboard to manage detailed tasks.</p>
          </div>
        );
      default:
        return <Dashboard parentTasks={parentTasks} onSelectTask={setSelectedParentTask} />;
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
