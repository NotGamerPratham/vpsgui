export interface FileItem {
  name: string;
  path: string;
  size: number;
  sizeBytes: number;
  type: 'file' | 'directory' | 'symlink';
  isDirectory: boolean;
  extension?: string;
  /** Octal mode string (e.g. "0644"); empty when the agent could not stat the entry. */
  permissions: string;
  /** Numeric uid/gid as reported by the host. Empty when unavailable. */
  owner: string;
  group: string;
  /** ISO-8601, or null when the entry could not be stat'ed. */
  modifiedAt: string | null;
  /** False when the agent blocks this path (credential files). */
  readable?: boolean;
}

export interface FileEditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}
