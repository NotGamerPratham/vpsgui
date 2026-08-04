import React, { useState } from 'react';
import { Terminal, Plus, X, Download, Play, Shield, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useServerStore } from '../../store/useServerStore';

export function TerminalPage() {
  const { nodes, selectedNodeId } = useServerStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  const [inputCommand, setInputCommand] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>(
    [`Connected to root@${selectedNode.network.publicIp} (Ubuntu 24.04 LTS)`, `Type 'help' or click a command snippet below.`]
  );

  const snippets = [
    { title: 'Check Memory', cmd: 'free -h' },
    { title: 'Docker Containers', cmd: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"' },
    { title: 'Top Processes', cmd: 'ps aux --sort=-%cpu | head -n 6' },
    { title: 'Disk Usage', cmd: 'df -h' },
    { title: 'System Logs', cmd: 'journalctl -n 20 --no-pager' },
  ];

  const handleRun = (cmdToRun?: string) => {
    const command = cmdToRun || inputCommand;
    if (!command.trim()) return;

    let response = `root@${selectedNode.name}:~# ${command}\n`;

    if (command === 'free -h') {
      response += `               total        used        free      shared  buff/cache   available\nMem:            31Gi       8.4Gi        18Gi       120Mi       4.2Gi        22Gi\nSwap:          4.0Gi        24Mi       3.9Gi`;
    } else if (command.includes('docker ps')) {
      response += `NAMES                   STATUS              PORTS\nnginx-proxy-manager     Up 14 days          0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp\npostgres-production     Up 35 days          0.0.0.0:5432->5432/tcp\nredis-cache-cluster     Up 9 days           0.0.0.0:6379->6379/tcp`;
    } else if (command === 'df -h') {
      response += `Filesystem      Size  Used Avail Use% Mounted on\n/dev/nvme0n1p1  245G   98G  147G  40% /\ntmpfs            16G  1.2M   16G   1% /run`;
    } else if (command === 'clear') {
      setTerminalOutput([]);
      setInputCommand('');
      return;
    } else if (command === 'help') {
      response += `Available mock commands: free -h, docker ps, df -h, clear, help`;
    } else {
      response += `Executing: ${command}\nCommand exited with status code 0`;
    }

    setTerminalOutput((prev) => [...prev, response]);
    setInputCommand('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span>SSH Workbench Split Terminal</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Interactive multi-tab SSH terminal session connected to <span className="font-mono text-primary font-bold">{selectedNode.name}</span>.
          </p>
        </div>

        <Badge variant="success" className="font-mono text-xs py-1 px-3">
          SSH Active (AES256-GCM)
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Terminal Main Pane */}
        <Card className="lg:col-span-3 bg-slate-950 border-border/70 flex flex-col overflow-hidden">
          {/* Terminal Tab Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-foreground font-bold">root@{selectedNode.name}</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">Port {selectedNode.network.sshPort}</span>
          </div>

          {/* Terminal Console Output */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-emerald-400 space-y-2 leading-relaxed">
            {terminalOutput.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap">{line}</div>
            ))}
          </div>

          {/* Terminal Input Line */}
          <div className="flex items-center border-t border-border bg-slate-900 px-4 py-2">
            <span className="font-mono text-xs text-emerald-400 mr-2 shrink-0">root@{selectedNode.name}:~#</span>
            <input
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRun()}
              placeholder="Type SSH command and press Enter..."
              className="flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none"
              autoFocus
            />
          </div>
        </Card>

        {/* Right Snippets Sidebar */}
        <Card className="lg:col-span-1 bg-card/70 border-border/70 p-4 space-y-4">
          <h3 className="font-bold text-xs text-foreground uppercase tracking-wider">Saved Snippets</h3>
          <div className="space-y-2">
            {snippets.map((snip) => (
              <button
                key={snip.title}
                onClick={() => handleRun(snip.cmd)}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 text-left text-xs hover:border-primary/40 hover:bg-muted/60 transition-all group"
              >
                <div>
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">{snip.title}</span>
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{snip.cmd}</p>
                </div>
                <Play className="h-3.5 w-3.5 text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
