import React from 'react';

export default function DataSourcesLoading() {
  return (
    <div className="w-full max-w-full p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-5 w-48 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-72 rounded-md bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-32 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4" />
        ))}
      </div>

      {/* Sources Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-52 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5" />
        ))}
      </div>
    </div>
  );
}
