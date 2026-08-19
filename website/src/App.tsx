import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import HomePage from '@/pages/home';

// The home page is what almost everyone lands on, so it ships in the main
// chunk. The rest are split out — the API page in particular carries the whole
// endpoint table.
const ApiPage = lazy(() => import('@/pages/api'));
const SecurityPage = lazy(() => import('@/pages/security'));
const NotFoundPage = lazy(() => import('@/pages/not-found'));

/**
 * React Router restores neither scroll position nor hash targets on its own.
 * Without this, clicking "Features" from the API page lands you at /#features
 * still scrolled to wherever you were.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // The target may belong to a lazy route that has not painted yet, so
      // defer to the next frame before measuring.
      const id = hash.slice(1);
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0 });
        }
      });
      return () => cancelAnimationFrame(raf);
    }

    window.scrollTo({ top: 0 });
    return undefined;
  }, [pathname, hash]);

  return null;
}

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <span className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Loading…
      </span>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter
      // Opt in to the v7 behaviours now, while the site is new and there is
      // nothing to migrate later.
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <ScrollManager />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen flex-col">
        <SiteHeader />

        <main id="main" className="flex-1">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/api" element={<ApiPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>

        <SiteFooter />
      </div>
    </BrowserRouter>
  );
}
