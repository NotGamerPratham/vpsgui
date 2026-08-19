import { cn } from '@/lib/utils';

/**
 * A shell prompt, drawn monochrome. The previous mark used a three-stop
 * emerald/cyan/violet gradient, which is the same gradient every generated
 * logo uses; ink on paper is more distinctive than a rainbow.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-5 shrink-0" aria-hidden focusable="false">
        <g
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          <path d="M7 9.5 L13.5 16 L7 22.5" />
          <path d="M17 23 H25" />
        </g>
      </svg>

      {showWordmark ? (
        <span className="text-[0.9375rem] font-medium tracking-[-0.01em]">vpsgui</span>
      ) : (
        <span className="sr-only">VPSGUI</span>
      )}
    </span>
  );
}
