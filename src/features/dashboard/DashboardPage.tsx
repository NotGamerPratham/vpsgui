import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  Container,
  Terminal,
  FolderTree,
  ArrowRight,
  RefreshCw,
  Command,
  Copy,
  Check,
  AlertTriangle,
  Database,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useServerStore } from '../../store/useServerStore';
import { useUIStore } from '../../store/useUIStore';
import { globalEventBus } from '../../event-bus';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { TelemetryPoint } from '../../types/monitoring';
import { ContainerItem } from '../../types/docker';
import { dockerService } from '../../services/dockerService';
import { metricsService } from '../../services/metricsService';
import { getTelemetryHaltReason } from '../../services/telemetryPoller';
import { copyToClipboard } from '../../lib/clipboard';

interface ChartTelemetryPoint extends TelemetryPoint {
  timeLabel: string;
}

type SeriesFilter = 'all' | 'cpu' | 'ram';

function formatClockTime(raw: string): string {
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  return raw;
}

function formatBytesToGb(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatUptime(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatRateKbps(kbps?: number): string {
  if (typeof kbps !== 'number' || !Number.isFinite(kbps) || kbps < 0) return '—';
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(2)} MB/s`;
  return `${kbps.toFixed(1)} KB/s`;
}

function getMeterFillClass(percent: number | null): string {
  if (percent === null) return 'bg-muted-foreground/30';
  if (percent >= 90) return 'bg-rose-400';
  if (percent >= 75) return 'bg-amber-400';
  return 'bg-primary';
}

interface TelemetryTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    color?: string;
    payload?: ChartTelemetryPoint;
  }>;
  label?: string;
}

function TelemetryTooltip({ active, payload, label }: TelemetryTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-border bg-popover/95 px-3.5 py-2.5 text-xs font-mono shadow-xl backdrop-blur-md">
      <div className="mb-2 border-b border-border/70 pb-1.5 text-[11px] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || '#ECEBE6' }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-foreground">{entry.value ?? 0}%</span>
          </div>
        ))}
        {point && (typeof point.netRxKbps === 'number' || typeof point.netTxKbps === 'number') && (
          <div className="mt-1.5 flex items-center justify-between gap-5 border-t border-border/60 pt-1.5 text-[11px] text-muted-foreground">
            <span>Net I/O</span>
            <span className="text-foreground">
              {formatRateKbps(point.netRxKbps)} / {formatRateKbps(point.netTxKbps)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function CornerMarkers() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 top-2.5 h-[3px] w-[3px] rounded-full bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-2.5 h-[3px] w-[3px] rounded-full bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2.5 left-2.5 h-[3px] w-[3px] rounded-full bg-foreground/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2.5 right-2.5 h-[3px] w-[3px] rounded-full bg-foreground/20"
      />
    </>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { nodes, fetchNodesFromApi } = useServerStore();
  const { setCommandPaletteOpen } = useUIStore();

  const [telemetry, setTelemetry] = useState<ChartTelemetryPoint[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<TelemetryPoint | null>(null);
  const [telemetryHalted, setTelemetryHalted] = useState<string | null>(() => getTelemetryHaltReason());
  const [seriesFilter, setSeriesFilter] = useState<SeriesFilter>('all');

  const [containers, setContainers] = useState<ContainerItem[] | null>(null);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const [dockerLoading, setDockerLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const loadDocker = useCallback(async () => {
    setDockerLoading(true);
    const { containers: list, error } = await dockerService.fetchContainers();
    if (error) {
      setDockerError(error);
      setContainers(null);
    } else {
      setDockerError(null);
      setContainers(list);
    }
    setDockerLoading(false);
  }, []);

  const appendTelemetryPoint = useCallback((data: TelemetryPoint) => {
    setTelemetryHalted(null);
    setLatestTelemetry(data);
    setTelemetry((prev) => {
      const nextPoint: ChartTelemetryPoint = {
        ...data,
        timeLabel: formatClockTime(data.timestamp || new Date().toISOString()),
        cpuPercent: data.cpuPercent ?? 0,
        ramPercent: data.ramPercent ?? 0,
        swapPercent: data.swapPercent ?? 0,
        diskPercent: data.diskPercent ?? 0,
        netRxKbps: data.netRxKbps ?? 0,
        netTxKbps: data.netTxKbps ?? 0,
        iowaitPercent: data.iowaitPercent ?? 0,
      };
      return [...prev.slice(-29), nextPoint];
    });
  }, []);

  useEffect(() => {
    let active = true;
    dockerService.fetchContainers().then(({ containers: list, error }) => {
      if (!active) return;
      if (error) {
        setDockerError(error);
        setContainers(null);
      } else {
        setDockerError(null);
        setContainers(list);
      }
      setDockerLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    fetchNodesFromApi();

    const unsubTick = globalEventBus.on('telemetry_tick', (data: TelemetryPoint | undefined) => {
      if (!data) return;
      appendTelemetryPoint(data);
    });

    const unsubHalt = globalEventBus.on('telemetry_halted', (reason: string) => {
      setTelemetryHalted(reason || 'Telemetry polling halted due to agent authentication.');
    });

    return () => {
      unsubTick();
      unsubHalt();
    };
  }, [fetchNodesFromApi, appendTelemetryPoint]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [, , telemetryRes] = await Promise.all([
        fetchNodesFromApi(),
        loadDocker(),
        metricsService.fetchLiveTelemetryResult(),
      ]);
      if (telemetryRes.point) {
        appendTelemetryPoint(telemetryRes.point);
      } else if (telemetryRes.error?.kind === 'auth') {
        setTelemetryHalted(telemetryRes.error.message);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyInstallCmd = async () => {
    const cmd = 'sudo bash agent/install.sh';
    if ((await copyToClipboard(cmd)) === 'copied') {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  const hostNode = nodes[0];
  const isOnline = hostNode?.status === 'online' || telemetry.length > 0;

  const hostName = latestTelemetry?.hostname || hostNode?.name || 'Host not identified';
  const publicIp = hostNode?.network?.publicIp || '';
  const osName = latestTelemetry?.osName || hostNode?.os?.name || '';
  const osArch = latestTelemetry?.osArch || hostNode?.hardware?.architecture || '';
  const cpuModel = latestTelemetry?.cpuModel || hostNode?.hardware?.cpuModel || '';
  const totalCpuCores = latestTelemetry?.cpuCores ?? hostNode?.hardware?.cpuCores ?? 0;
  const totalRamGb =
    latestTelemetry?.memoryTotalBytes
      ? Number((latestTelemetry.memoryTotalBytes / 1024 ** 3).toFixed(1))
      : hostNode?.hardware?.ramGb ?? 0;
  const uptimeSeconds = latestTelemetry?.uptimeSeconds ?? hostNode?.os?.uptimeSeconds ?? 0;

  const currentCpu = latestTelemetry ? Math.round(latestTelemetry.cpuPercent) : null;
  const currentRam = latestTelemetry ? Math.round(latestTelemetry.ramPercent) : null;
  const currentDisk =
    latestTelemetry && typeof latestTelemetry.diskPercent === 'number'
      ? Math.round(latestTelemetry.diskPercent)
      : null;

  const peakCpu = useMemo(
    () => (telemetry.length > 0 ? Math.max(...telemetry.map((t) => Math.round(t.cpuPercent))) : null),
    [telemetry]
  );
  const peakRam = useMemo(
    () => (telemetry.length > 0 ? Math.max(...telemetry.map((t) => Math.round(t.ramPercent))) : null),
    [telemetry]
  );

  const runningContainers = containers ? containers.filter((c) => c.state === 'running').length : 0;
  const totalContainers = containers ? containers.length : 0;
  const containerRatio =
    containers && totalContainers > 0 ? Math.round((runningContainers / totalContainers) * 100) : null;

  const ramUsedStr = formatBytesToGb(latestTelemetry?.memoryUsedBytes);
  const ramTotalStr = formatBytesToGb(latestTelemetry?.memoryTotalBytes);
  const diskUsedStr = formatBytesToGb(latestTelemetry?.diskUsedBytes);
  const diskTotalStr = formatBytesToGb(latestTelemetry?.diskTotalBytes);

  const loadAvgFormatted =
    latestTelemetry?.loadAverage && latestTelemetry.loadAverage.length >= 3
      ? latestTelemetry.loadAverage
          .slice(0, 3)
          .map((n) => n.toFixed(2))
          .join(' / ')
      : null;

  const workspaceModules = [
    {
      title: 'Host Terminal',
      description: 'Execute shell commands directly via vpsgui-agent.',
      actionLabel: 'Open terminal',
      icon: Terminal,
      path: '/terminal',
      primary: true,
    },
    {
      title: 'File Explorer',
      description: 'Inspect, upload, and edit server directories.',
      actionLabel: 'Browse files',
      icon: FolderTree,
      path: '/files',
      primary: false,
    },
    {
      title: 'Docker Engine',
      description: 'Inspect running workloads, images, and logs.',
      actionLabel: 'Manage docker',
      icon: Container,
      path: '/docker/containers',
      primary: false,
    },
    {
      title: 'Live Monitoring',
      description: 'Process list, system load, and host diagnostics.',
      actionLabel: 'View telemetry',
      icon: Activity,
      path: '/monitoring',
      primary: false,
    },
  ];

  return (
    <div className="space-y-6 pb-6">
      {/* Header Bar */}
      <section className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-[11px] font-medium normal-case tracking-normal text-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isOnline ? 'bg-emerald-400' : 'bg-muted-foreground/50'
                }`}
              />
              {isOnline ? 'Agent Online' : 'Awaiting Agent'}
            </span>
            <span className="text-border">/</span>
            <span className="text-foreground/90 normal-case tracking-normal">{hostName}</span>
            {publicIp && publicIp !== hostName && (
              <>
                <span className="text-border">/</span>
                <span className="normal-case tracking-normal">{publicIp}</span>
              </>
            )}
            {osArch && (
              <>
                <span className="text-border">/</span>
                <span className="normal-case tracking-normal">{osArch}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[28px]">
            Infrastructure Overview
          </h1>

          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {osName
              ? `${osName} · Real-time compute, memory, storage, and container runtime telemetry.`
              : 'Real-time host compute, memory, storage, and Docker engine telemetry via vpsgui-agent.'}
          </p>
        </div>

        {/* Header CTA Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="default"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh host telemetry"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="default"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <Command className="h-3.5 w-3.5" />
            <span>Cmd+K</span>
          </Button>

          <Button
            variant="default"
            size="default"
            onClick={() => navigate('/terminal')}
          >
            <span>Open terminal</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </section>

      {/* Auth Halt Alert (shown only when polling stopped on real 401/403/429) */}
      {telemetryHalted && (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-foreground">Telemetry polling paused</p>
              <p className="text-xs text-muted-foreground">{telemetryHalted}</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/settings')} className="shrink-0">
            <span>Configure token</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* CPU Card */}
        <Card className="relative overflow-hidden p-5 hover:border-foreground/20">
          <CornerMarkers />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              CPU Load
            </span>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {currentCpu !== null ? `${currentCpu}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalCpuCores > 0 ? `${totalCpuCores} vCPU` : 'No cores reported'}
            </span>
          </div>

          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getMeterFillClass(currentCpu)}`}
              style={{ width: `${Math.min(currentCpu ?? 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{loadAvgFormatted ? `Load ${latestTelemetry?.loadAverage?.[0].toFixed(2)}` : 'Load —'}</span>
            <span>
              {typeof latestTelemetry?.tempC === 'number'
                ? `${latestTelemetry.tempC.toFixed(0)}°C`
                : peakCpu !== null
                  ? `Peak ${peakCpu}%`
                  : 'Awaiting sample'}
            </span>
          </div>
        </Card>

        {/* Memory Card */}
        <Card className="relative overflow-hidden p-5 hover:border-foreground/20">
          <CornerMarkers />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Memory
            </span>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {currentRam !== null ? `${currentRam}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {totalRamGb > 0 ? `${totalRamGb} GB RAM` : 'Unreported'}
            </span>
          </div>

          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getMeterFillClass(currentRam)}`}
              style={{ width: `${Math.min(currentRam ?? 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {ramUsedStr && ramTotalStr ? `${ramUsedStr} / ${ramTotalStr}` : 'Allocation —'}
            </span>
            <span>{peakRam !== null ? `Peak ${peakRam}%` : 'Awaiting sample'}</span>
          </div>
        </Card>

        {/* Disk / Storage Card */}
        <Card className="relative overflow-hidden p-5 hover:border-foreground/20">
          <CornerMarkers />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Root Storage
            </span>
            <Database className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {currentDisk !== null ? `${currentDisk}%` : '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {diskTotalStr || (hostNode?.hardware?.diskGb ? `${hostNode.hardware.diskGb} GB` : 'Unreported')}
            </span>
          </div>

          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all duration-300 ${getMeterFillClass(currentDisk)}`}
              style={{ width: `${Math.min(currentDisk ?? 0, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{diskUsedStr ? `${diskUsedStr} used` : 'Disk usage —'}</span>
            <span>
              {latestTelemetry && typeof latestTelemetry.swapPercent === 'number'
                ? `Swap ${Math.round(latestTelemetry.swapPercent)}%`
                : 'Swap —'}
            </span>
          </div>
        </Card>

        {/* Docker Runtime Card */}
        <Card className="relative overflow-hidden p-5 hover:border-foreground/20">
          <CornerMarkers />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Docker Runtime
            </span>
            <Container className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-foreground">
              {containers ? runningContainers : '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {containers ? `of ${totalContainers} total` : dockerLoading ? 'Querying' : 'Offline'}
            </span>
          </div>

          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${containerRatio ?? 0}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className={runningContainers > 0 ? 'text-emerald-400' : 'text-muted-foreground'}>
              {dockerError
                ? 'Docker unavailable'
                : dockerLoading
                  ? 'Querying daemon...'
                  : runningContainers > 0
                    ? 'Engine active'
                    : 'No running containers'}
            </span>
            <button
              onClick={() => navigate('/docker/containers')}
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground transition-colors"
            >
              <span>Inspect</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      </section>

      {/* Main Analytical Row: Live Telemetry Chart + Host Profile */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Telemetry Chart Card */}
        <Card className="relative overflow-hidden xl:col-span-2">
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <CardTitle className="text-sm font-semibold">Live Resource Telemetry</CardTitle>
                <Badge variant={telemetry.length > 0 ? 'success' : 'outline'} className="text-[10px]">
                  {telemetry.length > 0 ? 'LIVE · 3S' : 'STANDBY'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Polling <span className="text-foreground/80">/api/v1/system/telemetry</span>
              </p>
            </div>

            {/* Rounded-full segmented series filter */}
            <div className="inline-flex items-center rounded-full border border-border/80 bg-secondary/70 p-0.5 self-start sm:self-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'cpu', label: 'CPU' },
                  { id: 'ram', label: 'RAM' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSeriesFilter(tab.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                    seriesFilter === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {telemetry.length === 0 ? (
              <div className="relative flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/50 px-6 py-10 text-center">
                <CornerMarkers />
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  <Activity className="h-5 w-5" />
                </div>

                <h3 className="text-sm font-medium text-foreground">
                  Awaiting host telemetry stream
                </h3>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">
                  No metrics have been received from{' '}
                  <code className="text-foreground">/api/v1/system/telemetry</code> yet. Install the
                  host agent on your Linux VPS or verify your token under Settings.
                </p>

                <div className="mt-5 flex w-full max-w-sm items-center justify-between gap-2 rounded-full border border-border/80 bg-card/80 px-4 py-2 text-xs">
                  <code className="truncate text-foreground/90">sudo bash agent/install.sh</code>
                  <button
                    type="button"
                    onClick={handleCopyInstallCmd}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Copy install command"
                  >
                    {copiedCmd ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                  <Button size="default" onClick={() => navigate('/settings')}>
                    <span>Configure agent</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Button>
                  <Button variant="outline" size="default" onClick={() => navigate('/agent')}>
                    <span>Agent status</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Inline Live Legend Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/50 px-4 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-foreground" />
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-semibold text-foreground">{currentCpu ?? 0}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#6B859B]" />
                      <span className="text-muted-foreground">Memory</span>
                      <span className="font-semibold text-foreground">{currentRam ?? 0}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                    <span>RX {formatRateKbps(latestTelemetry?.netRxKbps)}</span>
                    <span>TX {formatRateKbps(latestTelemetry?.netTxKbps)}</span>
                  </div>
                </div>

                {/* Area Chart */}
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={telemetry} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="vpsCpuFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="vpsRamFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6B859B" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="#6B859B" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.6}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="timeLabel"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        unit="%"
                        domain={[0, 100]}
                      />
                      <Tooltip content={<TelemetryTooltip />} />
                      {(seriesFilter === 'all' || seriesFilter === 'cpu') && (
                        <Area
                          type="monotone"
                          dataKey="cpuPercent"
                          stroke="hsl(var(--foreground))"
                          strokeWidth={1.75}
                          fillOpacity={1}
                          fill="url(#vpsCpuFill)"
                          name="CPU Load"
                          isAnimationActive={false}
                        />
                      )}
                      {(seriesFilter === 'all' || seriesFilter === 'ram') && (
                        <Area
                          type="monotone"
                          dataKey="ramPercent"
                          stroke="#6B859B"
                          strokeWidth={1.75}
                          fillOpacity={1}
                          fill="url(#vpsRamFill)"
                          name="RAM Usage"
                          isAnimationActive={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Host Profile Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold">Host Profile</CardTitle>
                <p className="text-xs text-muted-foreground">Reported kernel &amp; hardware</p>
              </div>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent className="pt-4">
              <dl className="divide-y divide-border/60 text-xs">
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Hostname</dt>
                  <dd className="truncate font-medium text-foreground">{hostName}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Public IP</dt>
                  <dd className="truncate text-foreground">{publicIp || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">OS / Kernel</dt>
                  <dd className="truncate text-foreground" title={osName || undefined}>
                    {osName || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Processor</dt>
                  <dd className="truncate text-foreground" title={cpuModel || undefined}>
                    {cpuModel || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Load avg</dt>
                  <dd className="text-foreground">{loadAvgFormatted || '—'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Uptime</dt>
                  <dd className="text-foreground">{formatUptime(uptimeSeconds)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">Network I/O</dt>
                  <dd className="text-foreground">
                    {latestTelemetry
                      ? `${formatRateKbps(latestTelemetry.netRxKbps)} / ${formatRateKbps(latestTelemetry.netTxKbps)}`
                      : '—'}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </div>

          <div className="border-t border-border/70 p-5 pt-4">
            <Button
              variant="outline"
              size="default"
              onClick={() => navigate('/servers')}
              className="w-full justify-between"
            >
              <span>Inspect host node</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Button>
          </div>
        </Card>
      </section>

      {/* Bottom Row: Operations Workspace + Active Containers */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Operations Launchpad */}
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle className="text-sm font-semibold">Workspace Operations</CardTitle>
            <p className="text-xs text-muted-foreground">
              Direct entry points to core host administration tools
            </p>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {workspaceModules.map((mod) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={mod.path}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-border/80 bg-background/55 p-4 transition-colors hover:border-foreground/20"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-foreground">{mod.title}</h4>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {mod.description}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Button
                        variant={mod.primary ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => navigate(mod.path)}
                      >
                        <span>{mod.actionLabel}</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Docker Containers Snapshot */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/70 pb-4">
              <div className="space-y-1">
                <CardTitle className="text-sm font-semibold">Containers</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {containers
                    ? `${runningContainers} running · ${totalContainers} total`
                    : 'Host Docker daemon'}
                </p>
              </div>
              <Container className="h-4 w-4 text-muted-foreground" />
            </CardHeader>

            <CardContent className="pt-4">
              {dockerLoading ? (
                <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
                  Querying Docker daemon...
                </div>
              ) : dockerError ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 px-4 text-center">
                  <p className="text-xs font-medium text-foreground">Docker socket unavailable</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {dockerError}
                  </p>
                </div>
              ) : !containers || containers.length === 0 ? (
                <div className="flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 px-4 text-center">
                  <p className="text-xs font-medium text-foreground">No containers detected</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Containers running on this host will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {containers.slice(0, 4).map((c) => {
                    const running = c.state === 'running';
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                running ? 'bg-emerald-400' : 'bg-muted-foreground/50'
                              }`}
                            />
                            <span className="truncate text-xs font-medium text-foreground">
                              {c.name}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate pl-3.5 text-[11px] text-muted-foreground">
                            {c.image}
                          </p>
                        </div>
                        <Badge variant={running ? 'success' : 'outline'} className="shrink-0 text-[10px]">
                          {c.state}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </div>

          <div className="border-t border-border/70 p-5 pt-4">
            <Button
              variant="default"
              size="default"
              onClick={() => navigate('/docker/containers')}
              className="w-full justify-between"
            >
              <span>All containers</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
