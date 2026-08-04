import React from 'react';
import { Globe, Radio, ShieldCheck, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';

export function NetworkManagerPage() {
  const interfaces = [
    { name: 'eth0', mac: '52:54:00:12:34:56', ipv4: '135.181.42.89', type: 'ethernet', rx: '420 GB', tx: '1.2 TB', status: 'up' },
    { name: 'docker0', mac: '02:42:1a:8b:2d:01', ipv4: '172.17.0.1', type: 'virtual', rx: '85 GB', tx: '140 GB', status: 'up' },
    { name: 'lo', mac: '00:00:00:00:00:00', ipv4: '127.0.0.1', type: 'loopback', rx: '12 GB', tx: '12 GB', status: 'up' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <span>Network Interfaces & Bandwidth</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor ethernet adapters, virtual bridge interfaces, routing tables, and DNS resolvers.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Interface</TableHead>
              <TableHead className="text-xs">IPv4 Address</TableHead>
              <TableHead className="text-xs">MAC Address</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Traffic (RX / TX)</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {interfaces.map((iface) => (
              <TableRow key={iface.name}>
                <TableCell className="font-bold text-xs font-mono text-foreground flex items-center gap-2">
                  <Radio className="h-3.5 w-3.5 text-primary" />
                  <span>{iface.name}</span>
                </TableCell>
                <TableCell className="font-mono text-xs text-primary">{iface.ipv4}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{iface.mac}</TableCell>
                <TableCell className="text-xs text-muted-foreground uppercase">{iface.type}</TableCell>
                <TableCell className="font-mono text-xs text-emerald-400">{iface.rx} / {iface.tx}</TableCell>
                <TableCell>
                  <Badge variant="success" className="text-[10px] px-2 py-0.5 uppercase font-mono">
                    {iface.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
