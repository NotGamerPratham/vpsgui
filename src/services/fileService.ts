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

  /**
   * Fetch a file's exact bytes for saving locally.
   *
   * Not `readFile`: that caps at the agent's editor limit and returns a JSON string, so a 3 MB log
   * would arrive truncated and a binary would arrive corrupted. This streams the whole file.
   */
  async downloadFile(path: string): Promise<{ success: boolean; error?: string; blob?: Blob }> {
    try {
      const blob = await apiClient.download(`/files/download?path=${encodeURIComponent(path)}`);
      return { success: true, blob };
    } catch (e) {
      return { success: false, error: describeError(e) };
    }
  }

  /**
   * Delete several paths in one request.
   *
   * The agent resolves and checks each path separately and answers with a per-path breakdown, so a
   * selection containing one refusal still removes the rest rather than failing as a whole.
   */
  async deleteMany(
    paths: string[],
    recursive = false
  ): Promise<{ success: boolean; deleted: string[]; failed: { path: string; error: string }[]; error?: string }> {
    try {
      return await apiClient.post('/files/delete-many', { paths, recursive }, 120000);
    } catch (e) {
      return { success: false, deleted: [], failed: [], error: describeError(e) };
    }
  }

  /**
   * Upload a file's raw bytes to a directory on the host.
   *
   * Not routed through `writeFile`: that sends the content as a JSON string, which mangles anything
   * that is not UTF-8 text. This sends the bytes as-is, so an image or an archive arrives intact.
   *
   * `overwrite` is opt-in. The agent answers 409 for an existing path otherwise, which the caller
   * turns into a confirmation rather than silently replacing a file the operator did not mean to
   * touch.
   */
  async uploadFile(
    directory: string,
    file: File,
    { overwrite = false }: { overwrite?: boolean } = {}
  ): Promise<{ success: boolean; error?: string; conflict?: boolean; path?: string; sizeBytes?: number }> {
    // Browsers expose only the base name, but a crafted one could still contain a separator; the
    // agent confines the resolved path regardless, and stripping here keeps the request honest.
    const name = file.name.replace(/^.*[\\/]/, '').trim();
    if (!name) return { success: false, error: 'That file has no usable name' };

    const target = `${directory.replace(/[\\/]+$/, '')}/${name}`;
    const query = `?path=${encodeURIComponent(target)}${overwrite ? '&overwrite=1' : ''}`;

    try {
      return await apiClient.upload<{ success: boolean; path?: string; sizeBytes?: number }>(
        `/files/upload${query}`,
        file
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        return { success: false, conflict: true, error: e.message };
      }
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
