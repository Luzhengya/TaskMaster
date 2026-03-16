import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { taskService } from '../services/taskService';
import { format } from 'date-fns';

interface FileImportProps {
  onImportComplete: () => void;
}

export const FileImport: React.FC<FileImportProps> = ({ onImportComplete }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 2) {
            throw new Error('Excel file is empty or invalid format.');
          }

          const rows = jsonData.slice(1);
          const parentTasksMap = new Map<string, string>();

          for (const row of rows) {
            const caseName = row[5]; // Column F for case name (Project)
            if (!caseName) continue;

            if (!parentTasksMap.has(caseName)) {
              const deadlineStr = row[8]; // Column I for final deadline (Project Deadline)
              const deadline = deadlineStr ? (deadlineStr instanceof Date ? deadlineStr.toISOString().split('T')[0] : String(deadlineStr)) : new Date().toISOString().split('T')[0];
              
              const parentId = await taskService.addParentTask({
                name: String(caseName),
                deadline: deadline,
                planned_hours: 1
              });
              if (parentId) {
                parentTasksMap.set(caseName, parentId);
              }
            }

            const parentId = parentTasksMap.get(caseName);
            if (!parentId) continue;
            
            const parseDate = (val: any) => {
              if (!val) return '';
              if (val instanceof Date) return val.toISOString().split('T')[0];
              // Handle string dates if they are in YYYY/MM/DD format
              const str = String(val);
              if (str.includes('/')) {
                return str.replace(/\//g, '-');
              }
              return str;
            };

            const parseNumber = (val: any) => {
              const n = Number(val);
              return isNaN(n) ? 0 : n;
            };

            await taskService.addSubTask({
              parent_task_id: parentId,
              system: String(row[0] || ''), // Column A
              month: String(row[1] || ''), // Column B
              daily_report_date: parseDate(row[6]), // Column G (日報)
              start_date: parseDate(row[7]), // Column H (開始日)
              due_date: parseDate(row[8]), // Column I (期日)
              final_deadline: parseDate(row[9]), // Column J (期限)
              status: String(row[10] || '未着手') as any, // Column K (ステータス)
              task_name: String(row[11] || ''), // Column L (タスク)
              planned_hours: parseNumber(row[17]), // Column R (予定工数)
              actual_hours: parseNumber(row[18]), // Column S (実績工数)
              priority: (row[19] || 'B') as any, // Column T (優先度)
              remarks: String(row[20] || ''), // Column U (備考)
              week_number: parseNumber(row[22]), // Column W (週次) - Wait, W is 22? A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, J=9, K=10, L=11, M=12, N=13, O=14, P=15, Q=16, R=17, S=18, T=19, U=20, V=21, W=22. Yes.
              flag: 0
            });
          }

          setSuccess(true);
          setTimeout(() => {
            onImportComplete();
          }, 1500);
        } catch (err: any) {
          setError(err.message || 'Failed to process Excel file.');
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setError(err.message || 'Failed to read file.');
      setIsImporting(false);
    }
  }, [onImportComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-3xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer ${
          isDragActive ? 'border-[#007aff] bg-[#007aff]/5' : 'border-black/10 hover:border-[#007aff]/50 hover:bg-black/[0.02]'
        } ${isImporting ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input {...getInputProps()} />
        
        {isImporting ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#007aff] animate-spin mx-auto mb-4" />
            <p className="text-lg font-bold">Importing Data...</p>
            <p className="text-sm text-[#86868b]">Please wait while we process your file</p>
          </div>
        ) : success ? (
          <div className="text-center animate-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-[#28c840] mx-auto mb-4" />
            <p className="text-lg font-bold">Import Successful!</p>
            <p className="text-sm text-[#86868b]">Redirecting to task list...</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-[#f5f5f7] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileUp className="w-8 h-8 text-[#007aff]" />
            </div>
            <p className="text-lg font-bold mb-2">
              {isDragActive ? 'Drop your file here' : 'Click or drag Excel file to import'}
            </p>
            <p className="text-sm text-[#86868b] mb-6">Supports .xlsx and .xls formats</p>
            <div className="flex items-center gap-2 text-[10px] font-bold text-[#86868b] uppercase tracking-widest bg-[#f5f5f7] px-4 py-2 rounded-full">
              <FileText size={12} />
              Weekly Report Format Required
            </div>
          </div>
        )}

        {error && (
          <div className="absolute -bottom-16 left-0 right-0 p-4 bg-[#fff2f2] text-[#ff3b30] rounded-xl flex items-center gap-3 text-sm border border-[#ff3b30]/10 animate-in slide-in-from-top-2">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
