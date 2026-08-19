import { Link } from 'react-router-dom';

import { GridBackdrop } from '@/components/grid-backdrop';
import { Button } from '@/components/ui/button';
import { site } from '@/data/site';
import { useEffect } from 'react';

export default function NotFoundPage() {
  // Not in routeSeo: a 404 should never be indexed, and it has no canonical.
  useEffect(() => {
    document.title = 'Page not found — VPSGUI';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, follow';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);


  return (
    <section className="relative flex min-h-[68vh] items-center px-5 py-24 sm:px-8">
      <GridBackdrop />

      <div className="mx-auto w-full max-w-5xl">
        <p className="eyebrow tabular">404</p>

        <h1 className="mt-5 max-w-xl text-[2.25rem] sm:text-[2.75rem]">
          No route <span className="accent-word">matched</span>.
        </h1>

        <p className="mt-5 max-w-md text-[0.9375rem] leading-relaxed text-muted-foreground">
          This page is not part of the site. If you followed a link from somewhere, the issue
          tracker is the fastest way to get it fixed.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/">Back to home</Link>
          </Button>
          <Button asChild variant="outline">
            <a href={site.issues} target="_blank" rel="noreferrer noopener">
              Report a broken link
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
