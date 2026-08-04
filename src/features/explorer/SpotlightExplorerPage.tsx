import React, { useState } from 'react';
import { Search, Server, Container, FolderTree, Database, Key, Box } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export function SpotlightExplorerPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <span>Spotlight Infrastructure Resource Explorer</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Unified index searching across all registered compute nodes, docker containers, volumes, database schemas, and config files.
          </p>
        </div>
      </div>

      <Card className="bg-card/70 border-border/70 p-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-5 w-5 text-primary" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type anything to search nodes, containers, IP addresses, files, or settings..."
            className="pl-11 h-11 text-sm bg-card"
            autoFocus
          />
        </div>

        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Indexed Categories</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { title: '4 Nodes', icon: Server, color: 'text-primary' },
              { title: '8 Containers', icon: Container, color: 'text-cyan-400' },
              { title: '40+ Files', icon: FolderTree, color: 'text-amber-400' },
              { title: '2 Databases', icon: Database, color: 'text-violet-400' },
            ].map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.title} className="flex items-center space-x-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <Icon className={`h-5 w-5 ${cat.color}`} />
                  <span className="text-xs font-bold text-foreground">{cat.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
