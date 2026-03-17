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
          const sheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'import') || workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          if (jsonData.length < 3) {
            throw new Error('Excel file format is invalid. Data should start from row 3.');
          }

          const rows = jsonData.slice(2); // Data starts from Row 3 (index 2)
          
          // Group rows by project name (Column E - index 4)
          const projectGroups = new Map<string, any[]>();
          for (const row of rows) {
            const projectName = String(row[4] || '').trim();
            if (!projectName) continue;
            if (!projectGroups.has(projectName)) {
              projectGroups.set(projectName, []);
            }
            projectGroups.get(projectName)?.push(row);
          }

          const parseDate = (val: any) => {
            if (!val) return '';
            if (val instanceof Date) return val.toISOString().split('T')[0];
            const str = String(val);
            if (str.includes('/')) return str.replace(/\//g, '-');
            return str;
          };

          const parseNumber = (val: any) => {
            const n = Number(val);
            return isNaN(n) ? 0 : n;
          };

          for (const [projectName, projectRows] of projectGroups.entries()) {
            // Calculate parent task metrics
            let totalPlanned = 0;
            let totalActual = 0;
            let completedCount = 0;
            const totalCount = projectRows.length;
            
            // Use Column H (index 7) from the LAST row for parent task deadline
            const lastRow = projectRows[projectRows.length - 1];
            const deadline = parseDate(lastRow[7]);

            for (const row of projectRows) {
              totalPlanned += parseNumber(row[16]); // Column Q (index 16)
              totalActual += parseNumber(row[17]); // Column R (index 17)
              if (String(row[9] || '').includes('済')) { // Column J (index 9)
                completedCount++;
              }
            }

            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

            // Add Parent Task
            const parentId = await taskService.addParentTask({
              name: projectName,
              deadline: deadline || new Date().toISOString().split('T')[0],
              planned_hours: totalPlanned,
              actual_hours: totalActual,
              progress: progress
            });

            if (!parentId) continue;

            // Add Sub Tasks
            for (const row of projectRows) {
              await taskService.addSubTask({
                parent_task_id: parentId,
                system: String(row[0] || ''), // Column A (index 0)
                month: String(row[2] || ''), // Column C (index 2)
                daily_report_date: new Date().toISOString().split('T')[0], // Default to today
                start_date: parseDate(row[6]), // Column G (index 6)
                due_date: parseDate(row[7]), // Column H (index 7)
                final_deadline: parseDate(row[8]), // Column I (index 8)
                status: String(row[9] || '未着手') as any, // Column J (index 9)
                task_name: String(row[10] || ''), // Column K (index 10)
                planned_hours: parseNumber(row[16]), // Column Q (index 16)
                actual_hours: parseNumber(row[17]), // Column R (index 17)
                priority: (row[18] || 'B') as any, // Column S (index 18)
                remarks: String(row[19] || ''), // Column T (index 19)
                week_number: 0,
                flag: 0
              });
            }
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
