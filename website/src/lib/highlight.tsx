import { Fragment, type ReactNode } from 'react';

/**
 * A deliberately small highlighter. The alternative was shipping Shiki or
 * Prism — hundreds of kilobytes of grammar to colour four short snippets on a
 * marketing page. This covers comments, strings, numbers and keywords, which is
 * every token that actually appears in the samples in src/data/sdk.ts.
 *
 * Output is React elements, never dangerouslySetInnerHTML, so a snippet can
 * never inject markup even if one is added later from an untrusted source.
 */

type Kind = 'comment' | 'string' | 'keyword' | 'number' | 'flag' | 'plain';

const KEYWORDS: Record<string, string[]> = {
  typescript: [
    'import', 'from', 'const', 'let', 'var', 'new', 'await', 'async', 'function',
    'return', 'for', 'of', 'in', 'if', 'else', 'export', 'default', 'class',
    'try', 'catch', 'finally', 'throw', 'type', 'interface', 'extends', 'true',
    'false', 'null', 'undefined',
  ],
  python: [
    'import', 'from', 'as', 'with', 'def', 'class', 'return', 'for', 'in', 'if',
    'elif', 'else', 'try', 'except', 'finally', 'raise', 'print', 'True',
    'False', 'None', 'and', 'or', 'not', 'pass', 'yield', 'lambda',
  ],
  bash: [
    'curl', 'sudo', 'apt', 'cat', 'cd', 'git', 'npm', 'pip', 'node', 'echo',
    'export', 'chmod', 'systemctl', 'pm2', 'certbot', 'less', 'bash',
  ],
};

/**
 * Three tones, not six. A snippet lit up in violet, cyan, amber, sky and slate
 * is doing more decorating than explaining.
 */
const CLASS_FOR: Record<Kind, string> = {
  comment: 'text-terminal-dim',
  string: 'text-warning/85',
  keyword: 'text-terminal-accent',
  number: 'text-warning/85',
  flag: 'text-terminal-fg/70',
  plain: '',
};

/**
 * Order matters: comments and strings are matched before anything else so a
 * keyword inside a quoted string is not recoloured.
 */
const TOKEN_RE = new RegExp(
  [
    '(#[^\\n]*|//[^\\n]*)', // 1: line comment (bash/python and js)
    '(`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // 2: string
    '(\\s-{1,2}[A-Za-z][\\w-]*)', // 3: CLI flag
    '(\\b\\d+(?:\\.\\d+)?\\b)', // 4: number
    '([A-Za-z_$][\\w$]*)', // 5: word
  ].join('|'),
  'g',
);

function kindForMatch(m: RegExpExecArray, keywords: Set<string>): Kind {
  if (m[1] !== undefined) return 'comment';
  if (m[2] !== undefined) return 'string';
  if (m[3] !== undefined) return 'flag';
  if (m[4] !== undefined) return 'number';
  if (m[5] !== undefined && keywords.has(m[5])) return 'keyword';
  return 'plain';
}

export function highlight(code: string, language: string): ReactNode {
  const keywords = new Set(KEYWORDS[language] ?? KEYWORDS.typescript);
  const nodes: ReactNode[] = [];

  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(code)) !== null) {
    // Zero-length matches would spin forever; the regex cannot produce one, but
    // guard anyway since a future token pattern might.
    if (match.index === TOKEN_RE.lastIndex) {
      TOKEN_RE.lastIndex += 1;
      continue;
    }

    const kind = kindForMatch(match, keywords);
    if (kind === 'plain') continue;

    if (match.index > last) {
      nodes.push(<Fragment key={key++}>{code.slice(last, match.index)}</Fragment>);
    }

    nodes.push(
      <span key={key++} className={CLASS_FOR[kind]}>
        {match[0]}
      </span>,
    );

    last = match.index + match[0].length;
  }

  if (last < code.length) {
    nodes.push(<Fragment key={key++}>{code.slice(last)}</Fragment>);
  }

  return nodes;
}
