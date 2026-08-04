import React, { useState, useEffect } from 'react';
import { Network, Globe, Shield, Server, Container, Database, CheckCircle2, AlertTriangle, ArrowDown } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../api/client';
import { useServerStore } from '../../store/useServerStore';

interface TopologyNode {
  id: string;
  title: string;
  type: string;
  status: string;
  desc: string;
}

interface TopologyLayer {
  level: string;
  items: TopologyNode[];
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  cloud: Globe,
  lb: Shield,
  vps: Server,
  docker: Container,
  db: Database,
};

export function InfrastructureMapPage() {
  const { nodes } = useServerStore();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [topology, setTopology] = useState<TopologyLayer[]>([]);
  const [nodeDetails, setNodeDetails] = useState<any>(null);

  useEffect(() => {
    apiClient.get<TopologyLayer[]>('/topology')
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTopology(data);
          setSelectedNode(data[0]?.items[0]?.id || null);
        }
      })
      .catch(() => {
        // Build topology from connected nodes
        if (nodes.length > 0) {
          const computeLayer: TopologyLayer = {
            level: 'Compute Nodes (VPS)',
            items: nodes.map((n) => ({
              id: n.id,
              title: n.name,
              type: 'vps',
              status: n.status,
              desc: `${n.network.publicIp} (${n.os.name})`,
            })),
          };
          setTopology([computeLayer]);
          setSelectedNode(nodes[0]?.id || null);
        }
      });
  }, [nodes]);

  // Fetch selected node details
  useEffect(() => {
    if (!selectedNode) return;
    apiClient.get(`/topology/node/${selectedNode}`)
      .then(setNodeDetails)
      .catch(() => {
        const matchedNode = nodes.find((n) => n.id === selectedNode);
        if (matchedNode) {
          setNodeDetails({
            routing: matchedNode.status === 'online' ? 'Active 100%' : 'Degraded',
            latency: '--',
            throughput: '--',
            security: 'Agent Reported',
          });
        } else {
          setNodeDetails(null);
        }
      });
  }, [selectedNode, nodes]);

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

      {topology.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Infrastructure Topology Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                The topology map is generated from connected VPS nodes. Connect a Linux VPS with the VPSGUI agent to visualize your infrastructure.
              </p>
            </div>
          </div>
        </Card>
      ) : (
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
                      const Icon = iconMap[item.type] || Server;
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
                              <Badge variant={item.status === 'online' ? 'success' : 'outline'} className="text-[9px] px-1 py-0 font-mono">
                                {item.status === 'online' ? 'HEALTHY' : item.status.toUpperCase()}
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
                    <CheckCircle2 className="h-3.5 w-3.5" /> {nodeDetails?.routing || 'Awaiting Agent'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-mono text-foreground">{nodeDetails?.latency || '--'}</span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="text-muted-foreground">Network Throughput</span>
                  <span className="font-mono text-foreground">{nodeDetails?.throughput || '--'}</span>
                </div>
                <div className="flex justify-between border-b border-border/40 py-1.5">
                  <span className="text-muted-foreground">Security Inspection</span>
                  <span className="text-emerald-400 font-mono">{nodeDetails?.security || '--'}</span>
                </div>
              </div>
            </CardContent>

            <Button className="w-full text-xs bg-primary">Open Full Diagnostics</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
