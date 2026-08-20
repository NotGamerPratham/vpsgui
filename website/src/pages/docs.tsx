import { useMemo } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';

import { CodeBlock } from '@/components/code-block';
import { GridBackdrop } from '@/components/grid-backdrop';
import { Reveal } from '@/components/reveal';
import { docGroups, docSections, type DocBlock } from '@/data/docs';
import { site } from '@/data/site';
import { useActiveSection } from '@/hooks/use-active-section';
import { usePageMeta } from '@/hooks/use-page-meta';
import { inline } from '@/lib/inline';
import { cn } from '@/lib/utils';

/**
 * With the palette monochrome, hue can no longer carry severity. Each tone gets
 * a word, an icon and a different border weight, and the most severe one
 * inverts its label chip - three non-colour channels instead of one colour.
 */
const NOTE_STYLE = {
  info: { icon: Info, label: 'Note', border: 'border-l-2 border-border', chip: 'text-subtle' },
  warn: {
    icon: AlertTriangle,
    label: 'Important',
    border: 'border-l-4 border-warning',
    chip: 'text-foreground',
  },
  danger: {
    icon: ShieldAlert,
    label: 'Warning',
    border: 'border-l-4 border-foreground',
    chip: 'bg-foreground text-background',
  },
} as const;

function Block({ block }: { block: DocBlock }) {
  switch (block.kind) {
    case 'p':
      return (
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
          {inline(block.text)}
        </p>
      );

    case 'code':
      return <CodeBlock code={block.code} language={block.language} filename={block.filename} />;

    case 'list':
      return (
        <ul className="space-y-2.5">
          {block.items.map((item, i) => (
            <li
              key={i}
              className="relative pl-6 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty before:absolute before:top-[0.7em] before:left-1 before:size-1.5 before:rounded-full before:bg-primary/70"
            >
              {inline(item)}
            </li>
          ))}
        </ul>
      );

    case 'note': {
      const { icon: Icon, label, border, chip } = NOTE_STYLE[block.tone];
      return (
        <div className={cn('clay-inset rounded-2xl p-5', border)}>
          <p
            className={cn(
              'mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide uppercase',
              chip,
            )}
          >
            <Icon aria-hidden className="size-3.5" />
            {label}
          </p>
          <p className="text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
            {inline(block.text)}
          </p>
        </div>
      );
    }

    case 'table':
      return (
        <div className="clay overflow-x-auto rounded-2xl p-2">
          <table className="w-full min-w-2xl border-collapse text-left text-[0.875rem]">
            <thead>
              <tr className="border-b border-border">
                {block.head.map((h) => (
                  <th key={h} scope="col" className="eyebrow px-5 py-4 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {block.rows.map((row) => (
                <tr key={row[0]} className="align-top">
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={cn(
                        'px-5 py-3.5 text-pretty',
                        i === 0 ? 'whitespace-nowrap' : 'text-muted-foreground',
                      )}
                    >
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function DocsPage() {
  usePageMeta('/docs');

  const ids = useMemo(() => docSections.map((s) => s.id), []);
  const active = useActiveSection(ids);

  return (
    <>
      <section className="relative px-5 pt-16 pb-10 sm:px-8 sm:pt-20">
        <GridBackdrop />

        <div className="mx-auto w-full max-w-6xl">
          <p className="eyebrow">Documentation</p>

          <h1 className="mt-5 max-w-2xl text-[2.25rem] sm:text-[3rem]">
            Everything from clone to <span className="accent-word">uninstall</span>.
          </h1>

          <p className="mt-5 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
            Written against the agent as it actually ships. Every default and limit below was read
            out of the source, not remembered.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <div className="gap-12 lg:grid lg:grid-cols-[15rem_1fr]">
          {/* Sidebar. Hidden below lg - the content order already reads top to
              bottom, so a duplicated nav on mobile is just noise before it. */}
          <aside className="hidden lg:block">
            <nav
              aria-label="Documentation"
              className="clay sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl p-5"
            >
              {docGroups.map((group) => (
                <div key={group.group} className="mb-5 last:mb-0">
                  <p className="eyebrow mb-2.5">{group.group}</p>
                  <ul className="space-y-0.5">
                    {group.sections.map((section) => (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          aria-current={active === section.id ? 'true' : undefined}
                          className={cn(
                            'block rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors',
                            active === section.id
                              ? 'bg-muted font-medium text-foreground'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 space-y-16">
            {docSections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28">
                <Reveal>
                  <h2 className="text-[1.5rem]">{section.title}</h2>
                </Reveal>

                <div className="mt-5 space-y-5">
                  {section.blocks.map((block, i) => (
                    <Reveal key={i} delay={Math.min(i, 3) * 0.03}>
                      <Block block={block} />
                    </Reveal>
                  ))}
                </div>
              </section>
            ))}

            <Reveal>
              <div className="clay rounded-2xl p-7">
                <h2 className="text-[1.0625rem]">Still stuck?</h2>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-muted-foreground">
                  The long-form docs live in the repository, and anything not answered there is
                  worth an issue - that is how entries end up on this page.
                </p>
                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[0.875rem]">
                  <a
                    href={site.docs.architecture}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-4 transition-opacity hover:opacity-65"
                  >
                    Architecture
                  </a>
                  <a
                    href={site.docs.security}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-4 transition-opacity hover:opacity-65"
                  >
                    Security model
                  </a>
                  <a
                    href={site.issues}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-4 transition-opacity hover:opacity-65"
                  >
                    Open an issue
                  </a>
                </div>
              </div>
            </Reveal>
          </main>
        </div>
      </div>
    </>
  );
}
