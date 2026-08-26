import { useEffect, useState } from 'react';
import { Menu, Search, Star, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { navLinks, site } from '@/data/site';
import { useScrolled } from '@/hooks/use-scrolled';
import { cn } from '@/lib/utils';

import { Logo } from './logo';
import { SearchDialog, useSearchDialog } from './search-dialog';
import { ThemeToggle } from './theme-toggle';

export function SiteHeader() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);
  const { open: searchOpen, setOpen: setSearchOpen } = useSearchDialog();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
    <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    <header
      className="sticky top-0 z-50 w-full px-4 pt-4 sm:px-6"
    >
      <div
        className={cn(
          'mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-6 px-4 transition-shadow sm:px-5',
          // The bar only lifts off the page once you scroll; at rest it sits
          // flush so the hero is not competing with a floating slab.
          scrolled || open ? 'clay rounded-2xl' : 'rounded-2xl bg-transparent',
        )}
      >
        <Link
          to="/"
          aria-label="VPSGUI home"
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search documentation"
            className="hidden items-center gap-2 rounded-md border border-border/70 py-1.5 pl-2.5 pr-2 text-[0.8125rem] text-subtle transition-colors hover:text-foreground sm:flex"
          >
            <Search aria-hidden className="size-3.5" />
            <span>Search</span>
            {/* Rendered as the literal key, not a platform-detected glyph: sniffing the
                user agent to choose between Cmd and Ctrl is wrong on every device that
                lies about itself, and both bindings work regardless. */}
            <kbd className="rounded border border-border/70 px-1 font-mono text-[10px]">/</kbd>
          </button>

          <ThemeToggle />

          {/* A star prompt rather than a star count. The count is the conventional choice and the
              wrong one here: it reports project size on every page load, which argues against a
              young repository, and it costs an API call that fails closed on rate limits. */}
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            <Star aria-hidden className="size-3.5" />
            Star
          </a>

          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/#install">Install</Link>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          </Button>
        </div>
      </div>

      {/* Rendered only while open. An element left mid-exit keeps its links in
          the focus order while invisible, which is worse than no exit animation. */}
      {open ? (
        <div
          id="mobile-nav"
          className="animate-menu-in clay mx-auto mt-3 w-full max-w-5xl overflow-hidden rounded-2xl md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col px-5 py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="border-b border-border/60 py-3.5 text-[0.9375rem] text-muted-foreground transition-colors last:border-b-0 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearchOpen(true);
              }}
              className="flex items-center gap-2 border-b border-border/60 py-3.5 text-left text-[0.9375rem] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Search aria-hidden className="size-4" />
              Search
            </button>

            <div className="flex gap-2 py-4">
              <Button asChild className="flex-1">
                <Link to="/#install">Install</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <a href={site.repo} target="_blank" rel="noreferrer noopener">
                  GitHub
                </a>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
    </>
  );
}
