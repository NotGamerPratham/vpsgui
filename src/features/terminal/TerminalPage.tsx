import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Play, Loader2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { useServerStore } from '../../store/useServerStore';
import { apiClient, ApiError } from '../../api/client';

/** Command execution timeout must exceed the agent's own 10s cap so the agent's message wins. */
const EXEC_TIMEOUT_MS = 20000;
const MAX_OUTPUT_LINES = 2000;

export function TerminalPage() {
  const { nodes, selectedNodeId } = useServerStore();
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;
  const hostLabel = selectedNode?.name || 'host';

  const [inputCommand, setInputCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'VPSGUI terminal. Commands run on the host via the vpsgui-agent daemon.',
    'Requires a valid Agent Token (Settings -> Agent Token). Type "clear" to reset.',
  ]);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest output in view; long command output used to scroll off-screen unnoticed.
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ block: 'end' });
  }, [terminalOutput]);

  const snippets = [
    { title: 'Check Memory', cmd: 'free -h' },
    { title: 'Docker Containers', cmd: 'docker ps -a' },
    { title: 'Top Processes', cmd: 'ps aux --sort=-%cpu | head -n 6' },
    { title: 'Disk Usage', cmd: 'df -h' },
    { title: 'System Uptime', cmd: 'uptime' },
  ];

  const appendOutput = (lines: string[]) =>
    setTerminalOutput((prev) => [...prev, ...lines].slice(-MAX_OUTPUT_LINES));

  const handleRun = async (cmdToRun?: string) => {
    const command = (cmdToRun ?? inputCommand).trim();
    if (!command || isExecuting) return;

    setHistory((prev) => (prev[prev.length - 1] === command ? prev : [...prev, command]).slice(-100));
    setHistoryIndex(-1);
    setInputCommand('');

    if (command === 'clear') {
      setTerminalOutput([]);
      return;
    }

    setIsExecuting(true);
    const promptLine = `root@${hostLabel}:~# ${command}`;

    try {
      const res = await apiClient.post<{ success: boolean; command: string; output: string }>(
        '/terminal/exec',
        { command },
        EXEC_TIMEOUT_MS
      );
      // A command that exits non-zero is reported as a failure rather than being dressed up as
      // "executed cleanly with status 0".
      const output = res?.output?.length ? res.output : res?.success ? '(no output)' : '(command failed with no output)';
      appendOutput([promptLine, res?.success ? output : `[exit != 0] ${output}`]);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Unauthorized — set a valid Agent Token under Settings.'
          : err instanceof Error
          ? err.message
          : 'Failed to execute command on host daemon';
      appendOutput([promptLine, `[Error]: ${message}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  /** Up/Down recall previously entered commands, as any real shell does. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleRun();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInputCommand(history[next]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < 0) return;
      const next = historyIndex + 1;
      if (next >= history.length) {
        setHistoryIndex(-1);
        setInputCommand('');
      } else {
        setHistoryIndex(next);
        setInputCommand(history[next]);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <span>Host Terminal</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Commands execute on <span className="font-mono text-primary font-bold">{hostLabel}</span> through the
            vpsgui-agent HTTP daemon. This is not an interactive SSH session — each command runs
            independently, so shell state (cd, exports) does not persist between commands.
          </p>
        </div>

        {/* Reflects the actual transport. The previous badge claimed an "SSH Active (AES256-GCM)"
            session, which never existed: requests go over HTTP(S) to the agent. */}
        <Badge variant="outline" className="font-mono text-xs py-1 px-3">
          Agent HTTP transport
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[600px]">
        {/* Terminal Main Pane */}
        <Card className="lg:col-span-3 bg-slate-950 border-border/70 flex flex-col overflow-hidden">
          {/* Terminal Tab Header */}
          <div className="flex items-center justify-between border-b border-border bg-slate-900 px-4 py-2 text-xs">
            <div className="flex items-center space-x-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isExecuting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span className="font-mono text-foreground font-bold">root@{hostLabel}</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {isExecuting ? 'running' : 'idle'}
            </span>
          </div>

          {/* Terminal Console Output */}
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-emerald-400 space-y-2 leading-relaxed">
            {terminalOutput.map((line, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-words">{line}</div>
            ))}
            <div ref={outputEndRef} />
          </div>

          {/* Terminal Input Line */}
          <div className="flex items-center border-t border-border bg-slate-900 px-4 py-2">
            <span className="font-mono text-xs text-emerald-400 mr-2 shrink-0">root@{hostLabel}:~#</span>
            <input
              type="text"
              value={inputCommand}
              onChange={(e) => setInputCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              placeholder={isExecuting ? 'Executing command on host VPS...' : 'Type a command and press Enter (Up/Down for history)...'}
              className="flex-1 bg-transparent font-mono text-xs text-foreground focus:outline-none disabled:opacity-50"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
            {isExecuting && <Loader2 className="h-3.5 w-3.5 text-emerald-400 animate-spin ml-2" />}
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
                disabled={isExecuting}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-2.5 text-left text-xs hover:border-primary/40 hover:bg-muted/60 transition-all group disabled:opacity-50"
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
