/**
 * Docker Engine Service
 * Developed by NotGamerPratham (https://notgamerpratham.com)
 *
 * Queries Docker containers and local images from the host Docker daemon via the vpsgui-agent.
 */

import { ContainerItem, DockerImageItem } from '../types/docker';
import { apiClient, ApiError } from '../api/client';

function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Unauthorized - set a valid Agent Token under Settings.';
    if (e.status === 0) return `Agent unreachable: ${e.message}`;
    return e.message;
  }
  return e instanceof Error ? e.message : 'Unknown error';
}

class DockerService {
  /**
   * Active and stopped containers.
   *
   * The error is returned rather than swallowed into an empty array, so the UI can distinguish
   * "no containers on this host" from "Docker socket unreachable" or "missing agent token".
   */
  async fetchContainers(): Promise<{ containers: ContainerItem[]; error: string | null }> {
    try {
      const res = await apiClient.get<ContainerItem[]>('/docker/containers');
      return { containers: Array.isArray(res) ? res : [], error: null };
    } catch (e) {
      return { containers: [], error: describeError(e) };
    }
  }

  /** Local Docker images. */
  async fetchImages(): Promise<{ images: DockerImageItem[]; error: string | null }> {
    try {
      const res = await apiClient.get<DockerImageItem[]>('/docker/images');
      return { images: Array.isArray(res) ? res : [], error: null };
    } catch (e) {
      return { images: [], error: describeError(e) };
    }
  }

  /**
   * Remove a local image.
   *
   * `force` is opt-in: without it docker refuses to remove an image still referenced by a
   * container, which is the safe default.
   */
  async removeImage(id: string, force = false): Promise<{ success: boolean; output: string }> {
    try {
      return await apiClient.post<{ success: boolean; output: string }>(
        '/docker/images/action',
        { id, action: 'remove', force },
        60000
      );
    } catch (e) {
      return { success: false, output: describeError(e) };
    }
  }

  /** Perform container lifecycle actions on the host Docker daemon. */
  async controlContainer(
    id: string,
    action: 'start' | 'stop' | 'restart' | 'remove'
  ): Promise<{ success: boolean; output: string }> {
    try {
      // Container operations can take longer than a plain read (image pulls, graceful stops).
      return await apiClient.post<{ success: boolean; output: string }>(
        '/docker/containers/action',
        { id, action },
        60000
      );
    } catch (e) {
      return { success: false, output: describeError(e) };
    }
  }
}

export const dockerService = new DockerService();
