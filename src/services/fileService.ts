/**
 * VPS Filesystem Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * Powers the VS Code style file manager by reading directory trees from the host Linux VPS through
 * the vpsgui-agent daemon. The agent confines every path to its configured file roots.
 */

import { FileItem } from '../types/file';
import { apiClient, ApiError } from '../api/client';

export interface FileReadResult {
  path: string;
  content: string;
  /** True when the file exceeded the agent's read cap and only a prefix was returned. */
  truncated: boolean;
  sizeBytes: number;
  /** False for truncated files: saving would overwrite the original with a partial copy. */
  editable: boolean;
  /** True when the resolved path is inside a system-owned tree. */
  system?: boolean;
}

export interface FileListResult {
  items: FileItem[];
  error: string | null;
  /**
   * The agent's configured file roots, present when a request was refused for
   * being outside them. Lets the UI name the actual limit instead of leaving
   * the operator to guess why "/" is forbidden.
   */
  roots?: string[] | null;
}

class FileService {
  /**
   * List a directory. Returns the error text rather than swallowing it, so the UI can tell a
   * genuinely empty directory apart from a permission failure or a missing agent token.
   */
  async fetchFiles(path: string): Promise<FileListResult> {
    try {
      const items = await apiClient.get<FileItem[]>(`/files?path=${encodeURIComponent(path)}`);
      return { items: Array.isArray(items) ? items : [], error: null };
    } catch (e) {
      return { items: [], error: describeError(e), roots: rootsFromError(e) };
    }
  }

  /**
   * Read one file's full contents.
   *
   * Contents are deliberately NOT part of the directory listing: the listing used to embed the
   * first 5000 characters of every file, and saving then wrote that truncated copy back over the
   * original, silently destroying anything past the cut-off.
   */
  async readFile(path: string): Promise<FileReadResult> {
    return apiClient.get<FileReadResult>(`/files/read?path=${encodeURIComponent(path)}`);
  }

  /** Create a directory on the host. */
  async createDirectory(path: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/files/mkdir', { path });
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  /**
   * Delete a file or directory.
   *
   * `recursive` is opt-in: without it the agent refuses to remove a non-empty directory, so a
   * mis-click cannot destroy a tree.
   */
  async deletePath(path: string, recursive = false): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/files/delete', { path, recursive });
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  /** Rename or move a path. Both endpoints are confined to the agent's file roots. */
  async renamePath(from: string, to: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/files/rename', { from, to });
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  /** Persist edited file content back to the host VPS via the agent. */
  async writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/files/write', { path, content });
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }
}

/** Pull the agent's configured roots out of a confinement error, if it sent them. */
export function rootsFromError(e: unknown): string[] | null {
  if (!(e instanceof ApiError)) return null;
  const roots = e.details?.roots;
  return Array.isArray(roots) ? roots.map(String) : null;
}

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Unauthorized - set a valid Agent Token under Settings.';
    if (e.status === 403) return e.message;
    if (e.status === 0) return `Agent unreachable: ${e.message}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Unknown error';
}

export const fileService = new FileService();
