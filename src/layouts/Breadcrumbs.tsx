import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home, Server, Copy, Check } from 'lucide-react';
import { useServerStore } from '../store/useServerStore';
import { Badge } from '../components/ui/badge';

export function Breadcrumbs() {
  const location = useLocation();
  const { nodes, selectedNodeId } = useServerStore();
  const [copied, setCopied] = React.useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];
  const pathNames = location.pathname.split('/').filter((x) => x);

  const copySshCommand = () => {
    if (selectedNode && selectedNode.network) {
      navigator.clipboard.writeText(`ssh root@${selectedNode.network.publicIp || '127.0.0.1'} -p ${selectedNode.network.sshPort || 22}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center justify-between border-b border-border/40 bg-card/20 px-6 py-2 text-xs">
      {/* Breadcrumb Path */}
      <div className="flex items-center space-x-2 overflow-x-auto">
        <Link to="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground">
          <Home className="h-3.5 w-3.5" />
        </Link>

        {pathNames.map((value, index) => {
          const to = `/${pathNames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathNames.length - 1;
          const formattedValue = value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');

          return (
            <React.Fragment key={to}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              {isLast ? (
                <span className="font-semibold text-foreground">{formattedValue}</span>
              ) : (
                <Link to={to} className="text-muted-foreground hover:text-foreground">
                  {formattedValue}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Node Context Quick Actions */}
      {selectedNode && selectedNode.network && (
        <div className="hidden sm:flex items-center space-x-3 text-[11px] text-muted-foreground">
          <div className="flex items-center space-x-1.5 bg-muted/40 rounded px-2 py-0.5 font-mono border border-border/40">
            <Server className="h-3 w-3 text-primary" />
            <span className="text-foreground font-medium">{selectedNode.name}</span>
            <span className="text-muted-foreground">({selectedNode.network.publicIp})</span>
          </div>

          <button
            onClick={copySshCommand}
            className="flex items-center space-x-1 text-muted-foreground hover:text-primary transition-colors bg-muted/30 px-2 py-0.5 rounded border border-border/40"
            title="Copy SSH Connection string"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="font-mono">{copied ? 'Copied SSH' : 'Copy SSH'}</span>
          </button>

          <Badge variant="outline" className="font-mono text-[10px]">
            {selectedNode.hardware.cpuCores} vCPU / {selectedNode.hardware.ramGb}GB RAM
          </Badge>
        </div>
      )}
    </div>
  );
}
