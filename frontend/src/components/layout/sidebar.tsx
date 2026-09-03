'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Database,
  Factory,
  Globe,
  Layers,
  Moon,
  Sun,
} from 'lucide-react';
import { useTheme } from '@/context/theme-context';
import { useLanguage } from '@/context/language-context';

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale, t } = useLanguage();

  const navItems = [
    {
      label: t('navDataSources'),
      href: '/data-sources',
      icon: Database,
      active: pathname === '/data-sources',
    },
    {
      label: t('navProductionLines'),
      href: '/production-lines',
      icon: Factory,
      active: pathname === '/production-lines',
    },
    {
      label: 'Supplier Portal (HTML)',
      href: 'http://localhost:4000/fixtures/supplier/deliveries',
      icon: Globe,
      external: true,
      active: false,
    },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 select-none ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      {collapsed ? (
        <div className="flex h-16 w-full items-center justify-center relative border-b border-slate-200 dark:border-slate-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <Layers className="h-5 w-5" />
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-30 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white shadow-sm hover:scale-110 transition-transform"
            title={t('navExpand')}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm tracking-wide text-slate-900 dark:text-white leading-tight">
                Celesnity MES
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Industrial Laundry
              </span>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 transition-colors"
            title={t('navCollapse')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className={`flex-1 space-y-1.5 ${collapsed ? 'px-2 py-3' : 'p-3'}`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch={!item.external}
              target={item.external ? '_blank' : undefined}
              className={`flex items-center ${
                collapsed ? 'justify-center h-11 w-full' : 'gap-3 px-3 py-2.5'
              } rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`h-5 w-5 shrink-0 ${item.active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Controls: Theme Toggle & Language Selector */}
      <div className={`border-t border-slate-200 dark:border-slate-800 ${collapsed ? 'p-2 pb-8 flex flex-col items-center gap-2.5' : 'p-3 pb-8 space-y-2'}`}>
        {collapsed ? (
          <>
            {/* Collapsed Language Toggle Button */}
            <button
              onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs"
              title={locale === 'vi' ? 'Đổi sang English' : 'Switch to Tiếng Việt'}
            >
              {locale.toUpperCase()}
            </button>

            {/* Collapsed Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors border border-slate-200/60 dark:border-slate-700/60"
              title={theme === 'dark' ? t('darkMode') : t('lightMode')}
            >
              {theme === 'dark' ? (
                <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 shrink-0" />
              )}
            </button>
          </>
        ) : (
          <>
            {/* Expanded Language Selector */}
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 p-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {t('language')}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLocale('vi')}
                  className={`px-2 py-1 text-xs rounded font-bold transition-all ${
                    locale === 'vi'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  VI
                </button>
                <button
                  onClick={() => setLocale('en')}
                  className={`px-2 py-1 text-xs rounded font-bold transition-all ${
                    locale === 'en'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            {/* Expanded Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-between rounded-lg p-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <span>{theme === 'dark' ? t('darkMode') : t('lightMode')}</span>
              {theme === 'dark' ? (
                <Moon className="h-4 w-4 text-indigo-400 shrink-0" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500 shrink-0" />
              )}
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
