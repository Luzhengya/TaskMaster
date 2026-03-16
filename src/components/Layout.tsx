import React from 'react';
import { LayoutDashboard, ListTodo, FileUp, Settings, BarChart3, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, user }) => {
  const navItems = [
    { id: 'dashboard', label: '案件一覧', icon: LayoutDashboard },
    { id: 'tasks', label: 'タスク', icon: ListTodo },
    { id: 'import', label: 'インポート', icon: FileUp },
    { id: 'reports', label: '日報', icon: BarChart3 },
    { id: 'settings', label: '設定', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-[#f5f5f7] font-sans text-[#1d1d1f]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#ebebeb] border-r border-gray-300 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#007aff] rounded-xl flex items-center justify-center shadow-lg shadow-[#007aff]/20">
            <ListTodo className="text-white" size={24} />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#1d1d1f]">TaskMaster</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-[#007aff] text-white shadow-sm'
                  : 'text-[#424245] hover:bg-gray-200'
              }`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-300">
          <div className="flex items-center gap-3 p-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-xs font-bold border border-gray-400">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-[#1d1d1f] truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#ff3b30] hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-6xl mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
};
