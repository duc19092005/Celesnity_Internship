import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/theme-context';
import { LanguageProvider } from '@/context/language-context';
import { Sidebar } from '@/components/layout/sidebar';

import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Celesnity MES - Factory Data & Production Line Platform',
  description: 'Industrial laundry tracking, provenance and production line management platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning className="h-full">
      <body
        suppressHydrationWarning
        className="h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex overflow-hidden"
      >
        <ThemeProvider>
          <LanguageProvider>
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 w-full h-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950">
              {children}
            </main>
            <Toaster position="top-right" richColors closeButton />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
