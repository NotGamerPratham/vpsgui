import React, { useState, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Trash2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { dockerService } from '../../services/dockerService';
import { DockerImageItem } from '../../types/docker';

export function DockerImagesPage() {
  const [images, setImages] = useState<DockerImageItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { images: list, error: fetchError } = await dockerService.fetchImages();
    setImages(list);
    setError(fetchError);
    setLoading(false);
  }, []);

  const [removingId, setRemovingId] = useState<string | null>(null);

  /** Remove an image via `docker rmi`, retrying with -f only after an explicit confirmation. */
  const handleRemove = async (img: DockerImageItem) => {
    const ref = img.repository && img.repository !== '<none>' ? `${img.repository}:${img.tag}` : img.id;
    if (!window.confirm(`Remove image ${ref}? This cannot be undone.`)) return;

    setRemovingId(img.id);
    setError(null);

    let result = await dockerService.removeImage(ref, false);
    // docker refuses while a container still references the image; forcing is the user's call.
    if (!result.success && /is being used|container/i.test(result.output || '')) {
      if (window.confirm(`${ref} is still referenced by a container.

${result.output}

Force removal?`)) {
        result = await dockerService.removeImage(ref, true);
      } else {
        setRemovingId(null);
        return;
      }
    }

    if (!result.success) setError(`Remove failed: ${(result.output || 'unknown error').slice(0, 300)}`);
    await refresh();
    setRemovingId(null);
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <span>Docker Images Repository</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pull new container images directly on the VPS host, inspect layers, and prune image caches.
          </p>
        </div>

        {/* "Pull Image" had no handler and the agent exposes no image-pull endpoint; use the
            Terminal page (`docker pull <image>`) until one exists. */}
        <Button onClick={refresh} disabled={loading} className="gap-1.5 text-xs bg-primary">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {images.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Docker Images Pulled</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Pull container images from Docker Hub or private registries directly into the host VPS.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Repository</TableHead>
                <TableHead className="text-xs">Tag</TableHead>
                <TableHead className="text-xs">Image Size</TableHead>
                <TableHead className="text-xs">Created</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((img) => (
                <TableRow key={img.id}>
                  <TableCell className="font-bold text-xs text-foreground font-mono">{img.repository}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{img.tag}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{img.size || `${img.sizeMb} MB`}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {img.created ? new Date(img.created).toLocaleString() : 'unknown'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(img)}
                      disabled={removingId === img.id}
                      title={`docker rmi ${img.repository}:${img.tag}`}
                      className="h-7 w-7 p-0 hover:text-rose-400"
                    >
                      {removingId === img.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
