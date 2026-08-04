import { ContainerItem, DockerImageItem } from '../types/docker';
import { apiClient } from '../api/client';

class DockerService {
  async fetchContainers(): Promise<ContainerItem[]> {
    try {
      return await apiClient.get<ContainerItem[]>('/docker/containers');
    } catch (e) {
      return [];
    }
  }

  async fetchImages(): Promise<DockerImageItem[]> {
    try {
      return await apiClient.get<DockerImageItem[]>('/docker/images');
    } catch (e) {
      return [];
    }
  }
}

export const dockerService = new DockerService();
