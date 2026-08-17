import React, { useState, useEffect } from 'react';
import { Globe, Radio } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table';
import { apiClient } from '../../api/client';

interface NetworkInterface {
  name: string;
  mac: string;
  ipv4: string;
  type: string;
  rx: string;
  tx: string;
  status: string;
}

export function NetworkManagerPage() {
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<NetworkInterface[]>('/network/interfaces')
      .then((data) => setInterfaces(Array.isArray(data) ? data : []))
      .catch(() => setInterfaces([]))
      .finally(() => setLoading(false));
  }, []);

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
        {interfaces.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Network Interfaces Detected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Network interface data is reported by the VPSGUI agent. Connect your Linux VPS to view ethernet adapters, bridges, and bandwidth usage.
              </p>
            </div>
          </div>
        ) : (
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
        )}
      </Card>
    </div>
  );
}
