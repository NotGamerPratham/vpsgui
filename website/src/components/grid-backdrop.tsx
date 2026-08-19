import { cn } from '@/lib/utils';

/**
 * The only background treatment on the site: one faint grid that fades out.
 * No colour, no blur, no drifting gradient fields.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-hairgrid mask-fade-b opacity-60',
        className,
      )}
    />
  );
}
