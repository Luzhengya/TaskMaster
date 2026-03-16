import React, { useState, useEffect } from 'react';
import { UserSettings, AIModelConfig, NotificationRule } from '../types';
import { taskService } from '../services/taskService';
import { 
  Save, 
  Settings as SettingsIcon, 
  Cpu, 
  Palette, 
  Bell, 
  Plus, 
  Trash2,
  CheckCircle2
} from 'lucide-react';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = taskService.subscribeSettings(setSettings);
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      await taskService.updateSettings(settings.id, settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return <div className="p-8 text-center text-gray-400 italic">Initializing settings...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif font-bold">System Settings</h2>
          <p className="text-gray-500">Configure AI, UI, and notifications</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-2xl font-medium shadow-lg hover:bg-[#4A4A30] transition-all disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : (
            <>
              <Save size={20} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {showSuccess && (
        <div className="p-4 bg-green-50 text-green-600 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={20} />
          <span className="font-medium">Settings saved successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* AI Configuration */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Cpu size={24} />
            </div>
            <h3 className="text-xl font-serif font-bold">AI Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">
              Configure your preferred AI models for task summarization.
            </p>
            {/* Simplified for now: just show current config */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-black/5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Active Model</p>
              <p className="font-medium">Gemini 3 Flash (Default)</p>
            </div>
          </div>
        </section>

        {/* UI Preferences */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Palette size={24} />
            </div>
            <h3 className="text-xl font-serif font-bold">UI Preferences</h3>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Table Opacity</label>
              <input 
                type="range" 
                min="0.5" 
                max="1" 
                step="0.1"
                value={settings.ui_preferences.opacity}
                onChange={(e) => setSettings({
                  ...settings,
                  ui_preferences: { ...settings.ui_preferences, opacity: Number(e.target.value) }
                })}
                className="w-full accent-[#5A5A40]"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">System Font</label>
              <select 
                value={settings.ui_preferences.font}
                onChange={(e) => setSettings({
                  ...settings,
                  ui_preferences: { ...settings.ui_preferences, font: e.target.value }
                })}
                className="w-full px-4 py-3 bg-gray-50 border border-black/5 rounded-xl focus:outline-none"
              >
                <option value="Inter">Inter (Sans)</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <Bell size={24} />
            </div>
            <h3 className="text-xl font-serif font-bold">Notification Rules</h3>
          </div>
          
          <div className="space-y-4">
            {settings.notification_rules.map((rule, index) => (
              <div key={rule.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-black/5">
                <input 
                  type="checkbox" 
                  checked={rule.enabled}
                  onChange={(e) => {
                    const newRules = [...settings.notification_rules];
                    newRules[index].enabled = e.target.checked;
                    setSettings({ ...settings, notification_rules: newRules });
                  }}
                  className="w-5 h-5 accent-[#5A5A40]"
                />
                <div className="flex-1">
                  <p className="font-medium">Daily Summary at {rule.time}</p>
                  <p className="text-xs text-gray-400">Includes: {rule.content_types.join(', ')}</p>
                </div>
                <button className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            
            <button className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-medium hover:border-[#5A5A40] hover:text-[#5A5A40] transition-all flex items-center justify-center gap-2">
              <Plus size={18} />
              <span>Add Notification Rule</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
