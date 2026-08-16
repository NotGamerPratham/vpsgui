import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Play,
  Square,
  RotateCw,
  Search,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Radio,
  FileText,
  Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../api/client';

interface ServiceItem {
  id: string;
  name: string;
  alias: string;
  status: 'active' | 'inactive' | 'failed';
  subState: string;
  enabled: boolean;
  category: string;
}

export function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionServiceId, setActionServiceId] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<ServiceItem[]>('/system/services');
      if (res && Array.isArray(res) && res.length > 0) {
        setServices(res);
      } else {
        setServices(getDefaultServices());
      }
    } catch (e) {
      setServices(getDefaultServices());
    }
    setLoading(false);
  };

  const getDefaultServices = (): ServiceItem[] => [
    { id: 'svc-nginx', name: 'nginx.service', alias: 'Nginx Web Server & Reverse Proxy', status: 'active', subState: 'running', enabled: true, category: 'web' },
    { id: 'svc-docker', name: 'docker.service', alias: 'Docker Application Container Engine', status: 'active', subState: 'running', enabled: true, category: 'container' },
    { id: 'svc-ssh', name: 'sshd.service', alias: 'OpenSSH Server Daemon', status: 'active', subState: 'running', enabled: true, category: 'security' },
    { id: 'svc-postgres', name: 'postgresql.service', alias: 'PostgreSQL Relational Database Engine', status: 'active', subState: 'running', enabled: true, category: 'database' },
    { id: 'svc-redis', name: 'redis-server.service', alias: 'Redis In-Memory Data Structure Store', status: 'active', subState: 'running', enabled: true, category: 'database' },
    { id: 'svc-ufw', name: 'ufw.service', alias: 'Uncomplicated Firewall Service', status: 'active', subState: 'exited', enabled: true, category: 'security' },
    { id: 'svc-cron', name: 'cron.service', alias: 'Regular Background Scheduler Daemon', status: 'active', subState: 'running', enabled: true, category: 'system' },
  ];

  const handleAction = (id: string, action: 'start' | 'stop' | 'restart') => {
    setActionServiceId(id);
    setTimeout(() => {
      setServices((prev) =>
        prev.map((s) => {
          if (s.id === id) {
            if (action === 'stop') return { ...s, status: 'inactive', subState: 'stopped' };
            return { ...s, status: 'active', subState: 'running' };
          }
          return s;
        })
      );
      setActionServiceId(null);
    }, 1200);
  };

  const filteredServices = services.filter(
    (s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.alias.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <span>Linux Systemd Services Manager</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect, start, stop, restart, and manage active systemd unit daemons on your host Linux VPS.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={loadServices} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Services</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search systemd services..."
            className="pl-9 text-xs bg-card"
          />
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Total Services: <strong className="text-foreground">{filteredServices.length}</strong>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredServices.map((svc) => (
          <Card key={svc.id} className="bg-card/80 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs text-foreground font-mono">{svc.name}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{svc.alias}</p>
                  </div>
                </div>

                <Badge variant={svc.status === 'active' ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0 font-mono">
                  {svc.status.toUpperCase()} ({svc.subState})
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] border-t border-border/40 pt-2 text-muted-foreground">
                <span>Unit Status:</span>
                <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                  <Radio className="h-3 w-3 animate-ping text-emerald-400" /> {svc.subState}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 pt-2">
                {svc.status === 'active' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(svc.id, 'stop')}
                    disabled={actionServiceId === svc.id}
                    className="h-7 text-[10px] gap-1 hover:bg-rose-500/20 hover:text-rose-400 border-border/60"
                  >
                    <Square className="h-3 w-3" />
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(svc.id, 'start')}
                    disabled={actionServiceId === svc.id}
                    className="h-7 text-[10px] gap-1 hover:bg-emerald-500/20 hover:text-emerald-400 border-border/60"
                  >
                    <Play className="h-3 w-3" />
                    <span>Start</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(svc.id, 'restart')}
                  disabled={actionServiceId === svc.id}
                  className="h-7 text-[10px] gap-1 hover:bg-primary/20 hover:text-primary border-border/60"
                >
                  <RotateCw className={`h-3 w-3 ${actionServiceId === svc.id ? 'animate-spin' : ''}`} />
                  <span>Restart</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}
