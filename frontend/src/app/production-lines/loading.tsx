import React from 'react';

export default function ProductionLinesLoading() {
  return (
    <div className="w-full max-w-full p-4 sm:p-5 lg:p-6 space-y-5 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-5 w-56 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-3.5 w-80 rounded-md bg-slate-100 dark:bg-slate-800/60" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-44 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3" />
        ))}
      </div>

      {/* 6 Steps Grid skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3" />
        ))}
      </div>
    </div>
  );
}
