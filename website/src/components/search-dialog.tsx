import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, HelpCircle, Search, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { searchDocs, type SearchDoc, type SearchKind } from '@/lib/search-index';
import { cn } from '@/lib/utils';

const KIND_ICON: Record<SearchKind, typeof FileText> = {
  doc: FileText,
  endpoint: Terminal,
  faq: HelpCircle,
};

/** Results shown before anything is typed, so the palette is never a blank box. */
const EMPTY_QUERY_HINTS = ['agent token', 'install', 'telemetry', 'firewall'];

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchDocs(query), [query]);

  // Reset between openings: reopening onto a stale query and a scrolled list feels broken.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after paint, or the browser has nothing laid out to focus yet.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  // Lock the page behind the dialog so arrow keys move the result list, not the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const go = useCallback(
    (doc: SearchDoc) => {
      onClose();
      navigate(doc.href);
    },
    [navigate, onClose],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length));
      return;
    }
    if (event.key === 'Enter' && results[active]) {
      event.preventDefault();
      go(results[active]);
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        // Only a click on the backdrop itself closes; one that started inside must not.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        className="clay relative w-full max-w-xl overflow-hidden rounded-2xl"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-4">
          <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs, API routes and FAQ..."
            aria-label="Search documentation"
            aria-controls="search-results"
            className="h-12 w-full bg-transparent text-[0.9375rem] outline-none placeholder:text-subtle"
          />
          <kbd className="hidden shrink-0 rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-subtle sm:block">
            Esc
          </kbd>
        </div>

        {query.trim() === '' ? (
          <div className="px-4 py-5">
            <p className="text-xs text-subtle">Try one of these</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EMPTY_QUERY_HINTS.map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setQuery(hint)}
                  className="rounded-full border border-border/70 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing matches <span className="font-mono text-foreground">{query}</span>.
          </p>
        ) : (
          <ul id="search-results" ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto py-2">
            {results.map((doc, index) => {
              const Icon = KIND_ICON[doc.kind];
              return (
                <li key={doc.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    // Pointer-move, not enter: hovering the row the mouse merely rests on while
                    // the user is arrowing with the keyboard would keep stealing the highlight.
                    onPointerMove={() => setActive(index)}
                    onClick={() => go(doc)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors',
                      index === active ? 'bg-foreground/[0.06]' : 'bg-transparent',
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          'block truncate text-sm',
                          doc.kind === 'endpoint' && 'font-mono text-[0.8125rem]',
                        )}
                      >
                        {doc.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-subtle">{doc.subtitle}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Owns the open/closed state and the global shortcut.
 *
 * Split from the dialog so the keybinding lives in exactly one place no matter how many triggers
 * the header ends up rendering (desktop button, mobile menu item).
 */
export function useSearchDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      // Bare "/" is the other convention, but only when the user is not already typing.
      if (event.key === '/' && !isEditable(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return { open, setOpen };
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
