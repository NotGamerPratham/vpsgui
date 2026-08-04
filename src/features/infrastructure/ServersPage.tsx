import React, { useState } from 'react';
import {
  Server,
  Plus,
  Search,
  Filter,
  Globe,
  Terminal,
  RotateCw,
  Trash2,
  Check,
  ShieldCheck,
  Cpu,
  HardDrive,
  Star,
  Copy,
} from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';

export function ServersPage() {
  const { nodes, toggleFavorite, addNode, removeNode, rebootNode } = useServerStore();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    ipAddress: '',
    sshPort: 22,
    sshUser: 'root',
    authMethod: 'ssh_key' as 'ssh_key' | 'password',
    tags: 'production, web',
    autoInstallAgent: true,
  });

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.network.publicIp.includes(search) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ipAddress) return;

    addNode({
      name: formData.name,
      alias: formData.alias,
      type: 'linux',
      ipAddress: formData.ipAddress,
      sshPort: Number(formData.sshPort),
      authMethod: formData.authMethod,
      sshUser: formData.sshUser,
      tags: formData.tags.split(',').map((t) => t.trim()),
      autoInstallAgent: formData.autoInstallAgent,
    });

    setIsAddModalOpen(false);
    setFormData({ name: '', alias: '', ipAddress: '', sshPort: 22, sshUser: 'root', authMethod: 'ssh_key', tags: 'production, web', autoInstallAgent: true });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <span>Infrastructure Nodes & Servers</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your Linux VPS servers, Bare-Metal instances, Docker hosts, and Kubernetes nodes.
          </p>
        </div>

        <Button onClick={() => setIsAddModalOpen(true)} className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Add VPS Server</span>
        </Button>
      </div>

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter nodes by name, IP, or tag..."
            className="pl-9 text-xs bg-card"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span>Showing <strong className="text-foreground">{filteredNodes.length}</strong> nodes</span>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredNodes.map((node) => (
          <Card key={node.id} className="bg-card/70 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground leading-none">{node.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-1 font-mono">{node.network.publicIp}</p>
                  </div>
                </div>

                <button onClick={() => toggleFavorite(node.id)} className="text-muted-foreground hover:text-amber-400">
                  <Star className={`h-4 w-4 ${node.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0 flex-1">
              <div className="flex items-center justify-between text-xs border-y border-border/40 py-2">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3 text-primary" /> {node.location.city}, {node.location.country}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40">
                  <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                  <span>{node.hardware.cpuCores} vCPU Cores</span>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40">
                  <HardDrive className="h-3.5 w-3.5 text-violet-400" />
                  <span>{node.hardware.ramGb} GB RAM</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {node.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>

            <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 flex items-center justify-between">
              <Badge variant="success" className="text-[10px] px-1.5 py-0">
                {node.status.toUpperCase()}
              </Badge>

              <div className="flex items-center space-x-1">
                <Button size="sm" variant="ghost" title="Reboot Node" onClick={() => rebootNode(node.id)} className="h-7 w-7 p-0">
                  <RotateCw className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button size="sm" variant="ghost" title="Delete Node" onClick={() => removeNode(node.id)} className="h-7 w-7 p-0 hover:text-rose-400">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Server Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg" onClose={() => setIsAddModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-base font-bold">
              <Plus className="h-5 w-5 text-primary" />
              <span>Connect New VPS Node</span>
            </DialogTitle>
            <DialogDescription>
              Enter server connection details or SSH credentials to pair with VPSGUI.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4 my-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground">Server Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. vps-prod-web-01"
                  required
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Alias (Optional)</label>
                <Input
                  value={formData.alias}
                  onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                  placeholder="e.g. Primary Nginx Node"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground">Public IP Address</label>
                <Input
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="e.g. 135.181.42.89"
                  required
                  className="text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">SSH Port</label>
                <Input
                  type="number"
                  value={formData.sshPort}
                  onChange={(e) => setFormData({ ...formData, sshPort: Number(e.target.value) })}
                  className="text-xs mt-1 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Tags (comma separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="production, web, europe"
                className="text-xs mt-1"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="agent"
                checked={formData.autoInstallAgent}
                onChange={(e) => setFormData({ ...formData, autoInstallAgent: e.target.checked })}
                className="rounded border-border bg-card text-primary focus:ring-primary"
              />
              <label htmlFor="agent" className="text-xs text-muted-foreground">
                Auto-install lightweight <span className="font-mono text-primary">vpsgui-agent</span> binary via SSH
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs bg-primary">
                Add Server
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
