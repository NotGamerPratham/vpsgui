import { FileItem } from '../types/file';
import { apiClient } from '../api/client';

class FileService {
  async fetchFiles(path: string = '/etc'): Promise<FileItem[]> {
    try {
      return await apiClient.get<FileItem[]>(`/files?path=${encodeURIComponent(path)}`);
    } catch (e) {
      return [];
    }
  }
}

export const fileService = new FileService();
