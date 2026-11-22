import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { CategoryNavigation } from './CategoryNavigation';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from '../components/overlays/CommandPalette';
import { NotificationsDrawer } from '../components/overlays/NotificationsDrawer';
import { QuickLauncherModal } from '../components/overlays/QuickLauncherModal';
import { startTelemetryPolling } from '../services/telemetryPoller';

export function MainLayout({ children }: { children?: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    return startTelemetryPolling(3000);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-mono">
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
        <main className="flex-1 overflow-y-auto bg-background bg-precision-dots px-5 py-6 sm:px-8 sm:py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="mx-auto w-full max-w-[1440px]"
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
