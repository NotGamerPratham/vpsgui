import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import { Reveal } from './reveal';

export function Section({
  id,
  children,
  className,
  bleed = false,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  /** Skip the top hairline where two sections should read as one block. */
  bleed?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn('relative px-5 py-20 sm:px-8 sm:py-24', !bleed && 'hairline', className)}
    >
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </section>
  );
}

interface SectionHeadingProps {
  /** Two-digit index. Gives the page a spine and a sense of being authored. */
  index?: string;
  label: string;
  title: ReactNode;
  lede?: ReactNode;
  className?: string;
}

/**
 * Left-aligned, always. Centred section headers stacked down a page are the
 * house style of every generated landing page; an editorial left margin reads
 * as something a person laid out.
 */
export function SectionHeading({ index, label, title, lede, className }: SectionHeadingProps) {
  return (
    <Reveal className={cn('max-w-2xl', className)}>
      <div className="flex items-baseline gap-3">
        {index ? <span className="eyebrow tabular">{index}</span> : null}
        <span className="eyebrow">{label}</span>
      </div>

      <h2 className="mt-5 text-[1.75rem] sm:text-[2.25rem]">{title}</h2>

      {lede ? (
        <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground text-pretty sm:text-base">
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
