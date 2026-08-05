import React, { useState } from 'react';
import { FileCode, Terminal, BookOpen, ShieldCheck, Cpu, Copy, Check, Server, Network } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';

export function DocsPage() {
  const [activeTab, setActiveTab] = useState<'agent' | 'api' | 'architecture' | 'security'>('agent');
  const [copied, setCopied] = useState(false);

  const installScript = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash`;

  const copyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Developer Documentation & Infrastructure API Explorer</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Complete technical documentation, REST/WebSocket API endpoints, Linux agent installer, and system architecture.
          </p>
        </div>

        <Button onClick={() => copyScript(installScript)} className="gap-1.5 text-xs bg-primary">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          <span>{copied ? 'Copied Agent Script' : 'Copy Linux Agent Installer'}</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1 border-b border-border/60 bg-muted/30 p-1 rounded-lg">
        {[
          { id: 'agent', label: 'Linux Agent Setup', icon: Terminal },
          { id: 'api', label: 'REST & WebSocket API', icon: FileCode },
          { id: 'architecture', label: 'System Architecture', icon: Network },
          { id: 'security', label: 'Security & RBAC Matrix', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {activeTab === 'agent' && (
        <div className="space-y-4">
          <Card className="bg-card/70 border-border/70 p-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground">1-Click Linux Agent Automated Installer</h3>
            <p className="text-xs text-muted-foreground">
              Execute this command on your Linux VPS terminal (`Ubuntu`, `Debian`, `CentOS`, `Alpine`) to install and start `vpsgui-agent`:
            </p>
            <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 flex items-center justify-between">
              <code>{installScript}</code>
              <Button size="sm" variant="ghost" onClick={() => copyScript(installScript)} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>

          <Card className="bg-card/70 border-border/70 p-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Linux Systemd Service Unit (/etc/systemd/system/vpsgui-agent.service)</h3>
            <pre className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed">
{`[Unit]
Description=VPSGUI Linux Infrastructure Telemetry Agent
After=network.target docker.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/vpsgui-agent --config /etc/vpsgui/agent.yaml
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target`}
            </pre>
          </Card>
        </div>
      )}

      {activeTab === 'api' && (
        <Card className="bg-card/70 border-border/70 p-6 space-y-6">
          <h3 className="text-sm font-bold text-foreground">REST API Endpoints (/api/v1) & WebSocket Stream (/ws)</h3>

          <div className="space-y-4 font-mono text-xs">
            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1">
              <div className="flex items-center space-x-2">
                <Badge variant="success" className="text-[10px]">GET</Badge>
                <span className="font-bold text-foreground">/api/v1/nodes</span>
              </div>
              <p className="text-muted-foreground font-sans">Fetches list of all connected Linux VPS nodes.</p>
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1">
              <div className="flex items-center space-x-2">
                <Badge variant="purple" className="text-[10px]">POST</Badge>
                <span className="font-bold text-foreground">/api/v1/nodes</span>
              </div>
              <p className="text-muted-foreground font-sans">Connects and registers a new Linux VPS node.</p>
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1">
              <div className="flex items-center space-x-2">
                <Badge variant="success" className="text-[10px]">GET</Badge>
                <span className="font-bold text-foreground">/api/v1/docker/containers</span>
              </div>
              <p className="text-muted-foreground font-sans">Inspects running Docker containers from host socket.</p>
            </div>

            <div className="rounded-lg border border-border/60 p-3 bg-muted/20 space-y-1">
              <div className="flex items-center space-x-2">
                <Badge variant="warning" className="text-[10px]">WS</Badge>
                <span className="font-bold text-foreground">ws://host/ws</span>
              </div>
              <p className="text-muted-foreground font-sans">WebSocket stream emitting 2-second real-time telemetry points.</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'architecture' && (
        <Card className="bg-card/70 border-border/70 p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">Monorepo System Architecture</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            VPSGUI is architected as a high-performance monorepo separating web frontend UI workspace, API gateway, Go/Rust telemetry agent, and reusable design system tokens.
          </p>
          <pre className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-cyan-400 overflow-x-auto leading-relaxed">
{`+-------------------------------------------------------------------+
|                        VPSGUI Web Frontend                        |
|   (React 18 + TypeScript + Zustand + Tailwind CSS + Lucide Icons) |
+-------------------------------------------------------------------+
                               |
               +---------------+---------------+
               | REST API                      | WebSocket (/ws)
               v                               v
+-------------------------------+   +-------------------------------+
|     API Gateway (/api/v1)     |   |   Telemetry Stream Engine     |
+-------------------------------+   +-------------------------------+
                               |
                               v
+-------------------------------------------------------------------+
|                     Linux VPS Node (\`vpsgui-agent\`)               |
|      (CPU, RAM, Disk, Docker Socket, UFW Firewall, Systemd)       |
+-------------------------------------------------------------------+`}
          </pre>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card className="bg-card/70 border-border/70 p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">Role-Based Access Control (RBAC) Security Policy</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p><strong className="text-foreground">Owner:</strong> Full infrastructure cluster permissions, API key generation, user management.</p>
            <p><strong className="text-foreground">DevOps Admin:</strong> Manage VPS nodes, Docker containers, firewall rules, and SSH keys.</p>
            <p><strong className="text-foreground">Viewer:</strong> Read-only access to telemetry graphs and system logs.</p>
          </div>
        </Card>
      )}
    </div>
  );
}
