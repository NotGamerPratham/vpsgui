import { Link } from 'react-router-dom';

import { footerSections, site } from '@/data/site';

import { Logo } from './logo';

export function SiteFooter() {
  return (
    <footer className="px-5 pt-6 pb-14 sm:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-[0.8125rem] leading-relaxed text-muted-foreground">
              A self-hosted control plane for Linux servers and Docker. Reads the machine directly.
            </p>
          </div>

          {footerSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <h3 className="eyebrow">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 font-mono text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            v{site.version} &middot; MIT &middot; built by{' '}
            <a
              href={site.author.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              {site.author.name}
            </a>
          </p>
          <p>Not affiliated with any hosting provider.</p>
        </div>
      </div>
    </footer>
  );
}
