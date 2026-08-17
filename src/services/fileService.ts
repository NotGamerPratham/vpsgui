/**
 * VPS Filesystem Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Hey dev! :) This service powers the VS Code style file manager by reading directory trees directly from the host Linux VPS.
 */

import { FileItem } from '../types/file';
import { apiClient } from '../api/client';

class FileService {
  // Read directory contents and file attributes for target path :)
  async fetchFiles(path: string = '/etc'): Promise<FileItem[]> {
    try {
      return await apiClient.get<FileItem[]>(`/files?path=${encodeURIComponent(path)}`);
    } catch (e) {
      // Permission denied or invalid directory path fallback :(
      return [];
    }
  }

  // Persist edited file content back to the host VPS via the agent
  async writeFile(path: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await apiClient.post<{ success: boolean; error?: string }>('/files/write', { path, content });
    } catch (e: any) {
      return { success: false, error: e.message || 'Failed to save file' };
    }
  }
}

export const fileService = new FileService();
