import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex-1 w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 text-slate-400 animate-in fade-in duration-150">
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-2xl shadow-xs">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Đang tải dữ liệu...
        </span>
      </div>
    </div>
  );
}
