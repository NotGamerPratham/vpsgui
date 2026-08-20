import React, { useState } from 'react';
import { copyToClipboard } from '../../lib/clipboard';
import { Bot, Terminal, Copy, Check, RefreshCw, Zap } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useServerStore } from '../../store/useServerStore';

export function AgentPage() {
  const { nodes } = useServerStore();
  const [copied, setCopied] = useState(false);

  // There is one agent and it is Node.js. The "Go Agent" / "Rust Agent" tabs offered a choice that
  // never existed - both emitted the same shell script - and both carried a hardcoded
  // `--token=vpsgui_tok_84920492840`, an invented value that install.sh does not even accept.
  // The installer generates a real token and prints it on completion.
  const downloadCmd = 'curl -fsSLO https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh';
  const installCmd = 'less install.sh && sudo bash install.sh';

  const copyScript = async () => {
    const script = `${downloadCmd}\n${installCmd}`;
    // Only report success if the copy actually happened; this used to flash "Copied!" even when
    // navigator.clipboard was undefined (any plain-HTTP deployment) and it had thrown.
    if ((await copyToClipboard(script)) === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    window.prompt('Copy the install commands:', script);
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
          {/* Claimed a "zero-dependency agent written in Go/Rust". It is a Node.js HTTP daemon
              (agent/server.js) requiring Node 18+. */}
          <p className="text-xs text-muted-foreground mt-0.5">
            Node.js HTTP daemon providing host telemetry, file management, and Docker control.
            Requires Node.js 18+ and listens on 127.0.0.1:46509 behind the nginx proxy.
          </p>
        </div>
      </div>

      {/* Quick Installation Script Box */}
      <Card className="bg-card/70 border-border/70 p-6">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center space-x-3">
            <Terminal className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">One-Line Agent Install Script</h3>
          </div>

          <Button size="sm" variant="ghost" onClick={copyScript} className="h-8 gap-1.5 text-xs text-foreground shrink-0">
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>

        {/* Download-then-inspect rather than piping a remote script straight into a root shell. */}
        <div className="rounded-lg border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 space-y-1 overflow-x-auto">
          <div className="whitespace-nowrap">{downloadCmd}</div>
          <div className="whitespace-nowrap">{installCmd}</div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3">
          The installer generates an agent token and prints it when it finishes. Paste it into
          Settings &rarr; Agent Token. It grants root-equivalent control of the host, so treat it as
          a root password.
        </p>
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
                    <p className="text-[11px] text-muted-foreground font-mono">{node.network?.publicIp || 'Public IP not reported'}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-xs">
                  <span className="font-mono text-muted-foreground">{node.agentVersion}</span>
                  <Badge variant="success" className="text-[10px] px-2 py-0.5">
                    {node.agentStatus.toUpperCase()}
                  </Badge>
                  {/* Had no handler. Restarting the agent from the agent would also kill the
                      connection mid-request; do it from the host instead. */}
                  <span
                    className="text-[10px] font-mono text-muted-foreground"
                    title="Restart from the host: systemctl restart vpsgui-agent"
                  >
                    systemctl restart vpsgui-agent
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
