/**
 * Docker Engine Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 * 
 * Hey dev! :) This service handles querying Docker containers and local images straight from the host Docker daemon.
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
}

export const dockerService = new DockerService();
