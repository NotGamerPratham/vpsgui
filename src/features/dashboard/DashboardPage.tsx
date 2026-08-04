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
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useServerStore } from '../../store/useServerStore';
import { useUIStore } from '../../store/useUIStore';
import { telemetrySocket } from '../../websocket/socket';
import { globalEventBus } from '../../event-bus';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { TelemetryPoint } from '../../types/monitoring';

export function DashboardPage() {
  const { nodes } = useServerStore();
  const { setQuickLauncherOpen, setCommandPaletteOpen } = useUIStore();

  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [copied, setCopied] = useState(false);
  const installScript = `curl -sSL https://get.vpsgui.dev/agent.sh | sudo bash`;

  useEffect(() => {
    telemetrySocket.connect();

    const unsubscribe = globalEventBus.on('telemetry_tick', (data: any) => {
      if (!data) return;
      setTelemetry((prev) => {
        const nextPoint: TelemetryPoint = {
          timestamp: data.timestamp,
          cpuPercent: data.cpuPercent,
          ramPercent: data.ramPercent,
          swapPercent: 0,
          diskPercent: 0,
          netRxKbps: data.netRxKbps,
          netTxKbps: data.netTxKbps,
          iowaitPercent: 0,
          tempC: data.tempC,
        };
        return [...prev.slice(-20), nextPoint];
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

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Infrastructure Overview</h1>
            <Badge variant={onlineNodes > 0 ? 'success' : 'outline'} className="font-mono text-[10px]">
              {onlineNodes}/{nodes.length} Linux Nodes Connected
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime telemetry stream for Linux VPS nodes, Docker engines, and container services.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setCommandPaletteOpen(true)} className="gap-1.5 text-xs">
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cmd+K Explorer</span>
          </Button>

          <Button size="sm" onClick={() => setQuickLauncherOpen(true)} className="gap-1.5 text-xs bg-primary">
            <Plus className="h-3.5 w-3.5" />
            <span>Connect Linux VPS</span>
          </Button>
        </div>
      </div>

      {/* Unattached Onboarding Hero Banner */}
      {nodes.length === 0 && (
        <Card className="bg-card/90 border-primary/40 p-6 space-y-4 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-primary font-bold text-sm">
                <AlertCircle className="h-5 w-5" />
                <span>Connect Your Linux VPS Server</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                VPSGUI requires a live deployed Linux VPS server running the lightweight <span className="font-mono text-primary font-bold">vpsgui-agent</span>. Run this 1-line installation script on your Linux VPS terminal to stream real-time metrics.
              </p>
            </div>

            <Button onClick={copyScript} className="gap-1.5 text-xs bg-primary shrink-0 font-bold">
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Copied Command' : 'Copy Linux Agent Script'}</span>
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 flex items-center justify-between">
            <code>{installScript}</code>
          </div>
        </Card>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/70 border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Linux Nodes</p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">{onlineNodes} <span className="text-xs font-normal text-muted-foreground">/ {nodes.length}</span></h3>
              <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                {onlineNodes > 0 ? '100% Agent Heartbeat' : 'No Linux VPS Connected'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 hover:border-cyan-500/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total vCPU Cores</p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">{totalCpuCores} <span className="text-xs font-normal text-muted-foreground">Cores</span></h3>
              <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                {nodes.length > 0 ? 'Live Telemetry Active' : '0 Cores Allocated'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Cpu className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 hover:border-violet-500/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cluster Memory</p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">{totalRamGb} <span className="text-xs font-normal text-muted-foreground">GB RAM</span></h3>
              <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                {nodes.length > 0 ? 'Live Memory Stream' : '0 GB Allocated'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
              <HardDrive className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border/70 hover:border-emerald-500/40 transition-colors">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Docker Containers</p>
              <h3 className="text-2xl font-extrabold text-foreground mt-1">0 <span className="text-xs font-normal text-muted-foreground">Active</span></h3>
              <p className="text-[11px] text-muted-foreground flex items-center mt-1">
                Awaiting VPS Agent
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Container className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Telemetry Area Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-3 bg-card/70 border-border/70">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span>Real-Time Linux VPS Telemetry Stream</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">Live metrics received directly from active Linux VPS socket</p>
            </div>
            <Badge variant="outline" className="font-mono text-[10px]">
              Socket Stream
            </Badge>
          </CardHeader>
          <CardContent>
            {telemetry.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center space-y-2">
                <Activity className="h-8 w-8 text-muted-foreground animate-pulse" />
                <p className="text-xs font-semibold text-foreground">Waiting for Live Linux VPS Telemetry Stream</p>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  Metrics will render automatically as soon as a live Linux VPS agent connects to the WebSocket stream.
                </p>
              </div>
            ) : (
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetry}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} unit="%" domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="cpuPercent" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" name="CPU Load %" />
                    <Area type="monotone" dataKey="ramPercent" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#ramGrad)" name="RAM Usage %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
