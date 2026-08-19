import { Fragment, type ReactNode } from 'react';

/**
 * A small syntax highlighter for the dark code surfaces.
 *
 * The alternative was shipping Shiki or Prism — hundreds of kilobytes of
 * grammar to colour a handful of short snippets. This tokenises the four
 * languages that actually appear on the site and nothing else.
 *
 * Output is React elements, never dangerouslySetInnerHTML, so a snippet can
 * never inject markup even if one later comes from an untrusted source.
 */

export type TokenKind =
  | 'command'
  | 'flag'
  | 'variable'
  | 'string'
  | 'number'
  | 'literal'
  | 'key'
  | 'keyword'
  | 'property'
  | 'comment'
  | 'punct'
  | 'ok'
  | 'warn'
  | 'plain';

export interface Token {
  text: string;
  kind: TokenKind;
}

export type Lang = 'shell' | 'json' | 'typescript' | 'python' | 'table';

/**
 * Colour per token kind.
 *
 * These are the only coloured pixels on the site: the surrounding page is
 * monochrome, and a terminal is a depiction of another program's output, which
 * is genuinely coloured. Values live in index.css so both themes share one
 * definition — the terminal is dark in either case.
 */
const CLASS_FOR: Record<TokenKind, string> = {
  command: 'text-[var(--syn-command)]',
  flag: 'text-[var(--syn-flag)]',
  variable: 'text-[var(--syn-variable)]',
  string: 'text-[var(--syn-string)]',
  number: 'text-[var(--syn-number)]',
  literal: 'text-[var(--syn-literal)]',
  key: 'text-[var(--syn-key)]',
  keyword: 'text-[var(--syn-keyword)]',
  property: 'text-[var(--syn-property)]',
  comment: 'text-[var(--syn-comment)] italic',
  punct: 'text-[var(--syn-punct)]',
  ok: 'text-[var(--syn-ok)]',
  warn: 'text-[var(--syn-warn)]',
  plain: '',
};

const KEYWORDS: Record<string, string[]> = {
  typescript: [
    'import', 'from', 'export', 'default', 'const', 'let', 'var', 'new', 'await', 'async',
    'function', 'return', 'for', 'of', 'in', 'if', 'else', 'class', 'extends', 'try', 'catch',
    'finally', 'throw', 'type', 'interface', 'true', 'false', 'null', 'undefined',
  ],
  python: [
    'import', 'from', 'as', 'with', 'def', 'class', 'return', 'for', 'in', 'if', 'elif', 'else',
    'try', 'except', 'finally', 'raise', 'print', 'True', 'False', 'None', 'and', 'or', 'not',
    'pass', 'yield', 'lambda',
  ],
};

/** Words that read as a healthy state in command output. */
const OK_WORDS = /^(running|up|ok|active|healthy|enabled|success|200)$/i;
/** Words that read as a stopped or failed state. */
const WARN_WORDS = /^(exited|stopped|failed|dead|inactive|disabled|error|null)$/i;

/* -------------------------------------------------------------------------- */
/* Tokenisers                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Shell. The first bare word of a line or pipeline segment is the command being
 * run and everything after it is arguments, so position decides the colour
 * rather than a fixed list of binary names.
 */
function tokenizeShell(src: string): Token[] {
  // Newlines are matched separately from other whitespace so the "next word is
  // a command" state can reset per line. Without that, only the first command
  // in a multi-line snippet was ever coloured.
  const re =
    /(#[^\n]*)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\$\{[^}]*\}|\$[A-Za-z_]\w*)|(\|\||&&|[|;><])|(\n)|([ \t]+)|([^\s|;><]+)/g;

  const out: Token[] = [];
  let expectCommand = true;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    const [text, comment, dq, sq, variable, operator, newline, space, word] = m;

    if (comment !== undefined) {
      out.push({ text, kind: 'comment' });
    } else if (dq !== undefined || sq !== undefined) {
      out.push(...splitStringForVariables(text));
    } else if (variable !== undefined) {
      out.push({ text, kind: 'variable' });
    } else if (operator !== undefined) {
      out.push({ text, kind: 'punct' });
      expectCommand = true;
    } else if (newline !== undefined) {
      out.push({ text, kind: 'plain' });
      expectCommand = true;
    } else if (space !== undefined) {
      out.push({ text, kind: 'plain' });
    } else if (word !== undefined) {
      // Flags are recognised by shape rather than by the whitespace in front of
      // them. Requiring exactly one leading whitespace character meant "-H" on
      // an indented continuation line was never matched.
      if (word === '\\') {
        out.push({ text, kind: 'punct' });
      } else if (/^--?[A-Za-z]/.test(word)) {
        out.push({ text, kind: 'flag' });
      } else {
        out.push({ text, kind: expectCommand ? 'command' : 'plain' });
        // `sudo`, `env` and friends are commands, and so is the word after them.
        if (expectCommand) expectCommand = /^(sudo|env|time|nohup|doas)$/.test(word);
      }
    }
  }

  return out;
}

