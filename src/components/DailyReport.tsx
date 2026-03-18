import React, { useState, useEffect } from 'react';
import { SubTask } from '../types';
import { taskService } from '../services/taskService';
import { aiService } from '../services/aiService';
import { 
  Sparkles, 
  Clock, 
  AlertCircle, 
  Copy, 
  Loader2,
  RefreshCw,
  ListTodo
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DailyReportProps {
  onJumpToTask: (task: SubTask) => void;
}

export const DailyReport: React.FC<DailyReportProps> = ({ onJumpToTask }) => {
  const [allSubTasks, setAllSubTasks] = useState<SubTask[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = taskService.subscribeAllSubTasks(setAllSubTasks);
    return () => unsubscribe();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  
  const reportTasks = allSubTasks.filter(t => t.is_in_report);
  const todayTasks = reportTasks; // Show all checked tasks as requested
  const delayedTasks = reportTasks.filter(t => 
    t.status.includes('遅れ') || (t.final_deadline && t.final_deadline < today && t.status !== '済')
  );

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await aiService.generateSummary({
        today: todayTasks,
        unfinished: [],
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
        <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Daily Report</h2>
        <p className="text-[#86868b]">Review today's progress and generate AI insights</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Task Lists */}
        <div className="lg:col-span-2 space-y-6">
          <section className="mac-card p-6">
            <div className="flex items-center gap-2 mb-4 text-[#007aff]">
              <Clock size={20} />
              <h3 className="font-bold uppercase tracking-widest text-[10px]">Today's Scheduled</h3>
            </div>
            <div className="space-y-2">
              {todayTasks.length > 0 ? todayTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 group">
                  <button 
                    onClick={() => onJumpToTask(t)}
                    className="font-medium text-sm text-left hover:text-[#007aff] transition-colors"
                  >
                    {t.task_name}
                  </button>
                  <span className="text-[10px] px-2 py-0.5 bg-white rounded-md border border-gray-200 text-[#86868b]">{t.status}</span>
                </div>
              )) : (
                <p className="text-sm text-[#86868b] italic">No tasks scheduled for today.</p>
              )}
            </div>
          </section>

          <section className="mac-card p-6">
            <div className="flex items-center gap-2 mb-4 text-[#ff3b30]">
              <AlertCircle size={20} />
              <h3 className="font-bold uppercase tracking-widest text-[10px]">Delayed / Overdue</h3>
            </div>
            <div className="space-y-2">
              {delayedTasks.length > 0 ? delayedTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100 group">
                  <div className="flex-1 min-w-0">
                    <button 
                      onClick={() => onJumpToTask(t)}
                      className="font-medium block text-sm text-left hover:text-[#007aff] transition-colors truncate"
                    >
                      {t.task_name}
                    </button>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <span className="text-[10px] text-red-400 font-medium">Deadline: {t.final_deadline}</span>
                      {t.delay_reason && (
                        <span className="text-[10px] text-[#86868b] bg-white/50 px-2 py-0.5 rounded border border-red-100/50 italic">
                          原因: {t.delay_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 bg-white text-red-600 rounded-md border border-red-100 ml-4 h-fit">{t.status}</span>
                </div>
              )) : (
                <p className="text-sm text-[#86868b] italic">No delayed tasks. Great job!</p>
              )}
            </div>
          </section>
        </div>

        {/* AI Summary */}
        <div className="space-y-6">
          <div className="bg-[#007aff] text-white rounded-[20px] p-8 shadow-lg relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Sparkles size={24} />
                  <h3 className="text-xl font-bold">AI Insights</h3>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <RefreshCw size={20} />}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-500/20 rounded-lg text-xs border border-red-500/30">
                  {error}
                </div>
              )}

              {summary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                  <button 
                    onClick={() => navigator.clipboard.writeText(summary)}
                    className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Copy size={14} />
                    Copy Summary
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-white/60 italic text-sm mb-6">Click the refresh icon to generate today's AI summary.</p>
                  <button 
                    onClick={handleGenerateSummary}
                    disabled={isGenerating}
                    className="px-6 py-2 bg-white text-[#007aff] rounded-lg font-bold shadow-sm hover:bg-gray-100 transition-all disabled:opacity-50"
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
