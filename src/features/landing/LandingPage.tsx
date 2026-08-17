import React, { useState } from 'react';
import { copyToClipboard } from '../../lib/clipboard';
import { useNavigate, Link } from 'react-router-dom';
import { Server, Activity, Terminal, Github, Heart, ExternalLink, Copy, Check, ArrowRight, Code2, Lock, BookOpen, Star, GitFork, Box, Container, Map, Layout, Radio, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';


export function LandingPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [activeSdkTab, setActiveSdkTab] = useState<'node' | 'python'>('node');
  const [copiedSdk, setCopiedSdk] = useState(false);

  const installScript = `curl -sSL https://raw.githubusercontent.com/NotGamerPratham/vpsgui/main/agent/install.sh | sudo bash`;

  const copyScript = async () => {
    if ((await copyToClipboard(installScript)) === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    window.prompt('Copy the install script:', installScript);
  };

  const copySdkCmd = async (cmd: string) => {
    if ((await copyToClipboard(cmd)) === 'copied') {
      setCopiedSdk(true);
      setTimeout(() => setCopiedSdk(false), 2000);
      return;
    }
    window.prompt('Copy the command:', cmd);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary selection:text-primary-foreground">
      {/* Top Announcement Bar */}
      <div className="bg-primary/10 border-b border-primary/20 py-2 px-4 text-center text-xs text-primary font-medium flex items-center justify-center space-x-2">
        <Sparkles className="h-3.5 w-3.5" />
        <span>Open Source Infrastructure Workspace created by <a href="https://notgamerpratham.com" target="_blank" rel="noreferrer" className="underline font-bold hover:text-foreground">NotGamerPratham</a></span>
        <span className="hidden sm:inline text-muted-foreground">•</span>
        <a href="https://github.com/NotGamerPratham/vpsgui" target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center space-x-1 underline hover:text-foreground">
          <span>Star on GitHub</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Main Navigation Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-border/80 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/25">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <span className="font-extrabold tracking-wider text-foreground text-base">VPSGUI</span>
              <span className="block text-[10px] text-muted-foreground font-mono">Open Infrastructure Workspace</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-6 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#sdks" className="hover:text-foreground transition-colors">SDKs & APIs</a>
            <a href="#community" className="hover:text-foreground transition-colors">Community</a>
            <Link to="/docs" className="hover:text-foreground transition-colors flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Docs</span>
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <a
              href="https://github.com/NotGamerPratham/vpsgui"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/80 hover:bg-accent text-xs font-medium text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>

            <Button onClick={() => navigate('/dashboard')} size="sm" className="gap-1.5 text-xs bg-primary font-bold shadow-md shadow-primary/20">
              <span>Launch Console</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden">
        {/* Subtle Background Glow Elements */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-40 right-10 w-80 h-80 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Open Source • Strict Zero-Mock Data • Linux Agent Powered</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
            Open Infrastructure Workspace for <span className="bg-gradient-to-r from-primary via-cyan-400 to-violet-400 bg-clip-text text-transparent">Linux VPS & Containers</span>
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Single-pane control over servers, Docker engines, network topology, SSH workbenches, and automated deployments. Built for developers, DevOps engineers, and sysadmins.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button onClick={() => navigate('/dashboard')} size="lg" className="w-full sm:w-auto gap-2 bg-primary font-bold shadow-xl shadow-primary/20 text-sm">
              <Server className="h-4 w-4" />
              <span>Launch Workspace Console</span>
            </Button>

            <a
              href="https://github.com/NotGamerPratham/vpsgui"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" size="lg" className="w-full gap-2 text-sm font-semibold">
                <Github className="h-4 w-4" />
                <span>View Source on GitHub</span>
              </Button>
            </a>
          </div>

          {/* 1-Click Linux Agent Installer Bar */}
          <div className="pt-6 max-w-2xl mx-auto space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Deploy agent on any Linux VPS (Ubuntu, Debian, CentOS, Alpine, Arch):</p>
            <div className="rounded-xl border border-primary/30 bg-slate-950 p-3 font-mono text-xs text-emerald-400 flex items-center justify-between shadow-2xl space-x-2">
              <div className="truncate flex items-center space-x-2">
                <Terminal className="h-4 w-4 text-primary shrink-0" />
                <code className="truncate">{installScript}</code>
              </div>

              <Button onClick={copyScript} size="sm" variant="ghost" className="shrink-0 h-8 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-16 px-6 bg-card/30 border-y border-border/60">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Built for Modern Infrastructure Engineers
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mx-auto">
              Everything you need to inspect, manage, automate, and secure your Linux VPS fleet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Feature 1 */}
            <Card className="bg-card/70 border-border/70 hover:border-primary/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Zero-Mock Real Telemetry</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Direct hardware stream inspection querying Linux <code className="text-primary font-mono">/proc</code> and <code className="text-primary font-mono">/sys</code> primitives without simulated data.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card className="bg-card/70 border-border/70 hover:border-cyan-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Map className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Interactive Topology Map</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Visual node graph displaying ingress load balancers, compute VPS nodes, Docker engines, and database clusters.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card className="bg-card/70 border-border/70 hover:border-emerald-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Terminal className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Host Terminal</h3>
              {/* Describes what actually ships: token-authenticated command execution over the
                  agent's HTTP API. There is no SSH client and no "AES256 encrypted key auth". */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                Run shell commands on the host through the token-authenticated agent, with saved
                snippets and command history. Serve it over HTTPS.
              </p>
            </Card>

            {/* Feature 4 */}
            <Card className="bg-card/70 border-border/70 hover:border-violet-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                <Container className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Docker Engine Manager</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Start, stop, restart, inspect image repos, and view live streaming container logs from the Docker socket.
              </p>
            </Card>

            {/* Feature 5 */}
            <Card className="bg-card/70 border-border/70 hover:border-amber-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Box className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Open Application Catalog</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                1-Click stack templates for Nginx Proxy Manager, PostgreSQL, Redis, WordPress, and community extensions.
              </p>
            </Card>

            {/* Feature 6 */}
            <Card className="bg-card/70 border-border/70 hover:border-rose-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <Code2 className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Declarative IaC Exporter</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Export server configurations to Terraform HCL, Ansible Playbooks, Docker Compose, and Cloud-Init manifests.
              </p>
            </Card>

            {/* Feature 7 */}
            <Card className="bg-card/70 border-border/70 hover:border-indigo-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Vault & Secrets Manager</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Encrypted environment variables, secret API tokens, deployment SSH keys, and RBAC team permissions.
              </p>
            </Card>

            {/* Feature 8 */}
            <Card className="bg-card/70 border-border/70 hover:border-teal-500/50 transition-all p-5 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Layout className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Multi-Theme VS Code Engine</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                6 curated themes including VS Code Dark, Dracula, Catppuccin, Nord, Atom One Dark, and Tokyo Night.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* SDK Showcase Section */}
      <section id="sdks" className="py-16 px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Official SDK Libraries
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Integrate VPSGUI programmatically into your CI/CD pipelines, custom scripts, and backend services.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 bg-card/80 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant={activeSdkTab === 'node' ? 'default' : 'ghost'}
                  onClick={() => setActiveSdkTab('node')}
                  className="text-xs font-mono"
                >
                  @vpsgui/sdk (Node.js / npm)
                </Button>
                <Button
                  size="sm"
                  variant={activeSdkTab === 'python' ? 'default' : 'ghost'}
                  onClick={() => setActiveSdkTab('python')}
                  className="text-xs font-mono"
                >
                  vpsgui (Python / PyPI)
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => copySdkCmd(activeSdkTab === 'node' ? 'npm install @vpsgui/sdk' : 'pip install vpsgui')}
                className="h-8 text-xs font-mono gap-1.5"
              >
                {copiedSdk ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedSdk ? 'Copied' : activeSdkTab === 'node' ? 'npm install @vpsgui/sdk' : 'pip install vpsgui'}</span>
              </Button>
            </div>

            {activeSdkTab === 'node' ? (
              <div className="rounded-xl border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed">
{`import { VpsguiClient } from '@vpsgui/sdk';

const client = new VpsguiClient({
  baseUrl: 'https://your-vps-ip/api/v1',
  token: 'your-jwt-auth-token',
});

// List connected VPS nodes & Docker containers
const nodes = await client.nodes.list();
const containers = await client.docker.listContainers();
const telemetry = await client.system.telemetry();`}
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-slate-950 p-4 font-mono text-xs text-emerald-400 whitespace-pre-wrap leading-relaxed">
{`from vpsgui import VpsguiClient

client = VpsguiClient(
    base_url="https://your-vps-ip/api/v1",
    token="your-jwt-auth-token",
)

# List connected VPS nodes & Docker containers
nodes = client.nodes.list()
containers = client.docker.list_containers()
telemetry = client.system.telemetry()`}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Open Source & Community Sponsorship Banner */}
      <section id="community" className="py-16 px-6 bg-primary/5 border-t border-border/60">
        <div className="max-w-5xl mx-auto rounded-2xl border border-primary/30 glass-panel p-8 text-center space-y-6 shadow-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/30 mx-auto">
            <Heart className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Open Source & Community Driven
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
              VPSGUI is 100% open-source software developed by <strong>NotGamerPratham</strong>. Contribute code, report issues, or sponsor development to help expand the ecosystem.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="https://github.com/NotGamerPratham/vpsgui"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" className="gap-1.5 text-xs bg-primary font-bold">
                <Star className="h-3.5 w-3.5" />
                <span>Star on GitHub</span>
              </Button>
            </a>

            <a
              href="https://github.com/NotGamerPratham/vpsgui/issues"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                <GitFork className="h-3.5 w-3.5" />
                <span>Report Issue / Feedback</span>
              </Button>
            </a>

            <a
              href="https://notgamerpratham.com"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="secondary" className="gap-1.5 text-xs">
                <Heart className="h-3.5 w-3.5 text-rose-400" />
                <span>Sponsor NotGamerPratham</span>
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60 py-8 px-6 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">VPSGUI</span>
            <span>— Open Infrastructure Workspace</span>
          </div>

          <div className="flex items-center space-x-6">
            <Link to="/docs" className="hover:text-foreground">Documentation</Link>
            <a href="https://github.com/NotGamerPratham/vpsgui" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
            <a href="https://notgamerpratham.com" target="_blank" rel="noreferrer" className="hover:text-foreground font-semibold text-primary">NotGamerPratham</a>
          </div>

          <div>
            Released under the <a href="https://opensource.org/licenses/MIT" target="_blank" rel="noreferrer" className="underline hover:text-foreground">MIT License</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
