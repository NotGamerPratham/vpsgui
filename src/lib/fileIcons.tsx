import {
  Binary,
  Database,
  FileArchive,
  FileAudio,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileKey,
  FileLock,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderGit2,
  FolderLock,
  Link2,
  type LucideIcon,
} from 'lucide-react';

import { FileItem } from '../types/file';

/**
 * Icon and tint for one filesystem entry.
 *
 * Colour is grouping, not decoration: every config format shares one hue, every
 * archive another, so a directory of mixed content is scannable without reading
 * each name. Kept to the categories that actually show up on a server.
 */
export interface FileIconSpec {
  Icon: LucideIcon;
  /** Tailwind text colour class. */
  className: string;
  /** Short human label, used for the tooltip and screen readers. */
  label: string;
}

/** Extensions grouped by what the file is for, not by which program made it. */
const BY_EXTENSION: Array<{ exts: string[]; spec: FileIconSpec }> = [
  {
    exts: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'lua', 'pl'],
    spec: { Icon: FileCode, className: 'text-cyan-400', label: 'Source code' },
  },
  {
    exts: ['sh', 'bash', 'zsh', 'fish', 'ksh', 'run'],
    spec: { Icon: FileTerminal, className: 'text-emerald-400', label: 'Shell script' },
  },
  {
    exts: ['json', 'jsonc', 'json5'],
    spec: { Icon: FileJson, className: 'text-amber-400', label: 'JSON' },
  },
  {
    exts: ['conf', 'cfg', 'ini', 'toml', 'yaml', 'yml', 'env', 'properties', 'rc', 'service', 'socket', 'timer', 'mount', 'target', 'nginx'],
    spec: { Icon: FileCog, className: 'text-amber-400', label: 'Configuration' },
  },
  {
    exts: ['html', 'htm', 'xml', 'xhtml', 'vue', 'svelte'],
    spec: { Icon: FileCode, className: 'text-orange-400', label: 'Markup' },
  },
  {
    exts: ['css', 'scss', 'sass', 'less', 'styl'],
    spec: { Icon: FileType, className: 'text-sky-400', label: 'Stylesheet' },
  },
  {
    exts: ['md', 'markdown', 'rst', 'adoc', 'txt', 'text', 'nfo'],
    spec: { Icon: FileText, className: 'text-slate-300', label: 'Text' },
  },
  {
    exts: ['log', 'out', 'err'],
    spec: { Icon: FileText, className: 'text-slate-500', label: 'Log' },
  },
  {
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif', 'tiff'],
    spec: { Icon: FileImage, className: 'text-violet-400', label: 'Image' },
  },
  {
    exts: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
    spec: { Icon: FileVideo, className: 'text-violet-400', label: 'Video' },
  },
  {
    exts: ['mp3', 'wav', 'flac', 'ogg', 'm4a'],
    spec: { Icon: FileAudio, className: 'text-violet-400', label: 'Audio' },
  },
  {
    exts: ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst', '7z', 'rar', 'deb', 'rpm', 'apk'],
    spec: { Icon: FileArchive, className: 'text-rose-400', label: 'Archive' },
  },
  {
    exts: ['pem', 'key', 'crt', 'cer', 'pub', 'p12', 'pfx', 'gpg', 'asc'],
    spec: { Icon: FileKey, className: 'text-rose-400', label: 'Key or certificate' },
  },
  {
    exts: ['db', 'sqlite', 'sqlite3', 'sql', 'dump'],
    spec: { Icon: Database, className: 'text-teal-400', label: 'Database' },
  },
  {
    exts: ['csv', 'tsv', 'xlsx', 'xls', 'ods'],
    spec: { Icon: FileSpreadsheet, className: 'text-emerald-400', label: 'Spreadsheet' },
  },
  {
    exts: ['so', 'o', 'a', 'bin', 'exe', 'dll', 'dylib', 'ko', 'img', 'iso'],
    spec: { Icon: Binary, className: 'text-slate-400', label: 'Binary' },
  },
];

const EXTENSION_LOOKUP: Record<string, FileIconSpec> = {};
for (const { exts, spec } of BY_EXTENSION) {
  for (const ext of exts) EXTENSION_LOOKUP[ext] = spec;
}

