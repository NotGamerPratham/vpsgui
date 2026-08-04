import React, { useState } from 'react';
import { Network, Globe, Shield, Server, Container, Database, CheckCircle2, AlertTriangle, ArrowDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';

export function InfrastructureMapPage() {
  const [selectedNode, setSelectedNode] = useState<string | null>('vps-us-east-prod-01');

  const topology = [
    {
      level: 'Edge & Ingress',
      items: [
        { id: 'internet', title: 'Global Public Internet', type: 'cloud', icon: Globe, status: 'online', desc: 'Anycast DNS & Cloudflare Edge' },
        { id: 'lb-01', title: 'Nginx Load Balancer', type: 'lb', icon: Shield, status: 'online', desc: 'Port 80/443 SSL Termination' },
      ],
    },
    {
      level: 'Compute Nodes (VPS)',
      items: [
        { id: 'vps-us-east-prod-01', title: 'vps-us-east-prod-01', type: 'vps', icon: Server, status: 'online', desc: '135.181.42.89 (Primary Web)' },
        { id: 'vps-eu-central-db-01', title: 'vps-eu-central-db-01', type: 'vps', icon: Server, status: 'online', desc: '18.198.24.112 (Database Cluster)' },
      ],
    },
    {
      level: 'Docker & Database Engines',
      items: [
        { id: 'docker-engine-01', title: 'Docker Engine v26.1', type: 'docker', icon: Container, status: 'online', desc: '8 Active Containers' },
        { id: 'postgres-cluster', title: 'PostgreSQL 16 Cluster', type: 'db', icon: Database, status: 'online', desc: 'Port 5432 Internal VPC' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <span>Interactive Infrastructure Topology Map</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visual topology map illustrating connection paths, load balancer routes, VPS compute nodes, and database clusters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Map Canvas */}
        <Card className="lg:col-span-2 bg-card/70 border-border/70 p-6 flex flex-col items-center justify-center min-h-[500px]">
          <div className="w-full max-w-xl space-y-8">
            {topology.map((layer, lIndex) => (
              <div key={layer.level} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>{layer.level}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {layer.items.map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedNode === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSelectedNode(item.id)}
                        className={`flex items-start space-x-3 rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/5'
                            : 'border-border/70 bg-card hover:border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="rounded-lg bg-muted p-2.5 border border-border/60 text-primary shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-foreground">{item.title}</h4>
                            <Badge variant="success" className="text-[9px] px-1 py-0 font-mono">
                              HEALTHY
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 font-mono">{item.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {lIndex < topology.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="h-4 w-4 text-primary/60 animate-bounce" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Node Inspector Drawer */}
        <Card className="bg-card/70 border-border/70 p-6 flex flex-col justify-between">
          <CardHeader className="p-0 pb-4 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Topology Node Details</span>
              <Badge variant="outline" className="font-mono text-[10px]">
                SELECTED
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 py-4 space-y-4 flex-1">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Node Identifier</span>
              <h3 className="font-bold text-base text-foreground font-mono">{selectedNode || 'Select a node'}</h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Traffic Routing Status</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Active 100%
                </span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Latency</span>
                <span className="font-mono text-foreground">12 ms</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Network Throughput</span>
                <span className="font-mono text-foreground">1.4 GB/s</span>
              </div>
              <div className="flex justify-between border-b border-border/40 py-1.5">
                <span className="text-muted-foreground">Security Inspection</span>
                <span className="text-emerald-400 font-mono">UFW Active</span>
              </div>
            </div>
          </CardContent>

          <Button className="w-full text-xs bg-primary">Open Full Diagnostics</Button>
        </Card>
      </div>
    </div>
  );
}
