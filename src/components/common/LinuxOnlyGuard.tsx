import React, { useState } from 'react';
import { Terminal, ShieldAlert, ExternalLink, Copy, Check } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';

export function LinuxOnlyGuard({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const command = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash`;

  const isWindows =
    typeof navigator !== 'undefined' &&
    (navigator.platform.toLowerCase().includes('win') || navigator.userAgent.toLowerCase().includes('windows'));

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isWindows) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6 text-center">
        <Card className="bg-slate-900/90 border-rose-500/40 p-8 max-w-xl w-full shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="flex flex-col items-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white font-mono">
              Linux VPS OS Required
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed max-w-md">
              VPSGUI is an open-source Open Infrastructure Workspace designed exclusively for Linux kernels (<span className="font-mono text-rose-400 font-bold">Ubuntu, Debian, CentOS, Alpine, Arch</span>). Running directly on Windows OS is unsupported.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-left space-y-3 font-mono text-xs text-emerald-400 shadow-inner">
            <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                Deploy to Linux VPS (1-Line Command):
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors bg-slate-800/60 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="overflow-x-auto bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
              <code className="break-all whitespace-pre-wrap leading-relaxed text-emerald-400 select-all font-mono text-xs">
                {command}
              </code>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <a
              href="https://github.com/NotGamerPratham/vpsgui"
              target="_blank"
              rel="noreferrer"
              className="w-full"
            >
              <Button variant="outline" className="w-full text-xs gap-1.5 border-slate-800 hover:bg-slate-800">
                <ExternalLink className="h-3.5 w-3.5" />
                <span>GitHub Repository</span>
              </Button>
            </a>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
