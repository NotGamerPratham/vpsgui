import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { CategoryNavigation } from './CategoryNavigation';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from '../components/overlays/CommandPalette';
import { NotificationsDrawer } from '../components/overlays/NotificationsDrawer';
import { QuickLauncherModal } from '../components/overlays/QuickLauncherModal';

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

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
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              {children || <Outlet />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Global Overlays */}
      <CommandPalette />
      <NotificationsDrawer />
      <QuickLauncherModal />
    </div>
  );
}
