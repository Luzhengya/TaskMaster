import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileCheck, AlertCircle, Loader2 } from 'lucide-react';
import { taskService } from '../services/taskService';

interface FileImportProps {
  onImportComplete: () => void;
}

export const FileImport: React.FC<FileImportProps> = ({ onImportComplete }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // Look for "週報" sheet or use the first one
        const sheetName = workbook.SheetNames.find(name => name.includes('週報')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 4 }) as any[][];

        if (jsonData.length === 0) {
          throw new Error("No data found in the selected sheet.");
        }

        const formatDate = (val: any) => {
          if (!val) return '';
          if (val instanceof Date) {
            return val.toISOString().split('T')[0];
          }
          return String(val);
        };

        // Map columns based on image:
        // A(0): System, B(1): Month, C(2): Case (Parent), F(5): Daily Report, G(6): Start, H(7): Due, I(8): Deadline, J(9): Status, K(10): Task, R(17): Planned, S(18): Actual, T(19): Priority, U(20): Remarks
        const parentTasksMap = new Map<string, string>(); // Name -> ID

        for (const row of jsonData) {
          const caseName = row[2]; // C列: 案件
          if (!caseName) continue;

          let parentId = parentTasksMap.get(caseName);
          if (!parentId) {
            // Create parent task if not exists
            const res = await taskService.addParentTask({
              name: String(caseName),
              deadline: formatDate(row[8]) || new Date().toISOString().split('T')[0], // Use I列 (Deadline) if available
              planned_hours: 1
            });
            if (res) {
              parentId = res.id;
              parentTasksMap.set(caseName, parentId);
            }
          }

          if (parentId) {
            await taskService.addSubTask({
              parent_task_id: parentId,
              system: String(row[0] || ''),
              month: String(row[1] || ''),
              daily_report_date: formatDate(row[5]),
              start_date: formatDate(row[6]),
              due_date: formatDate(row[7]),
              final_deadline: formatDate(row[8]),
              status: (row[9] || '未着手') as any,
              task_name: String(row[10] || 'Untitled Task'),
              planned_hours: Number(row[17] || 0),
              actual_hours: Number(row[18] || 0),
              priority: (row[19] || 'B') as any,
              remarks: String(row[20] || ''),
              week_number: Number(row[23] || 0),
              flag: Number(row[24] || 0)
            });
          }
        }

        setSuccess(`Successfully imported ${jsonData.length} rows.`);
        onImportComplete();
      } catch (err: any) {
        console.error("Import Error:", err);
        setError(err.message || "Failed to parse file.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-3xl p-12 shadow-sm border border-black/5 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
          {isUploading ? (
            <Loader2 size={40} className="text-[#5A5A40] animate-spin" />
          ) : (
            <Upload size={40} className="text-[#5A5A40]" />
          )}
        </div>
        
        <h2 className="text-2xl font-serif font-bold mb-2">Import Weekly Report</h2>
        <p className="text-gray-500 mb-8">
          Drag and drop your .xlsx or .csv file here, or click to browse.
          Data will be parsed starting from the 5th row.
        </p>

        <label className="relative group cursor-pointer inline-block">
          <input
            type="file"
            className="hidden"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <div className="px-8 py-4 bg-[#5A5A40] text-white rounded-2xl font-medium shadow-lg group-hover:bg-[#4A4A30] transition-all">
            {isUploading ? 'Processing...' : 'Select File'}
          </div>
        </label>

        {error && (
          <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 justify-center">
            <AlertCircle size={18} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-6 p-4 bg-green-50 text-green-600 rounded-xl flex items-center gap-3 justify-center">
            <FileCheck size={18} />
            <span className="text-sm font-medium">{success}</span>
          </div>
        )}
      </div>
    </div>
  );
};