/** Highlights `$VAR` inside a quoted string without losing the quotes. */
function splitStringForVariables(text: string): Token[] {
  const out: Token[] = [];
  const re = /\$\{[^}]*\}|\$[A-Za-z_]\w*/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), kind: 'string' });
    out.push({ text: m[0], kind: 'variable' });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: 'string' });
  return out;
}

/**
 * JSON. A string is a key only when the next non-space character is a colon,
 * which is the one thing separating `"status"` from `"ok"`.
 */
function tokenizeJson(src: string): Token[] {
  const re =
    /(\/\/[^\n]*)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(\btrue\b|\bfalse\b|\bnull\b)|([{}[\],:])|(\s+)/g;

  const out: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), kind: 'plain' });
    const [text, comment, str, num, literal, punct, space] = m;

    if (comment !== undefined) out.push({ text, kind: 'comment' });
    else if (str !== undefined) {
      const rest = src.slice(m.index + text.length);
      out.push({ text, kind: /^\s*:/.test(rest) ? 'key' : 'string' });
    } else if (num !== undefined) out.push({ text, kind: 'number' });
    else if (literal !== undefined) out.push({ text, kind: 'literal' });
    else if (punct !== undefined) out.push({ text, kind: 'punct' });
    else if (space !== undefined) out.push({ text, kind: 'plain' });

    last = m.index + text.length;
  }
  if (last < src.length) out.push({ text: src.slice(last), kind: 'plain' });

  return out;
}

/**
 * Tabular command output — `docker ps` and friends. The first column names the
 * thing and the rest is status, so the name stays bright and the state words
 * carry the only real signal.
 */
function tokenizeTable(src: string): Token[] {
  const re = /(#[^\n]*)|(\s+)|(\(\d+\))|(\d+(?:\.\d+)?)|(\S+)/g;

  const out: Token[] = [];
  let first = true;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    const [text, comment, space, exitCode, num, word] = m;

    if (comment !== undefined) out.push({ text, kind: 'comment' });
    else if (space !== undefined) out.push({ text, kind: 'plain' });
    else if (exitCode !== undefined) out.push({ text, kind: 'number' });
    else if (num !== undefined) out.push({ text, kind: 'number' });
    else if (word !== undefined) {
      if (first) {
        out.push({ text, kind: 'property' });
        first = false;
      } else if (OK_WORDS.test(word)) out.push({ text, kind: 'ok' });
      else if (WARN_WORDS.test(word)) out.push({ text, kind: 'warn' });
      else out.push({ text, kind: 'plain' });
    }
  }

  return out;
}

/** TypeScript and Python share enough structure for one pass with two keyword sets. */
function tokenizeCode(src: string, lang: 'typescript' | 'python'): Token[] {
  const keywords = new Set(KEYWORDS[lang]);
  const re =
    /(#[^\n]*|\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(\s+)/g;

  const out: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), kind: 'punct' });
    const [text, comment, str, num, word, space] = m;

    if (comment !== undefined) out.push({ text, kind: 'comment' });
    else if (str !== undefined) out.push({ text, kind: 'string' });
    else if (num !== undefined) out.push({ text, kind: 'number' });
    else if (word !== undefined) {
      if (keywords.has(word)) out.push({ text, kind: 'keyword' });
      // A word followed by "(" is being called; a word after "." is a property.
      else if (/^\s*\(/.test(src.slice(m.index + text.length))) out.push({ text, kind: 'command' });
      else if (src[m.index - 1] === '.') out.push({ text, kind: 'property' });
      else out.push({ text, kind: 'plain' });
    } else if (space !== undefined) out.push({ text, kind: 'plain' });

    last = m.index + text.length;
  }
  if (last < src.length) out.push({ text: src.slice(last), kind: 'punct' });

  return out;
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

const ALIASES: Record<string, Lang> = {
  bash: 'shell',
  sh: 'shell',
  zsh: 'shell',
  console: 'shell',
  shell: 'shell',
  json: 'json',
  ts: 'typescript',
  typescript: 'typescript',
  js: 'typescript',
  javascript: 'typescript',
  py: 'python',
  python: 'python',
  table: 'table',
  text: 'table',
};

export function tokenize(source: string, language: string): Token[] {
  const lang = ALIASES[language] ?? 'shell';
  switch (lang) {
    case 'json':
      return tokenizeJson(source);
    case 'table':
      return tokenizeTable(source);
    case 'typescript':
    case 'python':
      return tokenizeCode(source, lang);
    default:
      return tokenizeShell(source);
  }
}

/** Render `source` as coloured React nodes. */
export function highlight(source: string, language: string): ReactNode {
  return tokenize(source, language).map((token, i) =>
    token.kind === 'plain' ? (
      <Fragment key={i}>{token.text}</Fragment>
    ) : (
      <span key={i} className={CLASS_FOR[token.kind]}>
        {token.text}
      </span>
    ),
  );
}
