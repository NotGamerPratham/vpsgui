import React from 'react';
import { HeartPulse, CheckCircle2, AlertTriangle, XCircle, RotateCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { mockHealthMatrix } from '../../mocks/mockData';

export function HealthMatrixPage() {
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockHealthMatrix.map((item) => (
          <Card key={item.id} className="bg-card/70 border-border/70 p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {item.category}
                </Badge>
                {item.status === 'green' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
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
    </div>
  );
}
