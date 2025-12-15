import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { NotificacoesDropdown } from '@/components/NotificacoesDropdown';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Header with notifications */}
      <div className="fixed top-4 right-6 z-30">
        <NotificacoesDropdown />
      </div>
      <main className="ml-64 min-h-screen p-6 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
