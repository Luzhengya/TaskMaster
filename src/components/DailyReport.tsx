import React, { useState, useEffect } from 'react';
import { SubTask } from '../types';
import { taskService } from '../services/taskService';
import { aiService } from '../services/aiService';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Copy, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export const DailyReport: React.FC = () => {
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = taskService.subscribeAllSubTasks(setAllSubTasks);
    return () => unsubscribe();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  
  const todayTasks = allSubTasks.filter(t => t.daily_report_date === today);
  const unfinishedTasks = allSubTasks.filter(t => t.status !== '済');
  const delayedTasks = allSubTasks.filter(t => 
    t.status.includes('遅れ') || (t.final_deadline && t.final_deadline < today && t.status !== '済')
  );

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await aiService.generateSummary({
        today: todayTasks,
        unfinished: unfinishedTasks,
        delayed: delayedTasks
      });
      setSummary(res);
    } catch (err: any) {
      setError(err.message || "Failed to generate summary.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold">Daily Report & AI Summary</h2>
        <p className="text-gray-500">Review today's progress and generate AI insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Lists */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
            <div className="flex items-center gap-2 mb-4 text-[#5A5A40]">
              <Clock size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Today's Scheduled</h3>
            </div>
            <div className="space-y-3">
              {todayTasks.length > 0 ? todayTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="font-medium">{t.task_name}</span>
                  <span className="text-xs px-2 py-1 bg-white rounded-lg border border-black/5">{t.status}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 italic">No tasks scheduled for today.</p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
            <div className="flex items-center gap-2 mb-4 text-red-500">
              <AlertCircle size={20} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Delayed / Overdue</h3>
            </div>
            <div className="space-y-3">
              {delayedTasks.length > 0 ? delayedTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                  <div>
                    <span className="font-medium block">{t.task_name}</span>
                    <span className="text-xs text-red-400">Deadline: {t.final_deadline}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-white text-red-600 rounded-lg border border-red-100">{t.status}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 italic">No delayed tasks. Great job!</p>
              )}
            </div>
          </section>
        </div>

        {/* AI Summary */}
        <div className="space-y-6">
          <div className="bg-[#5A5A40] text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles size={24} />
                  <h3 className="text-xl font-serif font-bold">AI Insights</h3>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 rounded-xl text-xs border border-red-500/30">
                  {error}
                </div>
              )}

              {summary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                  <button 
                    onClick={() => navigator.clipboard.writeText(summary)}
                    className="mt-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Copy size={14} />
                    Copy Summary
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-white/60 italic mb-6">Click the refresh icon to generate today's AI summary.</p>
                  <button 
                    onClick={handleGenerateSummary}
                    disabled={isGenerating}
                    className="px-6 py-3 bg-white text-[#5A5A40] rounded-xl font-bold shadow-lg hover:bg-gray-100 transition-all disabled:opacity-50"
                  >
                    {isGenerating ? 'Generating...' : 'Generate Now'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Decorative background element */}
            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
};
