import { useState, useEffect, useCallback } from 'react';
import { dockerService } from '../services/dockerService';
import { ContainerItem, DockerImageItem } from '../types/docker';

export function useDocker(autoRefreshInterval: number = 5000) {
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [images, setImages] = useState<DockerImageItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDockerData = useCallback(async () => {
    try {
      const [cRes, iRes] = await Promise.all([
        dockerService.fetchContainers(),
        dockerService.fetchImages(),
      ]);
      setContainers(cRes);
      setImages(iRes);
    } catch (e) {
      console.warn('Docker data fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDockerData();
    const interval = setInterval(fetchDockerData, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [fetchDockerData, autoRefreshInterval]);

  return { containers, images, loading, refreshDockerData: fetchDockerData };
}
