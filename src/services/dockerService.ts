/**
 * Docker Engine Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Handles querying Docker containers and local images straight from the host Docker daemon.
 */

import { ContainerItem, DockerImageItem } from '../types/docker';
import { apiClient } from '../api/client';

class DockerService {
  // Query active & stopped containers from local Docker daemon socket :)
  async fetchContainers(): Promise<ContainerItem[]> {
    try {
      return await apiClient.get<ContainerItem[]>('/docker/containers');
    } catch (e) {
      // Docker socket might be unattached or permission denied :(
      return [];
    }
  }

  // Fetch local Docker images list :)
  async fetchImages(): Promise<DockerImageItem[]> {
    try {
      return await apiClient.get<DockerImageItem[]>('/docker/images');
    } catch (e) {
      // Docker daemon query fallback :(
      return [];
    }
  }

  // Perform container actions (start, stop, restart, remove) on host Docker daemon
  async controlContainer(id: string, action: 'start' | 'stop' | 'restart' | 'remove'): Promise<{ success: boolean; output: string }> {
    try {
      return await apiClient.post<{ success: boolean; output: string }>('/docker/containers/action', { id, action });
    } catch (e: any) {
      return { success: false, output: e.message || 'Action failed' };
    }
  }
}

export const dockerService = new DockerService();
