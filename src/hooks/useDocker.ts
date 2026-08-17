import { useState, useEffect, useCallback } from 'react';
import { dockerService } from '../services/dockerService';
import { ContainerItem, DockerImageItem } from '../types/docker';

export function useDocker(autoRefreshInterval: number = 5000) {
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [images, setImages] = useState<DockerImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDockerData = useCallback(async () => {
    const [cRes, iRes] = await Promise.all([dockerService.fetchContainers(), dockerService.fetchImages()]);
    setContainers(cRes.containers);
    setImages(iRes.images);
    setError(cRes.error ?? iRes.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await fetchDockerData();
      // Chain the next poll only after the previous one settles, so a slow agent cannot pile up
      // overlapping in-flight requests the way a bare setInterval did.
      if (!cancelled) timer = setTimeout(run, autoRefreshInterval);
    };
    let timer: ReturnType<typeof setTimeout> = setTimeout(run, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchDockerData, autoRefreshInterval]);

  return { containers, images, loading, error, refreshDockerData: fetchDockerData };
}
