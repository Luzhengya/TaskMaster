import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth } from './firebase';
import { waitForAuthRedirectResult } from './authInit';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
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

function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

function createMicrosoftAuthProvider(): OAuthProvider {
  const provider = new OAuthProvider('microsoft.com');
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

const POPUP_FALLBACK_TO_REDIRECT_CODES = new Set([
  'auth/popup-blocked',
  'auth/internal-error',
  'auth/web-storage-unsupported',
]);

/** Set to `true` when Microsoft sign-in should be offered again. */
const MICROSOFT_SIGN_IN_ENABLED = false;

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedParentTask, setSelectedParentTask] = useState<ParentTask | null>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
  const [parentTasks, setParentTasks] = useState<ParentTask[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const loginInFlightRef = useRef(false);

  const handleAuthError = useCallback((error: any) => {
    console.error('Auth error details:', error);

    const currentDomain = window.location.hostname;

    if (error.code === 'auth/popup-blocked') {
      alert('ポップアップがブロックされました。ブラウザの設定でポップアップを許可してください。\n(Popup was blocked. Please allow popups for this site.)');
    } else if (error.code === 'auth/unauthorized-domain') {
      alert(`このドメイン(${currentDomain})はFirebaseで許可されていません。Firebase Consoleの「Authentication」>「Settings」>「Authorized domains」に現在のURLを追加してください（例: localhost、127.0.0.1 は別々に追加）。\n(This domain is not authorized. Add ${currentDomain} to Authorized domains in Firebase Console. Note: localhost and 127.0.0.1 are separate entries.)`);
    } else if (error.code === 'auth/operation-not-allowed') {
      alert('Firebase コンソールで「Authentication」>「Sign-in method」から Google ログインを有効にしてください。\n(Enable Google as a sign-in provider in Firebase Console > Authentication > Sign-in method.)');
    } else if (error.code === 'auth/admin-restricted-operation') {
      console.log('Anonymous Auth is disabled. Using local guest mode.');
    } else if (error.code === 'auth/network-request-failed') {
      console.warn('Network request failed. Falling back to local guest mode.');
      alert('ネットワーク接続に失敗しました。オフラインか、Firebaseへの接続が遮断されている可能性があります。ゲストモードで続行できます。\n(Network request failed. You might be offline or the connection to Firebase is blocked. You can continue in Guest Mode.)');
    } else if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the login popup');
    } else {
      alert(`ログインに失敗しました: ${error.message || 'Unknown error'}\n(Error Code: ${error.code})`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        await waitForAuthRedirectResult();
      } catch (error: any) {
        console.error('getRedirectResult failed:', error);
        if (!cancelled) handleAuthError(error);
      }

      if (cancelled) return;

      console.log('Setting up onAuthStateChanged listener...');
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (cancelled) return;
        console.log('Auth state changed:', user ? `User logged in: ${user.email}` : 'No user');
        setUser(user);
        if (user) {
          setIsGuest(user.isAnonymous);
          taskService.isGuest = user.isAnonymous;
        }
        setIsAuthReady(true);
      });
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      setIsAuthReady(false);
    };
  }, [handleAuthError]);

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

  const signInWithGooglePopup = async () => {
    await waitForAuthRedirectResult();
    const result = await signInWithPopup(auth, createGoogleAuthProvider());
    console.log('Google login successful, user:', result.user.email);
  };

  const handleLogin = async () => {
    if (loginInFlightRef.current || isLoggingIn || !isAuthReady) return;
    loginInFlightRef.current = true;
    setIsLoggingIn(true);
    console.log('Starting Google login with popup...');
    try {
      try {
        await signInWithGooglePopup();
      } catch (error: any) {
        if (error?.code === 'auth/cancelled-popup-request') {
          console.warn('Popup request cancelled, retrying once...');
          await new Promise(resolve => setTimeout(resolve, 300));
          await signInWithGooglePopup();
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error('Google login failed:', error);
      if (POPUP_FALLBACK_TO_REDIRECT_CODES.has(error?.code)) {
        try {
          console.warn('Falling back to signInWithRedirect after:', error.code);
          await signInWithRedirect(auth, createGoogleAuthProvider());
          return;
        } catch (redirectErr: any) {
          console.error('Google redirect sign-in failed:', redirectErr);
          handleAuthError(redirectErr);
        }
      } else {
        handleAuthError(error);
      }
    } finally {
      loginInFlightRef.current = false;
      setIsLoggingIn(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (loginInFlightRef.current || isLoggingIn || !isAuthReady) return;
    loginInFlightRef.current = true;
    setIsLoggingIn(true);
    console.log('Starting Microsoft login...');
    const provider = createMicrosoftAuthProvider();
    try {
      await waitForAuthRedirectResult();
      await signInWithPopup(auth, provider);
      console.log('Microsoft login successful');
    } catch (error: any) {
      if (POPUP_FALLBACK_TO_REDIRECT_CODES.has(error?.code)) {
        try {
          console.warn('Falling back to signInWithRedirect (Microsoft) after:', error.code);
          await signInWithRedirect(auth, createMicrosoftAuthProvider());
          return;
        } catch (redirectErr: any) {
          handleAuthError(redirectErr);
        }
      } else {
        handleAuthError(error);
      }
    } finally {
      loginInFlightRef.current = false;
      setIsLoggingIn(false);
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
            Your personal productivity hub. Manage tasks, import reports, and get AI-powered summaries
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleLogin}
              disabled={!isAuthReady || isLoggingIn || isGuestLoading}
              className={`w-full py-4 bg-white text-[#1d1d1f] border border-black/10 rounded-2xl font-bold shadow-sm hover:bg-gray-50 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 ${
                isLoggingIn ? 'opacity-50 cursor-not-allowed' : isGuestLoading ? 'cursor-wait' : ''
              }`}
            >
              {isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              )}
              {isLoggingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>
            <button
              type="button"
              onClick={handleMicrosoftLogin}
              disabled={!MICROSOFT_SIGN_IN_ENABLED || isLoggingIn || isGuestLoading}
              title={
                MICROSOFT_SIGN_IN_ENABLED
                  ? undefined
                  : 'Microsoft sign-in is temporarily unavailable'
              }
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all ${
                MICROSOFT_SIGN_IN_ENABLED
                  ? 'bg-[#2f2f2f] text-white shadow-lg hover:bg-black hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-[#2f2f2f]/45 text-white/65 cursor-not-allowed border border-black/10'
              }`}
            >
              {MICROSOFT_SIGN_IN_ENABLED && isLoggingIn ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <img src="https://www.microsoft.com/favicon.ico" className="w-5 h-5 opacity-60" alt="" />
              )}
              {MICROSOFT_SIGN_IN_ENABLED && isLoggingIn
                ? 'Signing in...'
                : 'Sign in with Microsoft'}
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-black/5 space-y-4">
            <button 
              type="button"
              onClick={async () => {
                setIsGuestLoading(true);
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
                  setIsGuestLoading(false);
                }
              }}
              disabled={isGuestLoading || isLoggingIn}
              className="w-full py-3 bg-gray-100 text-[#1d1d1f] rounded-2xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGuestLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : null}
              {isGuestLoading ? 'Starting guest mode...' : 'Try as Guest'}
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
