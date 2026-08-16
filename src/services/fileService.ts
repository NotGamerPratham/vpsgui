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
}

export const fileService = new FileService();
