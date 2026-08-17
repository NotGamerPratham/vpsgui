import React, { useState, useEffect } from 'react';
import { Database, Plus } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../api/client';

interface DatabaseInstance {
  name: string;
  engine: string;
  size: string;
  tables?: number;
  keys?: number;
  status: string;
}

export function DatabasesPage() {
  const [dbs, setDbs] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<DatabaseInstance[]>('/databases')
      .then((data) => setDbs(Array.isArray(data) ? data : []))
      .catch(() => setDbs([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <span>Managed Database Engine Clusters</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            PostgreSQL, MySQL, and Redis database management, connection string generators, and live query execution.
          </p>
        </div>

        <Button className="gap-1.5 text-xs bg-primary">
          <Plus className="h-4 w-4" />
          <span>Create Database</span>
        </Button>
      </div>

      {dbs.length === 0 ? (
        <Card className="bg-card/70 border-border/70 p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border/60">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">No Database Instances Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Database instances running on your VPS will be detected by the VPSGUI agent. Install PostgreSQL, MySQL, or Redis to get started.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {dbs.map((db) => (
            <Card key={db.name} className="bg-card/70 border-border/70 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm font-mono text-foreground">{db.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{db.engine}</p>
                </div>
                <Badge variant="success" className="text-[10px] uppercase font-mono">{db.status}</Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono bg-muted/30 p-2.5 rounded border border-border/40">
                <span>Size: {db.size}</span>
                <span>{db.tables ? `${db.tables} Tables` : db.keys ? `${db.keys} Active Keys` : '--'}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
