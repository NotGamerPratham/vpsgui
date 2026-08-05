import React, { useState } from 'react';
import { Bot, Terminal, ShieldCheck, Cpu, Copy, Check, Download, RefreshCw, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useServerStore } from '../../store/useServerStore';

export function AgentPage() {
  const { nodes } = useServerStore();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'go' | 'rust'>('go');

  const goInstallScript = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash -s -- --token=vpsgui_tok_84920492840`;
  const rustInstallScript = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo sh -s -- --token=vpsgui_tok_84920492840`;

  const copyScript = () => {
    navigator.clipboard.writeText(activeTab === 'go' ? goInstallScript : rustInstallScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>vpsgui-agent Lightweight Binary</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            High performance, zero-dependency background agent written in Go/Rust for live telemetry streams, file management, and Docker control.
          </p>
        </div>

        <Badge variant="success" className="font-mono text-xs py-1 px-3">
          Agent Version v1.4.2 Latest
        </Badge>
      </div>

      {/* Quick Installation Script Box */}
      <Card className="bg-card/70 border-border/70 p-6">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-3">
            <Terminal className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">One-Line Agent Install Script</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('go')}
              className={`px-3 py-1 text-xs rounded-md font-mono ${activeTab === 'go' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Go Agent
            </button>
            <button
              onClick={() => setActiveTab('rust')}
              className={`px-3 py-1 text-xs rounded-md font-mono ${activeTab === 'rust' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-muted'}`}
            >
              Rust Agent
            </button>
          </div>
        </div>

        <div className="relative rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 flex items-center justify-between">
          <code className="truncate pr-4">{activeTab === 'go' ? goInstallScript : rustInstallScript}</code>
          <Button size="sm" variant="ghost" onClick={copyScript} className="h-8 gap-1.5 text-xs text-foreground shrink-0">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </Card>

      {/* Connected Agents Table */}
      <Card className="bg-card/70 border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Connected Agent Instances</span>
            <RefreshCw className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {nodes.map((node) => (
              <div key={node.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border border-border/60 bg-muted/20 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{node.name}</h4>
                    <p className="text-[11px] text-muted-foreground font-mono">{node.network?.publicIp || '127.0.0.1'} (Port {node.network?.sshPort || 22})</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs">
                  <span className="font-mono text-muted-foreground">{node.agentVersion}</span>
                  <Badge variant="success" className="text-[10px] px-2 py-0.5">
                    {node.agentStatus.toUpperCase()}
                  </Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    Restart Agent
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
