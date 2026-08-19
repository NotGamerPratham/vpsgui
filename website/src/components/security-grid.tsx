import { Reveal } from '@/components/reveal';
import { cn } from '@/lib/utils';
import type { SecurityPoint } from '@/types';

/**
 * Two kinds of point, told apart by a word rather than by colour-coding six
 * different hues. Amber appears only on the operator duties, where it is
 * carrying real meaning: these are the ones nobody else will do for you.
 */
export function SecurityGrid({
  points,
  columns = 2,
  className,
}: {
  points: SecurityPoint[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-x-12', columns === 2 && 'sm:grid-cols-2', className)}>
      {points.map((point, i) => {
        const Icon = point.icon;
        const isDuty = point.kind === 'duty';

        return (
          <Reveal key={point.id} delay={(i % 2) * 0.05}>
            <div className="hairline py-6">
              <div className="flex items-center gap-2.5">
                <Icon
                  aria-hidden
                  className={cn('size-4', isDuty ? 'text-warning' : 'text-subtle')}
                />
                <h3 className="text-[0.9375rem]">{point.title}</h3>
                {isDuty ? (
                  <span className="ml-auto font-mono text-[0.6875rem] text-warning">your job</span>
                ) : null}
              </div>

              <p className="mt-2.5 text-[0.875rem] leading-relaxed text-muted-foreground text-pretty">
                {point.body}
              </p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
