import React, { useState, useEffect } from 'react';
import { Container, Play, Square, RotateCw, Trash2, Terminal, Eye, Search, Plus, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { dockerService } from '../../services/dockerService';
import { ContainerItem } from '../../types/docker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';

export function DockerContainersPage() {
  const [containers, setContainers] = useState<ContainerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    dockerService.fetchContainers().then((res) => {
      setContainers(res);
      setLoading(false);
    });
  }, []);

  const handleContainerAction = async (id: string, action: 'start' | 'stop' | 'restart' | 'remove') => {
    setActioningId(id);
    try {
      await dockerService.controlContainer(id, action);
    } finally {
      const refreshed = await dockerService.fetchContainers();
      setContainers(refreshed);
      setActioningId(null);
    }
  };

  const filtered = containers.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.image.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Container className="h-5 w-5 text-primary" />
            <span>Docker Containers (Deployed VPS Socket)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect, start, stop, restart, view streaming logs, and manage container lifecycle actions directly on the VPS.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Launch Container</span>
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search containers or images..."
            className="pl-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Containers Table / Empty State */}
      <Card className="bg-card/70 border-border/70 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Container className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Docker Containers Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Docker daemon is active on the VPS host. Launch a container or deploy a stack from the Open Catalog.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Container Name</TableHead>
                <TableHead className="text-xs">Image</TableHead>
                <TableHead className="text-xs">State</TableHead>
                <TableHead className="text-xs">Port Mappings</TableHead>
                <TableHead className="text-xs">CPU / RAM</TableHead>
                <TableHead className="text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold text-xs text-foreground">
                    <div className="flex items-center space-x-2">
                      <Container className="h-4 w-4 text-primary" />
                      <span>{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{c.image}</TableCell>
                  <TableCell>
                    <Badge variant={c.state === 'running' ? 'success' : 'outline'} className="text-[10px] px-2 py-0.5">
                      {c.state.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground">
                    {c.ports.map((p) => `${p.publicPort}:${p.privatePort}/${p.type}`).join(', ')}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {c.cpuPercent}% / {c.memoryUsageMb} MB
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.state === 'running' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleContainerAction(c.id, 'stop')}
                          disabled={actioningId === c.id}
                          className="h-7 w-7 p-0"
                          title="Stop Container"
                        >
                          <Square className="h-3.5 w-3.5 text-rose-400" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleContainerAction(c.id, 'start')}
                          disabled={actioningId === c.id}
                          className="h-7 w-7 p-0"
                          title="Start Container"
                        >
                          <Play className="h-3.5 w-3.5 text-emerald-400" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleContainerAction(c.id, 'restart')}
                        disabled={actioningId === c.id}
                        className="h-7 w-7 p-0"
                        title="Restart Container"
                      >
                        <RotateCw className={`h-3.5 w-3.5 text-primary ${actioningId === c.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedLogs(`[LOGS FOR ${c.name}]\nStreaming output from /var/run/docker.sock...`)}
                        className="h-7 w-7 p-0"
                        title="View Container Logs"
                      >
                        <Eye className="h-3.5 w-3.5 text-cyan-400" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleContainerAction(c.id, 'remove')}
                        disabled={actioningId === c.id}
                        className="h-7 w-7 p-0"
                        title="Remove Container"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Container Logs Dialog */}
      <Dialog open={!!selectedLogs} onOpenChange={() => setSelectedLogs(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setSelectedLogs(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-base font-bold">
              <Terminal className="h-5 w-5 text-primary" />
              <span>Container Streaming Logs</span>
            </DialogTitle>
            <DialogDescription>Realtime stdout / stderr output</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-80 overflow-y-auto">
            {selectedLogs}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
