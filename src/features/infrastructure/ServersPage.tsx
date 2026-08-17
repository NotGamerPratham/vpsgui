import React, { useState } from 'react';
import {
  Server,
  Search,
  Globe,
  RotateCw,
  Cpu,
  HardDrive,
  Star,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServerStore } from '../../store/useServerStore';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';

export function ServersPage() {
  const { nodes, toggleFavorite, rebootNode, verifyNodeConnection } = useServerStore();
  const [search, setSearch] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [rebootMessage, setRebootMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.network.publicIp.includes(search) ||
      n.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
  );

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    await verifyNodeConnection(id);
    setVerifyingId(null);
  };

  // Rebooting drops every service on the host, so it must be confirmed and its outcome reported —
  // the button used to silently fake the reboot in local state only.
  const handleReboot = async (id: string, name: string) => {
    if (!window.confirm(`Reboot ${name}? This restarts the host and interrupts every service on it.`)) {
      return;
    }
    setRebootingId(id);
    setRebootMessage(null);
    const result = await rebootNode(id);
    setRebootMessage({ ok: result.success, text: result.message });
    setRebootingId(null);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <span>Host Linux VPS Server</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active Linux VPS system host configuration, real-time hardware telemetry, and daemon status.
          </p>
        </div>

        <Badge variant="success" className="font-mono text-xs gap-1.5 px-3 py-1 self-start md:self-auto">
          <ShieldCheck className="h-4 w-4" />
          <span>Single Host System Locked</span>
        </Badge>
      </div>

      {rebootMessage && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            rebootMessage.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
          }`}
        >
          {rebootMessage.text}
        </div>
      )}

      {/* Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search host details..."
            className="pl-9 text-xs bg-card"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
          <span>Active Host Node: <strong className="text-foreground">{filteredNodes[0]?.name || 'vps128'}</strong></span>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {filteredNodes.map((node) => (
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

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40 font-mono">
                      <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{node.hardware.cpuCores} vCPU Cores</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-muted/30 p-2 rounded border border-border/40 font-mono">
                      <HardDrive className="h-3.5 w-3.5 text-violet-400" />
                      <span>{node.hardware.ramGb} GB RAM</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {node.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>

                <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5 flex items-center justify-between">
                  <Badge variant="success" className="text-[10px] px-1.5 py-0 font-mono">
                    ONLINE (HOST AGENT)
                  </Badge>

                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Verify Host Telemetry Agent"
                      onClick={() => handleVerify(node.id)}
                      disabled={verifyingId === node.id}
                      className="h-7 px-2 text-[10px] gap-1 font-mono text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className={`h-3 w-3 ${verifyingId === node.id ? 'animate-spin' : ''}`} />
                      <span>Verify</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      title="Reboot host"
                      onClick={() => handleReboot(node.id, node.name)}
                      disabled={rebootingId === node.id}
                      className="h-7 w-7 p-0"
                    >
                      <RotateCw className={`h-3.5 w-3.5 text-muted-foreground ${rebootingId === node.id ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
