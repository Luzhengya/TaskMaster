import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { taskService } from '../services/taskService';
import { 
  Save, 
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

  if (!settings) return <div className="p-8 text-center text-[#86868b] italic">Initializing settings...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Settings</h2>
          <p className="text-[#86868b]">Configure AI, UI, and notifications</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mac-button mac-button-primary flex items-center gap-2"
        >
          {isSaving ? 'Saving...' : (
            <>
              <Save size={18} />
              <span>Save Changes</span>
            </>
          )}
        </button>
      </div>

      {showSuccess && (
        <div className="p-4 bg-green-50 text-green-600 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span className="font-medium text-sm">Settings saved successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* AI Configuration */}
        <section className="mac-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Cpu size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#1d1d1f]">AI Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-[#86868b] mb-4">
              Configure your preferred AI models for task summarization.
            </p>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-2">Active Model</p>
              <p className="font-medium text-sm">Gemini 3 Flash (Default)</p>
            </div>
          </div>
        </section>

        {/* UI Preferences */}
        <section className="mac-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 text-[#007aff] rounded-xl">
              <Palette size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#1d1d1f]">UI Preferences</h3>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-3">Table Opacity</label>
              <input 
                type="range" 
                min="0.5" 
                max="1" 
                step="0.1"
                value={isNaN(settings.ui_preferences.opacity) ? 1 : settings.ui_preferences.opacity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSettings({
                    ...settings,
                    ui_preferences: { ...settings.ui_preferences, opacity: isNaN(val) ? 1 : val }
                  });
                }}
                className="w-full accent-[#007aff]"
              />
              <div className="flex justify-between text-[10px] text-[#86868b] mt-1">
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-widest mb-3">System Font</label>
              <select 
                value={settings.ui_preferences.font}
                onChange={(e) => setSettings({
                  ...settings,
                  ui_preferences: { ...settings.ui_preferences, font: e.target.value }
                })}
                className="mac-input w-full"
              >
                <option value="Inter">Inter (Sans)</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mac-card p-8 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
              <Bell size={24} />
            </div>
            <h3 className="text-xl font-bold text-[#1d1d1f]">Notification Rules</h3>
          </div>
          
          <div className="space-y-4">
            {settings.notification_rules.map((rule, index) => (
              <div key={rule.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <input 
                  type="checkbox" 
                  checked={rule.enabled}
                  onChange={(e) => {
                    const newRules = [...settings.notification_rules];
                    newRules[index].enabled = e.target.checked;
                    setSettings({ ...settings, notification_rules: newRules });
                  }}
                  className="w-5 h-5 accent-[#007aff]"
                />
                <div className="flex-1">
                  <p className="font-medium text-sm">Daily Summary at {rule.time}</p>
                  <p className="text-[10px] text-[#86868b]">Includes: {rule.content_types.join(', ')}</p>
                </div>
                <button className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            
            <button className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-[#86868b] font-medium hover:border-[#007aff] hover:text-[#007aff] transition-all flex items-center justify-center gap-2 text-sm">
              <Plus size={18} />
              <span>Add Notification Rule</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
