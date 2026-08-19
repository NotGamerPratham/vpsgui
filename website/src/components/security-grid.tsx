import { Reveal } from '@/components/reveal';
import { cn } from '@/lib/utils';
import type { SecurityPoint } from '@/types';

/**
 * Two kinds of point, separated by a word and by depth: guarantees sit raised on
 * the page, operator duties are pressed into it and tinted amber. Nobody else
 * will do those, so they should not look finished.
 */
export function SecurityGrid({
  points,
  columns = 2,
  className,
}: {
  points: SecurityPoint[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-5',
        columns >= 2 && 'sm:grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
        className,
      )}
    >
      {points.map((point, i) => {
        const Icon = point.icon;
        const isDuty = point.kind === 'duty';

        return (
          <Reveal key={point.id} delay={(i % 3) * 0.05}>
            <article
              className={cn('h-full p-6', isDuty ? 'clay-inset rounded-2xl' : 'clay clay-press rounded-2xl')}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-full',
                    isDuty ? 'bg-foreground text-background' : 'clay-inset text-foreground',
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>

                {/* Without hue, the two kinds are told apart by a word and by an
                    inverted chip — never by colour alone. */}
                <span
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[0.6875rem] tracking-wide uppercase',
                    isDuty ? 'bg-foreground text-background' : 'text-subtle',
                  )}
                >
                  {isDuty ? 'your job' : 'built in'}
                </span>
              </div>

              <h3 className="mt-4 text-[0.9375rem]">{point.title}</h3>

              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                {point.body}
              </p>
            </article>
          </Reveal>
        );
      })}
    </div>
  );
}
