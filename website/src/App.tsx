import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';

import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import ApiPage from '@/pages/api';
import DocsPage from '@/pages/docs';
import HomePage from '@/pages/home';
import NotFoundPage from '@/pages/not-found';
import SecurityPage from '@/pages/security';

/**
 * Pages are imported eagerly rather than through React.lazy.
 *
 * The build prerenders every route to static HTML (scripts/prerender.mjs), and
 * renderToString cannot resolve a lazy boundary - it would emit the Suspense
 * fallback into the file a crawler reads. Eager imports cost roughly 10 kB gzip
 * of shared bundle and buy correct HTML on every route, which is the better
 * trade for a four-page site.
 */

/**
 * React Router restores neither scroll position nor hash targets on its own.
 * Without this, clicking "Features" from the API page lands you at /#features
 * still scrolled to wherever you were.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0 });
      });
      return () => cancelAnimationFrame(raf);
    }

    window.scrollTo({ top: 0 });
    return undefined;
  }, [pathname, hash]);

  return null;
}

/** Everything inside the router. Shared by the browser and the prerenderer. */
export function AppShell() {
  return (
    <>
      <ScrollManager />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="flex min-h-screen flex-col">
        <SiteHeader />

        <main id="main" className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/api" element={<ApiPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

export default function App() {
  return (
    // No `future` prop: those flags opted v6 into v7 behaviour, and on v7 they
    // are simply how the router works — the prop was removed from the type.
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
