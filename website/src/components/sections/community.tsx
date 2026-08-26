import { BookOpen, GitPullRequest, MessagesSquare, Star } from 'lucide-react';

import { Reveal } from '@/components/reveal';
import { Button } from '@/components/ui/button';
import { site } from '@/data/site';

/**
 * Authorship and how to contribute.
 *
 * Deliberately count-free. The obvious version of this section is a live star badge and a grid of
 * contributor avatars, but both read as evidence of a project's size, and on a young repository
 * they argue against it - a counter showing a handful of stars is worse than no counter, and an
 * avatar grid holding one face worse than none. The links below are useful at any scale and never
 * need revisiting as the numbers move, so nothing here calls the GitHub API at all.
 */

const LINKS = [
  {
    icon: GitPullRequest,
    title: 'Contributing guide',
    body: 'How the console, the agent and the two SDKs fit together, and what a change to each needs.',
    href: site.docs.development,
  },
  {
    icon: BookOpen,
    title: 'Architecture',
    body: 'Why the agent is a separate zero-dependency daemon rather than a route in the web app.',
    href: site.docs.architecture,
  },
  {
    icon: MessagesSquare,
    title: 'Discussions',
    body: 'Questions, ideas and anything that is not a reproducible bug report.',
    href: site.discussions,
  },
];

export function Community() {
  return (
    <section className="px-5 pb-4 sm:px-8">
      <Reveal className="mx-auto w-full max-w-5xl">
        <div className="clay rounded-3xl p-8 sm:p-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Open source</p>
              <h2 className="mt-4 max-w-lg text-[1.75rem] leading-tight sm:text-[2rem]">
                Built by{' '}
                <a
                  href={site.author.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="accent-word underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                >
                  {site.author.name}
                </a>
                . Contributions welcome.
              </h2>
              <p className="mt-4 max-w-lg text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty">
                {site.license.name}-licensed and developed in the open. Read the source, file what
                is broken, or send a patch.
              </p>
            </div>

            <Button asChild variant="outline" className="gap-2">
              <a href={site.repo} target="_blank" rel="noreferrer noopener">
                <Star aria-hidden className="size-4" />
                Star on GitHub
              </a>
            </Button>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-3">
            {LINKS.map(({ icon: Icon, title, body, href }) => (
              <li key={title}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="clay-inset block h-full rounded-2xl p-5 transition-colors hover:text-foreground"
                >
                  <Icon aria-hidden className="size-4 text-primary" />
                  <span className="mt-3 block text-[0.9375rem]">{title}</span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-subtle">{body}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </section>
  );
}
