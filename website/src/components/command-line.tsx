import { cn } from '@/lib/utils';

import { CopyButton } from './copy-button';

/**
 * One copyable shell command. The prompt glyph is a real character in the
 * markup but sits outside the copied value, so pasting never drags a stray "$"
 * into someone's shell.
 */
export function CommandLine({
  command,
  className,
  label,
}: {
  command: string;
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-terminal py-2.5 pr-2.5 pl-5 shadow-[0_12px_26px_-12px_var(--clay-drop-lg)]',
        className,
      )}
    >
      <span aria-hidden className="font-mono text-sm text-terminal-accent select-none">
        $
      </span>

      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-[0.8125rem] text-terminal-fg">
        {command}
      </code>

      <CopyButton
        value={command}
        label={label}
        className="h-7 text-terminal-dim hover:bg-white/5 hover:text-terminal-fg"
      />
    </div>
  );
}
