import React, { useState } from 'react';
import {
  Server,
  Plus,
  Search,
  Globe,
  RotateCw,
  Trash2,
  Cpu,
  HardDrive,
  Star,
  Copy,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  Lock,
  User,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerStore } from '../../store/useServerStore';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';

export function ServersPage() {
  const { nodes, toggleFavorite, addNode, removeNode, rebootNode, verifyNodeConnection } = useServerStore();
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [copiedScriptId, setCopiedScriptId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const localInstallScript = `cd /var/www/vpsgui/agent && bash install.sh`;

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    ipAddress: '',
    sshPort: 22,
    sshUser: 'root',
    authMethod: 'password' as 'password' | 'ssh_key',
    password: '',
    sshKeyId: '',
    tags: 'production, web',
    autoInstallAgent: true,
  });

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.network.publicIp.includes(search) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.ipAddress) return;

    setIsConnecting(true);

    const newNode = await addNode({
      name: formData.name,
      alias: formData.alias,
      type: 'linux',
      ipAddress: formData.ipAddress,
      sshPort: Number(formData.sshPort),
      authMethod: formData.authMethod,
      sshUser: formData.sshUser,
      password: formData.password,
      sshKeyId: formData.sshKeyId,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      autoInstallAgent: formData.autoInstallAgent,
    });

    // Test real-time pairing connection
    await verifyNodeConnection(newNode.id);

    setIsConnecting(false);
    setIsAddModalOpen(false);
    setFormData({
      name: '',
      alias: '',
      ipAddress: '',
      sshPort: 22,
      sshUser: 'root',
      authMethod: 'password',
      password: '',
      sshKeyId: '',
      tags: 'production, web',
      autoInstallAgent: true,
    });
  };

  const copyNodeScript = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScriptId(id);
    setTimeout(() => setCopiedScriptId(null), 2000);
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    await verifyNodeConnection(id);
    setVerifyingId(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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

        <Button onClick={() => setIsAddModalOpen(true)} className="gap-1.5 text-xs bg-primary font-bold">
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
      {filteredNodes.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No VPS Servers Added</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Click <strong>"Add VPS Server"</strong> above to register your target Linux VPS IP address and password.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredNodes.map((node) => {
              const isUnattached = node.agentStatus === 'unreachable' || node.hardware.cpuCores === 0;

              return (
                <motion.div
                  key={node.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -3, transition: { duration: 0.15 } }}
                >
                  <Card className="bg-card/70 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between h-full">
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

                      {isUnattached ? (
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-2">
                          <div className="flex items-center justify-between text-amber-400 text-[11px] font-bold">
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" /> Agent Not Detected
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVerify(node.id)}
                              disabled={verifyingId === node.id}
                              className="h-6 text-[10px] text-amber-400 hover:bg-amber-500/20 px-2 gap-1 font-mono"
                            >
                              <RefreshCw className={`h-3 w-3 ${verifyingId === node.id ? 'animate-spin' : ''}`} />
                              <span>{verifyingId === node.id ? 'Testing...' : 'Verify Agent'}</span>
                            </Button>
                          </div>

                          <p className="text-[10px] text-muted-foreground leading-tight">
                            Run installer on target VPS <code className="text-amber-400 font-mono">{node.network.publicIp}</code>:
                          </p>

                          <div className="space-y-1 pt-1">
                            <button
                              onClick={() => copyNodeScript(node.id, localInstallScript)}
                              className="flex w-full items-center justify-between text-[10px] font-mono text-muted-foreground bg-slate-950/80 p-1.5 rounded border border-border/50 hover:border-amber-500/50 hover:text-amber-300 transition-colors"
                            >
                              <span className="truncate">{localInstallScript}</span>
                              <Copy className="h-3 w-3 shrink-0 ml-1" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40">
                            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                            <span>{node.hardware.cpuCores} vCPU Cores</span>
                          </div>
                          <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40">
                            <HardDrive className="h-3.5 w-3.5 text-violet-400" />
                            <span>{node.hardware.ramGb > 0 ? `${node.hardware.ramGb} GB RAM` : 'Dynamic RAM'}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 pt-1">
                        {node.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>

                    <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                      <Badge variant={node.status === 'online' ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0 font-mono">
                        {isUnattached ? 'UNATTACHED' : node.status.toUpperCase()}
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
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Server Modal with Password & Real-Time Pairing */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg" onClose={() => setIsAddModalOpen(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-base font-bold">
              <Plus className="h-5 w-5 text-primary" />
              <span>Connect New VPS Node</span>
            </DialogTitle>
            <DialogDescription>
              Enter target Linux VPS IP address, SSH port, and password to pair with VPSGUI in real-time.
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
                  placeholder="e.g. Primary Web Server"
                  className="text-xs mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground">Target VPS IP Address / Hostname</label>
                <Input
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  placeholder="e.g. 194.62.248.20 or localhost"
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
                  placeholder="22"
                  required
                  className="text-xs mt-1 font-mono"
                />
              </div>
            </div>

            {/* Authentication Section: Password vs SSH Key */}
            <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" />
                  <span>Authentication Method</span>
                </label>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authMethod: 'password' })}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      formData.authMethod === 'password' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authMethod: 'ssh_key' })}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      formData.authMethod === 'ssh_key' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    SSH Key
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" /> SSH Username
                  </label>
                  <Input
                    value={formData.sshUser}
                    onChange={(e) => setFormData({ ...formData, sshUser: e.target.value })}
                    placeholder="root"
                    required
                    className="text-xs mt-1 font-mono"
                  />
                </div>

                {formData.authMethod === 'password' ? (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" /> VPS Password
                    </label>
                    <div className="relative mt-1">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••••••"
                        required
                        className="text-xs pr-8 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <Key className="h-3 w-3" /> Select Saved SSH Key
                    </label>
                    <Input
                      value={formData.sshKeyId}
                      onChange={(e) => setFormData({ ...formData, sshKeyId: e.target.value })}
                      placeholder="id_rsa_vpsgui"
                      className="text-xs mt-1 font-mono"
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground">Tags (Comma Separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="production, web, docker"
                className="text-xs mt-1"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isConnecting} className="text-xs bg-primary font-bold gap-1.5">
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Connecting Real-Time...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    <span>Connect & Stream Real-Time</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
