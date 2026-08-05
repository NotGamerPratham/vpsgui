import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  Container,
  Zap,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  RotateCw,
  Terminal,
  TrendingUp,
  Clock,
  LayoutGrid,
  Copy,
  Check,
  AlertCircle,
  FolderTree,
  Radio,
  Sparkles,
  Layers,
  Globe,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../store/useServerStore';
import { useUIStore } from '../../store/useUIStore';
import { telemetrySocket } from '../../websocket/socket';
import { globalEventBus } from '../../event-bus';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { TelemetryPoint } from '../../types/monitoring';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { nodes, fetchNodesFromApi } = useServerStore();
  const { setQuickLauncherOpen, setCommandPaletteOpen } = useUIStore();

  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [latestData, setLatestData] = useState<{ cpuPercent: number; ramPercent: number; tempC?: number; netRxKbps?: number; netTxKbps?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const installScript = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash`;

  useEffect(() => {
    fetchNodesFromApi();
    telemetrySocket.connect();

    const unsubscribe = globalEventBus.on('telemetry_tick', (data: any) => {
      if (!data) return;
      setLatestData({
        cpuPercent: data.cpuPercent || 0,
        ramPercent: data.ramPercent || 0,
        tempC: data.tempC,
        netRxKbps: data.netRxKbps,
        netTxKbps: data.netTxKbps,
      });

      setTelemetry((prev) => {
        const nextPoint: TelemetryPoint = {
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
          cpuPercent: data.cpuPercent || 0,
          ramPercent: data.ramPercent || 0,
          swapPercent: 0,
          diskPercent: 0,
          netRxKbps: data.netRxKbps || 0,
          netTxKbps: data.netTxKbps || 0,
          iowaitPercent: 0,
          tempC: data.tempC,
        };
        return [...prev.slice(-25), nextPoint];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const copyScript = () => {
    navigator.clipboard.writeText(installScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalCpuCores = nodes.reduce((sum, n) => sum + n.hardware.cpuCores, 0);
  const totalRamGb = nodes.reduce((sum, n) => sum + n.hardware.ramGb, 0);
  const onlineNodes = nodes.filter((n) => n.status === 'online').length;

  const currentCpu = latestData?.cpuPercent ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1].cpuPercent : 14);
  const currentRam = latestData?.ramPercent ?? (telemetry.length > 0 ? telemetry[telemetry.length - 1].ramPercent : 38);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Top Animated Header Banner */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <span>Infrastructure Command Center</span>
            </h1>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}>
              <Badge variant={onlineNodes > 0 ? 'success' : 'outline'} className="font-mono text-[10px] gap-1 px-2 py-0.5 shadow-sm">
                <Radio className="h-3 w-3 animate-ping text-emerald-400" />
                <span>{onlineNodes}/{nodes.length} Host Connected</span>
              </Badge>
            </motion.div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Realtime telemetry stream for Linux VPS nodes, Docker engines, and system processes.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button size="sm" variant="outline" onClick={() => setCommandPaletteOpen(true)} className="gap-1.5 text-xs shadow-sm border-border/80">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              <span>Cmd+K Search</span>
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button size="sm" onClick={() => setQuickLauncherOpen(true)} className="gap-1.5 text-xs bg-primary font-bold shadow-md shadow-primary/20">
              <Plus className="h-3.5 w-3.5" />
              <span>Connect Linux VPS</span>
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Unattached Onboarding Hero Banner */}
      {nodes.length === 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/90 border-primary/40 p-6 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-primary font-bold text-sm">
                  <AlertCircle className="h-5 w-5" />
                  <span>Connect Your Linux VPS Server</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  VPSGUI requires a live deployed Linux VPS server running the lightweight <span className="font-mono text-primary font-bold">vpsgui-agent</span>. Run this 1-line installation script on your Linux VPS terminal to stream real-time metrics.
                </p>
              </div>

              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button onClick={copyScript} className="gap-1.5 text-xs bg-primary shrink-0 font-bold shadow-md">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied Command' : 'Copy Linux Agent Script'}</span>
                </Button>
              </motion.div>
            </div>

            <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 flex items-center justify-between shadow-inner">
              <code>{installScript}</code>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Primary KPI Cards with Spring Animations & Gauges */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div whileHover={{ y: -4, scale: 1.015 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <Card className="bg-card/80 border-border/70 hover:border-primary/50 transition-all shadow-md group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Linux Nodes</p>
                <h3 className="text-2xl font-extrabold text-foreground mt-1 flex items-baseline gap-1.5 font-mono">
                  {onlineNodes} <span className="text-xs font-normal text-muted-foreground">/ {nodes.length} Host</span>
                </h3>
                <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  {onlineNodes > 0 ? 'Live Telemetry Socket' : 'Self-Host Mode Active'}
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Server className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4, scale: 1.015 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <Card className="bg-card/80 border-border/70 hover:border-cyan-500/50 transition-all shadow-md group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">vCPU Cores</p>
                <h3 className="text-2xl font-extrabold text-foreground mt-1 flex items-baseline gap-1.5 font-mono">
                  {totalCpuCores} <span className="text-xs font-normal text-muted-foreground">Cores</span>
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-cyan-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(currentCpu, 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-cyan-400">{currentCpu}%</span>
                </div>
              </div>
              <div className="h-11 w-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Cpu className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4, scale: 1.015 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <Card className="bg-card/80 border-border/70 hover:border-violet-500/50 transition-all shadow-md group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cluster RAM</p>
                <h3 className="text-2xl font-extrabold text-foreground mt-1 flex items-baseline gap-1.5 font-mono">
                  {totalRamGb} <span className="text-xs font-normal text-muted-foreground">GB Allocated</span>
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-violet-400 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(currentRam, 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-violet-400">{currentRam}%</span>
                </div>
              </div>
              <div className="h-11 w-11 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <HardDrive className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div whileHover={{ y: -4, scale: 1.015 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <Card className="bg-card/80 border-border/70 hover:border-emerald-500/50 transition-all shadow-md group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 flex items-center justify-between relative z-10">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docker Containers</p>
                <h3 className="text-2xl font-extrabold text-foreground mt-1 flex items-baseline gap-1.5 font-mono">
                  Active <span className="text-xs font-normal text-muted-foreground">Services</span>
                </h3>
                <p className="text-[11px] text-emerald-400 font-semibold flex items-center mt-1">
                  <Zap className="h-3 w-3 mr-1 fill-emerald-400" /> Docker Engine Ready
                </p>
              </div>
              <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                <Container className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Quick Interactive Tool Launchpad Bar */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/terminal')}
          className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-cyan-500/40 hover:bg-card text-left transition-all shadow-sm"
        >
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Terminal className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Web SSH Shell</h4>
            <p className="text-[10px] text-muted-foreground">Terminal workbench</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/files')}
          className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-violet-500/40 hover:bg-card text-left transition-all shadow-sm"
        >
          <div className="h-9 w-9 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0">
            <FolderTree className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">File Explorer</h4>
            <p className="text-[10px] text-muted-foreground">VPS code editor</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/docker/containers')}
          className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-emerald-500/40 hover:bg-card text-left transition-all shadow-sm"
        >
          <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Container className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Docker Manager</h4>
            <p className="text-[10px] text-muted-foreground">Containers & images</p>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/monitoring')}
          className="flex items-center space-x-3 p-3.5 rounded-xl border border-border/70 bg-card/60 hover:border-primary/40 hover:bg-card text-left transition-all shadow-sm"
        >
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground">Live Telemetry</h4>
            <p className="text-[10px] text-muted-foreground">Process monitors</p>
          </div>
        </motion.button>
      </motion.div>

      {/* Main Area Chart Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3 bg-card/80 border-border/70 shadow-lg relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary animate-spin" style={{ animationDuration: '6s' }} />
                <span>Real-Time Linux VPS Telemetry Stream</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Live CPU load & RAM allocation stream from active host agent</p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="font-mono text-[10px] gap-1.5 bg-primary/10 border-primary/30 text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Live WebSocket
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {telemetry.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
                  <Activity className="h-10 w-10 text-primary/60" />
                </motion.div>
                <p className="text-xs font-bold text-foreground">Listening for Live Linux VPS Telemetry Stream</p>
                <p className="text-[11px] text-muted-foreground max-w-sm leading-relaxed">
                  WebSocket telemetry socket is listening on <code className="text-primary font-mono font-bold">/ws</code>. Metrics will animate automatically.
                </p>
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetry}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '10px', fontSize: '12px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}
                    />
                    <Area type="monotone" dataKey="cpuPercent" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#cpuGrad)" name="CPU Load %" isAnimationActive />
                    <Area type="monotone" dataKey="ramPercent" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#ramGrad)" name="RAM Usage %" isAnimationActive />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