/**
 * Files with no extension that are still recognisable by name. A server is full
 * of these — `Dockerfile`, `Makefile`, `authorized_keys` — and falling back to a
 * blank page icon for all of them wastes the most useful column in the tree.
 */
const BY_NAME: Record<string, FileIconSpec> = {
  dockerfile: { Icon: FileCog, className: 'text-sky-400', label: 'Dockerfile' },
  'docker-compose.yml': { Icon: FileCog, className: 'text-sky-400', label: 'Compose file' },
  makefile: { Icon: FileTerminal, className: 'text-emerald-400', label: 'Makefile' },
  'authorized_keys': { Icon: FileKey, className: 'text-rose-400', label: 'SSH keys' },
  known_hosts: { Icon: FileKey, className: 'text-rose-400', label: 'SSH known hosts' },
  passwd: { Icon: FileLock, className: 'text-amber-400', label: 'Account database' },
  group: { Icon: FileLock, className: 'text-amber-400', label: 'Group database' },
  fstab: { Icon: FileCog, className: 'text-amber-400', label: 'Mount table' },
  hosts: { Icon: FileCog, className: 'text-amber-400', label: 'Static host table' },
  crontab: { Icon: FileCog, className: 'text-amber-400', label: 'Cron table' },
  '.gitignore': { Icon: FileCode, className: 'text-slate-400', label: 'Git ignore' },
  '.gitattributes': { Icon: FileCode, className: 'text-slate-400', label: 'Git attributes' },
  '.gitmodules': { Icon: FileCode, className: 'text-slate-400', label: 'Git submodules' },
  '.dockerignore': { Icon: FileCode, className: 'text-slate-400', label: 'Docker ignore' },
  '.npmignore': { Icon: FileCode, className: 'text-slate-400', label: 'npm ignore' },
  '.eslintignore': { Icon: FileCode, className: 'text-slate-400', label: 'ESLint ignore' },
  '.editorconfig': { Icon: FileCog, className: 'text-amber-400', label: 'Editor config' },
  '.nvmrc': { Icon: FileCog, className: 'text-amber-400', label: 'Node version' },
  '.env': { Icon: FileLock, className: 'text-amber-400', label: 'Environment file' },
  license: { Icon: FileText, className: 'text-slate-300', label: 'Licence' },
  readme: { Icon: FileText, className: 'text-slate-300', label: 'Readme' },
};

const DIRECTORY: FileIconSpec = { Icon: Folder, className: 'text-amber-400', label: 'Directory' };
const GIT_DIRECTORY: FileIconSpec = { Icon: FolderGit2, className: 'text-orange-400', label: 'Git directory' };
const BLOCKED_DIRECTORY: FileIconSpec = { Icon: FolderLock, className: 'text-slate-500', label: 'Directory' };
const SYMLINK: FileIconSpec = { Icon: Link2, className: 'text-violet-400', label: 'Symbolic link' };
const BLOCKED: FileIconSpec = { Icon: FileLock, className: 'text-slate-500', label: 'Blocked by the agent' };
const GENERIC: FileIconSpec = { Icon: FileText, className: 'text-slate-400', label: 'File' };

/** Pick the icon for a listing entry. */
export function iconForFile(item: FileItem): FileIconSpec {
  if (item.readable === false) return item.isDirectory ? BLOCKED_DIRECTORY : BLOCKED;
  if (item.type === 'directory') return item.name === '.git' ? GIT_DIRECTORY : DIRECTORY;
  if (item.type === 'symlink') return SYMLINK;

  const lower = item.name.toLowerCase();
  if (BY_NAME[lower]) return BY_NAME[lower];

  // A dotfile's identity is its first segment including the dot, so
  // ".env.production" reads as an env file rather than as extension "production".
  // Splitting on "." naively yields "" for these, which matched nothing.
  if (lower.startsWith('.')) {
    const dotName = `.${lower.slice(1).split('.')[0]}`;
    if (BY_NAME[dotName]) return BY_NAME[dotName];
  }

  // `readme.md` should still read as a readme, and `nginx.conf.bak` as config.
  const stem = lower.split('.')[0];
  if (stem && BY_NAME[stem]) return BY_NAME[stem];

  const ext = (item.extension || lower.split('.').pop() || '').toLowerCase();
  return EXTENSION_LOOKUP[ext] || GENERIC;
}
