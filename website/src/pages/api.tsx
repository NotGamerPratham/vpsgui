import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { CodeBlock } from '@/components/code-block';
import { GridBackdrop } from '@/components/grid-backdrop';
import { Reveal } from '@/components/reveal';
import { endpointGroups } from '@/data/api';
import { site } from '@/data/site';
import { usePageMeta } from '@/hooks/use-page-meta';
import { cn } from '@/lib/utils';

/**
 * Three tiers without hue: GET reads quietly because it is the safe one,
 * anything that mutates is at full contrast, and DELETE inverts so it is the
 * one your eye catches scanning a long list.
 */
const METHOD_CLASS: Record<string, string> = {
  GET: 'text-subtle',
  POST: 'text-foreground',
  DELETE: 'bg-foreground text-background px-1.5 rounded-md',
};

const AUTH_SAMPLE = `# Everything is prefixed /api/v1. Everything except /health
# wants the bearer token the installer printed.

export VPSGUI_AGENT_TOKEN="paste-the-token-here"

curl -s https://vps.example.com/api/v1/system/telemetry \\
  -H "Authorization: Bearer $VPSGUI_AGENT_TOKEN"

# 401 -> token wrong or missing
# 429 -> this client is locked out after repeated failures`;

export default function ApiPage() {
  usePageMeta('/api');

  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return endpointGroups;

    return endpointGroups
      .map((group) => ({
        ...group,
        routes: group.routes.filter(
          (route) =>
            route.path.toLowerCase().includes(q) ||
            route.summary.toLowerCase().includes(q) ||
            route.method.toLowerCase() === q ||
            group.resource.toLowerCase().includes(q),
        ),
      }))
      .filter((group) => group.routes.length > 0);
  }, [query]);

  const total = endpointGroups.reduce((n, g) => n + g.routes.length, 0);
  const shown = groups.reduce((n, g) => n + g.routes.length, 0);

  return (
    <>
      <section className="relative px-5 pt-16 pb-12 sm:px-8 sm:pt-20">
        <GridBackdrop />

        <div className="mx-auto w-full max-w-5xl">
          <p className="eyebrow">Reference</p>

          <h1 className="mt-5 max-w-2xl text-[2.25rem] sm:text-[3rem]">
            {total} endpoints, one <span className="accent-word">bearer token</span>.
          </h1>

          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
            The console and both SDKs are ordinary clients of this API. There is no private channel
            between the UI and the agent, so anything listed here you can call yourself.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.8125rem]">
            <a
              href={site.docs.apiReference}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Long-form docs
            </a>
            <a
              href={site.packages.npm}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              vpsgui-sdk on npm
            </a>
            <a
              href={site.packages.pypi}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              vpsgui on PyPI
            </a>
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <Reveal>
            <CodeBlock code={AUTH_SAMPLE} language="bash" filename="authentication" />
          </Reveal>

          <Reveal delay={0.05} className="mt-5">
            <p className="clay-inset max-w-2xl rounded-2xl border-l-4 border-foreground p-6 text-[0.875rem] leading-relaxed text-muted-foreground">
              <span className="mb-2 block font-mono text-[0.6875rem] tracking-wide text-foreground uppercase">
                Important
              </span>
              <code className="font-mono text-foreground">POST /terminal/exec</code> runs arbitrary
              commands as the agent user. That one route is why the token is root-equivalent, and why
              the agent belongs on loopback behind a proxy you control.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="sticky top-20 z-30 -mx-1 mb-6 bg-background px-1 pt-4 pb-3">
            <label htmlFor="endpoint-search" className="sr-only">
              Filter endpoints
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle"
              />
              <input
                id="endpoint-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by path, method or description"
                className="clay-inset h-11 w-full rounded-xl pr-3 pl-10 font-mono text-[0.8125rem] outline-none placeholder:font-sans placeholder:text-subtle focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
            </div>
            <p aria-live="polite" className="mt-2 px-1 font-mono text-xs text-subtle tabular">
              {shown} / {total}
            </p>
          </div>

          {groups.length === 0 ? (
            <p className="clay-inset rounded-2xl py-16 text-center text-sm text-subtle">
              Nothing matches “{query}”.
            </p>
          ) : (
            <div className="space-y-12">
              {groups.map((group) => (
                <Reveal key={group.resource}>
                  <div>
                    <h2 className="text-[1.0625rem]">{group.resource}</h2>
                    <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted-foreground">
                      {group.description}
                    </p>

                    <ul className="clay mt-5 divide-y divide-border/60 overflow-hidden rounded-2xl">
                      {group.routes.map((route) => (
                        <li
                          key={`${route.method} ${route.path}`}
                          className="grid gap-1 px-6 py-3.5 sm:grid-cols-[4rem_16rem_1fr] sm:items-baseline sm:gap-4"
                        >
                          <span
                            className={cn(
                              'font-mono text-[0.6875rem] tracking-wide',
                              METHOD_CLASS[route.method],
                            )}
                          >
                            {route.method}
                          </span>

                          <code className="font-mono text-[0.8125rem]">{route.path}</code>

                          <span className="text-[0.8125rem] text-muted-foreground text-pretty">
                            {route.summary}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
