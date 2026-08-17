import React, { useState, useEffect } from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, RotateCw, Activity } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { apiClient } from '../../api/client';
import { HealthStatusMatrix } from '../../types/monitoring';

export function HealthMatrixPage() {
  const [healthMatrix, setHealthMatrix] = useState<HealthStatusMatrix[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<HealthStatusMatrix[]>('/health/matrix');
      setHealthMatrix(Array.isArray(data) ? data : []);
    } catch (e) {
      setHealthMatrix([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            <span>Infrastructure Health Matrix</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Single-pane traffic-light status monitor for all nodes, services, databases, SSL certificates, and backup jobs.
          </p>
        </div>

        <Button size="sm" variant="outline" onClick={fetchHealth} className="gap-1.5 text-xs">
          <RotateCw className="h-3.5 w-3.5" />
          <span>Refresh Health Checks</span>
        </Button>
      </div>

      {healthMatrix.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Health Check Data Available</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Health matrix data is reported by the VPSGUI agent running on your Linux VPS. Connect your server to see live health status.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {healthMatrix.map((item) => (
            <Card key={item.id} className="bg-card/70 border-border/70 p-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {item.category}
                  </Badge>
                  {item.status === 'green' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : item.status === 'red' ? (
                    <XCircle className="h-5 w-5 text-rose-400" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{item.target}</p>
                </div>

                <p className="text-xs text-muted-foreground/90 bg-muted/30 p-2 rounded border border-border/40">
                  {item.message}
                </p>
              </div>

              <div className="border-t border-border/40 pt-3 mt-3 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Check: {item.lastCheck}</span>
                <span>{item.latencyMs} ms</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
