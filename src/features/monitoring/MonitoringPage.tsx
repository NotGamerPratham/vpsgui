import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Zap, Thermometer, ShieldCheck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { metricsService } from '../../services/metricsService';
import { TelemetryPoint, ProcessItem } from '../../types/monitoring';

export function MonitoringPage() {
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);

  useEffect(() => {
    metricsService.fetchProcesses().then(setProcesses);
    metricsService.fetchLiveTelemetry().then(setTelemetry);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span>Deep Telemetry & Process Tree (Linux VPS Stream)</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Realtime hardware monitoring for Linux VPS CPU, Memory, GPU temp, Disk I/O, and top resource-consuming processes.
          </p>
        </div>
      </div>

      {/* Recharts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network Throughput Area Chart */}
        <Card className="bg-card/70 border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span>Network I/O Throughput (KB/s)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 pt-2">
            {telemetry.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-4 text-xs text-muted-foreground">
                No network telemetry stream active. Connect your Linux VPS agent.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry}>
                  <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} />
                  <YAxis stroke="#64748B" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155' }} />
                  <Area type="monotone" dataKey="netRxKbps" stroke="#10B981" fill="#10B981" fillOpacity={0.2} name="Receive (RX)" />
                  <Area type="monotone" dataKey="netTxKbps" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.2} name="Transmit (TX)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Temperature & Power */}
        <Card className="bg-card/70 border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-rose-400" />
              <span>Hardware Temperature (°C) & Power (W)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56 pt-2">
            {telemetry.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-4 text-xs text-muted-foreground">
                No hardware sensor telemetry active. Connect your Linux VPS agent.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry}>
                  <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} />
                  <YAxis stroke="#64748B" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155' }} />
                  <Area type="monotone" dataKey="tempC" stroke="#F43F5E" fill="#F43F5E" fillOpacity={0.2} name="Temp °C" />
                  <Area type="monotone" dataKey="powerWatts" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} name="Power Watts" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Processes Table */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Top Resource Processes (Linux VPS ps)</CardTitle>
        </CardHeader>
        <CardContent>
          {processes.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No active Linux VPS process list received. Connect your Linux VPS server.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">PID</TableHead>
                  <TableHead className="text-xs">User</TableHead>
                  <TableHead className="text-xs">CPU %</TableHead>
                  <TableHead className="text-xs">RAM %</TableHead>
                  <TableHead className="text-xs">Memory (MB)</TableHead>
                  <TableHead className="text-xs">Command</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {processes.map((proc) => (
                  <TableRow key={proc.pid}>
                    <TableCell className="font-mono text-xs text-foreground">{proc.pid}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{proc.user}</TableCell>
                    <TableCell className="font-mono text-xs text-primary font-bold">{proc.cpuPercent}%</TableCell>
                    <TableCell className="font-mono text-xs text-violet-400">{proc.memoryPercent}%</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{proc.memoryMb} MB</TableCell>
                    <TableCell className="font-mono text-xs text-foreground">{proc.command}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
