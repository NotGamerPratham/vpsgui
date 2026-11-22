import React from 'react';
import { copyToClipboard } from '../lib/clipboard';
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

  const copySshCommand = async () => {
    if (!selectedNode?.network?.publicIp) return;
    const cmd = `ssh root@${selectedNode.network.publicIp} -p ${selectedNode.network.sshPort || 22}`;
    if ((await copyToClipboard(cmd)) === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    window.prompt('Copy the SSH command:', cmd);
  };

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-5 py-2 text-xs sm:px-8">
      {/* Breadcrumb Path */}
      <div className="flex items-center space-x-2 overflow-x-auto">
        <Link to="/dashboard" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" />
        </Link>

        {pathNames.map((value, index) => {
          const to = `/${pathNames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathNames.length - 1;
          const formattedValue = value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');

          return (
            <React.Fragment key={to}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
              {isLast ? (
                <span className="font-medium text-foreground">{formattedValue}</span>
              ) : (
                <Link to={to} className="text-muted-foreground hover:text-foreground transition-colors">
                  {formattedValue}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Node Context Quick Actions */}
      {selectedNode && selectedNode.network && (
        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-muted-foreground">
          <div className="flex items-center space-x-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-0.5 font-mono">
            <Server className="h-3 w-3 text-muted-foreground" />
            <span className="font-medium text-foreground">{selectedNode.name}</span>
            {selectedNode.network.publicIp && selectedNode.network.publicIp !== selectedNode.name && (
              <span className="text-muted-foreground">{selectedNode.network.publicIp}</span>
            )}
          </div>

          <button
            onClick={copySshCommand}
            disabled={!selectedNode.network.publicIp}
            className="flex items-center space-x-1.5 rounded-full border border-border/70 bg-card/70 px-2.5 py-0.5 font-mono text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground disabled:opacity-40 disabled:hover:border-border/70 disabled:hover:text-muted-foreground"
            title={
              selectedNode.network.publicIp
                ? 'Copy SSH connection string'
                : 'The agent has not reported a public IP for this host'
            }
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copied ? 'Copied SSH' : 'Copy SSH'}</span>
          </button>

          <Badge variant="outline" className="text-[10px]">
            {selectedNode.hardware.cpuCores > 0 ? `${selectedNode.hardware.cpuCores} vCPU` : '— vCPU'} /{' '}
            {selectedNode.hardware.ramGb > 0 ? `${selectedNode.hardware.ramGb} GB` : '— GB'}
          </Badge>
        </div>
      )}
    </div>
  );
}
