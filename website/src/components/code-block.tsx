import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

import { CopyButton } from './copy-button';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  showCopy?: boolean;
}

export function CodeBlock({
  code,
  language = 'typescript',
  filename,
  className,
  showCopy = true,
}: CodeBlockProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-terminal-border bg-terminal',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-terminal-border/70 px-4 py-2">
        <span className="font-mono text-xs text-terminal-dim">{filename ?? language}</span>

        {showCopy ? (
          <CopyButton value={code} className="h-7 text-terminal-dim hover:bg-white/5 hover:text-terminal-fg" />
        ) : null}
      </div>

      {/* Wide snippets scroll inside this box rather than widening the page. */}
      <div className="overflow-x-auto">
        <pre className="min-w-full p-4 font-mono text-[0.8125rem] leading-relaxed text-terminal-fg">
          <code>{highlight(code, language)}</code>
        </pre>
      </div>
    </div>
  );
}
