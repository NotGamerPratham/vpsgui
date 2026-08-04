import React from 'react';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { CategoryNavigation } from './CategoryNavigation';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from '../components/overlays/CommandPalette';
import { NotificationsDrawer } from '../components/overlays/NotificationsDrawer';
import { QuickLauncherModal } from '../components/overlays/QuickLauncherModal';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Collapsible Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <TopNav />

        {/* High-level Category Navigation */}
        <CategoryNavigation />

        {/* Dynamic Context Breadcrumbs */}
        <Breadcrumbs />

        {/* Page Content Scroll Container */}
        <main className="flex-1 overflow-y-auto bg-background/50 p-6 scrollbar-thin">
          {children}
        </main>
      </div>

      {/* Global Overlays */}
      <CommandPalette />
      <NotificationsDrawer />
      <QuickLauncherModal />
    </div>
  );
}
