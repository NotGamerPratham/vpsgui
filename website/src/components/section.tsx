import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Reveal } from './reveal';

export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('relative px-5 py-16 sm:px-8 sm:py-20', className)}>
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  /** Two-digit index, set in a pressed clay chip. Gives the page a spine. */
  index?: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}

/**
 * Left-aligned. Clay changes the surfaces, not the editorial structure - a page
 * of centred headings still reads as a template regardless of how it is shaded.
 */
export function SectionHeading({ index, label, title, lede, className }: SectionHeadingProps) {
  return (
    <Reveal className={cn('max-w-2xl', className)}>
      <div className="flex items-center gap-3">
        {index ? (
          <span className="clay-inset eyebrow tabular flex size-9 items-center justify-center rounded-full">
            {index}
          </span>
        ) : null}
        <span className="eyebrow">{label}</span>
      </div>

      <h2 className="mt-5 text-[1.875rem] sm:text-[2.375rem]">{title}</h2>

      {lede ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:text-base">
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
