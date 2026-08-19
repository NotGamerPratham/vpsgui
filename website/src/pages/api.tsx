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
 * Method is carried by weight and one accent, not by three coloured pills.
 * GET is the safe one and reads quietly; anything that changes state is the
 * one worth spotting in a long list.
 */
const METHOD_CLASS: Record<string, string> = {
  GET: 'text-subtle',
  POST: 'text-primary',
  DELETE: 'text-destructive',
};

const AUTH_SAMPLE = `# Everything is prefixed /api/v1. Everything except /health
# wants the bearer token the installer printed.

export VPSGUI_AGENT_TOKEN="paste-the-token-here"

curl -s https://vps.example.com/api/v1/system/telemetry \\
  -H "Authorization: Bearer $VPSGUI_AGENT_TOKEN"

# 401 -> token wrong or missing
# 429 -> this client is locked out after repeated failures`;

export default function ApiPage() {
  usePageMeta({
    title: 'API reference — VPSGUI',
    description:
      'Every REST endpoint the VPSGUI agent serves: telemetry, Docker, files, security, network, operations and terminal.',
  });

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
            <p className="max-w-2xl border-l-2 border-warning/60 py-1 pl-5 text-[0.875rem] leading-relaxed text-muted-foreground">
              <code className="font-mono text-foreground">POST /terminal/exec</code> runs arbitrary
              commands as the agent user. That one route is why the token is root-equivalent, and why
              the agent belongs on loopback behind a proxy you control.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="sticky top-14 z-30 -mx-1 mb-6 bg-background px-1 pt-4 pb-3">
            <label htmlFor="endpoint-search" className="sr-only">
              Filter endpoints
            </label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle"
              />
              <input
                id="endpoint-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by path, method or description"
                className="h-10 w-full rounded-lg border border-border bg-card pr-3 pl-9 font-mono text-[0.8125rem] outline-none transition-colors placeholder:font-sans placeholder:text-subtle focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
              />
            </div>
            <p aria-live="polite" className="mt-2 px-1 font-mono text-xs text-subtle tabular">
              {shown} / {total}
            </p>
          </div>

          {groups.length === 0 ? (
            <p className="hairline py-16 text-center text-sm text-subtle">
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

                    <ul className="mt-5">
                      {group.routes.map((route) => (
                        <li
                          key={`${route.method} ${route.path}`}
                          className="hairline grid gap-1 py-3 sm:grid-cols-[4rem_16rem_1fr] sm:items-baseline sm:gap-4"
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
