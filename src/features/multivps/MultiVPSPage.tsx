import React, { useState } from 'react';
import { Grid2X2, Server, Cpu, HardDrive, Zap, RotateCw, Terminal, CheckCircle2, Play } from 'lucide-react';
import { useServerStore } from '../../store/useServerStore';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';

export function MultiVPSPage() {
  const { nodes } = useServerStore();
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(nodes.slice(0, 4).map((n) => n.id));
  const [batchCommand, setBatchCommand] = useState('apt update && apt upgrade -y');
  const [executionLog, setExecutionLog] = useState<string | null>(null);

  const activeNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));

  const runBatchCommand = () => {
    setExecutionLog(`Executing batch command: "${batchCommand}" across ${activeNodes.length} active nodes...\n`);
    setTimeout(() => {
      setExecutionLog(
        (prev) =>
          prev +
          `[SUCCESS] vps-us-east-prod-01: OK (exit code 0)\n[SUCCESS] vps-eu-central-db-01: OK (exit code 0)\n[SUCCESS] docker-host-edge-01: OK (exit code 0)\nDone! Batch execution completed in 1.4s.`
      );
    }, 1200);
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

          <Button size="sm" onClick={runBatchCommand} className="gap-1.5 text-xs bg-primary shrink-0">
            <Play className="h-3.5 w-3.5" />
            <span>Run on {activeNodes.length} Nodes</span>
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
        {activeNodes.map((node, index) => (
          <Card key={node.id} className="bg-card/70 border-border/70 flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono text-[10px]">
                  PANEL #{index + 1}
                </Badge>
                <Badge variant="success" className="text-[9px] px-1.5 py-0">
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
                  <span className="font-mono text-foreground font-semibold">28.4%</span>
                </div>
                <Progress value={28.4} indicatorClassName="bg-primary" />
              </div>

              {/* RAM Meter */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <HardDrive className="h-3 w-3 text-violet-400" /> Memory
                  </span>
                  <span className="font-mono text-foreground font-semibold">14.2 / {node.hardware.ramGb} GB</span>
                </div>
                <Progress value={44.3} indicatorClassName="bg-violet-500" />
              </div>

              {/* Network Throughput */}
              <div className="flex items-center justify-between text-[11px] bg-muted/30 p-2 rounded border border-border/40 font-mono">
                <span className="text-muted-foreground">Network I/O</span>
                <span className="text-emerald-400">RX 420 KB/s | TX 1.2 MB/s</span>
              </div>
            </CardContent>

            <div className="border-t border-border/60 bg-muted/20 px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-mono">{node.os.family}</span>
              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-primary">
                SSH Terminal →
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
