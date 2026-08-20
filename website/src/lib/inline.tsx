import { Fragment, type ReactNode } from 'react';

/**
 * Minimal inline formatter for the doc content in src/data/docs.ts.
 * Supports `code`, **bold**, and [text](url) - nothing else, deliberately.
 *
 * Returns React elements rather than HTML, so nothing in the content file can
 * inject markup even if it later comes from somewhere less trusted.
 */

const TOKEN = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;

export function inline(text: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;

  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(text)) !== null) {
    if (m.index > last) {
      out.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    }

    if (m[1] !== undefined) {
      out.push(
        <code
          key={key++}
          className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.875em] text-foreground"
        >
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <strong key={key++} className="font-medium text-foreground">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined && m[4] !== undefined) {
      const href = m[4];
      const external = /^https?:\/\//.test(href);
      out.push(
        <a
          key={key++}
          href={href}
          {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          className="underline underline-offset-4 transition-opacity hover:opacity-65"
        >
          {m[3]}
        </a>,
      );
    }

    last = m.index + m[0].length;
  }

  if (last < text.length) {
    out.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  }

  return out;
}
