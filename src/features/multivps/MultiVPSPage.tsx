import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid2X2, Server, Cpu, HardDrive, Terminal, Play } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { globalEventBus } from '../../event-bus';
import { apiClient, ApiError } from '../../api/client';
import { TelemetryPoint } from '../../types/monitoring';

export function MultiVPSPage() {
  const navigate = useNavigate();
  const { nodes } = useServerStore();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [batchCommand, setBatchCommand] = useState('systemctl status nginx');
  const [executionLog, setExecutionLog] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState<Record<string, TelemetryPoint>>({});

  useEffect(() => {
    // Seed the selection once. The `length === 0` guard means re-running on selection changes
    // cannot loop, so the dependency is safe to declare honestly.
    if (nodes.length > 0 && selectedNodeIds.length === 0) {
      setSelectedNodeIds(nodes.slice(0, 4).map((n) => n.id));
    }
  }, [nodes, selectedNodeIds.length]);

  useEffect(() => {
    const unsubscribe = globalEventBus.on('telemetry_tick', (data: any) => {
      if (!data) return;
      setLiveTelemetry((prev) => ({
        ...prev,
        [data.nodeId || 'default']: {
          timestamp: data.timestamp,
          cpuPercent: data.cpuPercent,
          ramPercent: data.ramPercent,
          swapPercent: 0,
          diskPercent: 0,
          netRxKbps: data.netRxKbps,
          netTxKbps: data.netTxKbps,
          iowaitPercent: 0,
        },
      }));
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const activeNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));

  const runBatchCommand = async () => {
    const command = batchCommand.trim();
    if (activeNodes.length === 0 || !command || isRunning) return;

    setIsRunning(true);
    setExecutionLog(`[EXEC] Running "${command}" on ${activeNodes.length} node(s)...\n`);

    // Fan out over the agent's real /terminal/exec endpoint. The previous implementation POSTed to
    // /nodes/batch-exec, which the agent has never implemented: every call 404'd and the catch
    // branch printed "Command dispatched to vpsgui-agent", so nothing ever ran but the log implied
    // it had.
    const results = await Promise.all(
      activeNodes.map(async (node) => {
        try {
          const res = await apiClient.post<{ success: boolean; output: string }>(
            '/terminal/exec',
            { command },
            30000
          );
          const status = res?.success ? 'OK' : 'FAILED';
          return `[${node.name} - ${status}]\n${res?.output?.trim() || '(no output)'}`;
        } catch (e) {
          const message =
            e instanceof ApiError && e.status === 401
              ? 'Unauthorized - set a valid Agent Token under Settings.'
              : e instanceof Error
                ? e.message
                : 'agent unreachable';
          return `[${node.name} - ERROR]\n${message}`;
        }
      })
    );

    setExecutionLog((prev) => `${prev || ''}\n${results.join('\n\n')}`);
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Grid2X2 className="h-5 w-5 text-primary" />
            <span>Multi-VPS Side-by-Side Matrix</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare CPU, RAM, Network throughput, and execute batch operations across multiple VPS instances simultaneously.
          </p>
        </div>
      </div>

      {nodes.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Grid2X2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Connected VPS Nodes Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Connect your Linux VPS server running the vpsgui-agent to view live side-by-side hardware telemetry matrices.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Batch Execution Bar */}
          <Card className="bg-card/70 border-border/70 p-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-foreground shrink-0">
                <Terminal className="h-4 w-4 text-primary" />
                <span>Batch Execution:</span>
              </div>

              <input
                type="text"
                value={batchCommand}
                onChange={(e) => setBatchCommand(e.target.value)}
                placeholder="e.g. systemctl restart nginx"
                className="flex-1 rounded-md border border-input bg-muted/40 px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />

              <Button
                size="sm"
                onClick={runBatchCommand}
                disabled={isRunning || activeNodes.length === 0 || !batchCommand.trim()}
                className="gap-1.5 text-xs bg-primary shrink-0 font-bold"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{isRunning ? 'Running...' : `Run on ${activeNodes.length} Node${activeNodes.length === 1 ? '' : 's'}`}</span>
              </Button>
            </div>

            {executionLog && (
              <div className="mt-3 rounded-lg border border-border bg-slate-950 p-3 font-mono text-[11px] text-emerald-400 whitespace-pre-wrap">
                {executionLog}
              </div>
            )}
          </Card>

          {/* Side-by-Side Matrix Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeNodes.map((node, index) => {
              const nodeTelemetry = liveTelemetry[node.id] || liveTelemetry['default'];
              const cpuPercent = nodeTelemetry ? nodeTelemetry.cpuPercent : 0;
              const ramPercent = nodeTelemetry ? nodeTelemetry.ramPercent : 0;
              const rxKb = nodeTelemetry ? nodeTelemetry.netRxKbps : 0;
              const txKb = nodeTelemetry ? nodeTelemetry.netTxKbps : 0;

              return (
                <Card key={node.id} className="bg-card/70 border-border/70 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        PANEL #{index + 1}
                      </Badge>
                      <Badge variant={node.status === 'online' ? 'success' : 'outline'} className="text-[9px] px-1.5 py-0 font-mono">
                        {node.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center space-x-2.5 mt-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 border border-primary/20 text-primary">
                        <Server className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-xs text-foreground truncate">{node.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{node.network.publicIp}</p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* CPU Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Cpu className="h-3 w-3 text-primary" /> CPU Load
                        </span>
                        <span className="font-mono text-foreground font-semibold">
                          {nodeTelemetry ? `${cpuPercent}%` : '--'}
                        </span>
                      </div>
                      <Progress value={cpuPercent} indicatorClassName="bg-primary" />
                    </div>

                    {/* RAM Meter */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <HardDrive className="h-3 w-3 text-violet-400" /> Memory
                        </span>
                        <span className="font-mono text-foreground font-semibold">
                          {nodeTelemetry ? `${ramPercent}% (${node.hardware.ramGb} GB)` : node.hardware.ramGb > 0 ? `${node.hardware.ramGb} GB Allocated` : '--'}
                        </span>
                      </div>
                      <Progress value={ramPercent} indicatorClassName="bg-violet-500" />
                    </div>

                    {/* Network Throughput */}
                    <div className="flex items-center justify-between text-[11px] bg-muted/30 p-2 rounded border border-border/40 font-mono">
                      <span className="text-muted-foreground">Network I/O</span>
                      <span className="text-emerald-400">
                        {nodeTelemetry ? `RX ${rxKb} KB/s | TX ${txKb} KB/s` : 'Awaiting Telemetry'}
                      </span>
                    </div>
                  </CardContent>

                  <div className="border-t border-border/60 bg-muted/20 px-3 py-2 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground font-mono">{node.os.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => navigate('/terminal')} className="h-6 text-[10px] text-primary">
                      SSH Terminal →
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
