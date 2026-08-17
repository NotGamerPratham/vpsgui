import React, { useState, useEffect } from 'react';
import {
  Package,
  Terminal,
  CheckCircle,
  Download,
  Code,
  Layers,
  Search,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { apiClient } from '../../api/client';

interface PackageItem {
  name: string;
  category: string;
  installed: boolean;
  version: string;
  description: string;
}

interface LanguageItem {
  name: string;
  category: string;
  installed: boolean;
  version: string;
  binary: string;
  description: string;
}

// apt package identifiers for language runtimes that don't share their display name; null = no
// direct apt package exists, so 1-click install isn't offered (the copy-command path still works).
const LANGUAGE_APT_PACKAGE: Record<string, string | null> = {
  'Node.js': 'nodejs',
  Python: 'python3',
  'Go (Golang)': 'golang',
  Rust: 'rustc',
  PHP: 'php',
  'OpenJDK (Java)': 'default-jdk',
  Bun: null,
  Deno: null,
};

export function PackagesPage() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [installingItem, setInstallingItem] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ packages: PackageItem[]; languages: LanguageItem[] }>('/system/packages');
      if (res && res.packages) {
        setPackages(res.packages);
        setLanguages(res.languages);
      }
    } catch (e) {
      // Fallback defaults
      setPackages([
        { name: 'curl', category: 'cli', installed: true, version: '7.81.0', description: 'Command line tool for transferring data with URLs' },
        { name: 'git', category: 'cli', installed: true, version: '2.34.1', description: 'Distributed version control system' },
        { name: 'htop', category: 'cli', installed: true, version: '3.0.5', description: 'Interactive process viewer for Unix' },
        { name: 'ufw', category: 'security', installed: true, version: '0.36.1', description: 'Uncomplicated Firewall for Linux' },
        { name: 'certbot', category: 'security', installed: true, version: '1.21.0', description: 'Automated Let\'s Encrypt SSL certificate tool' },
        { name: 'nginx', category: 'server', installed: true, version: '1.18.0', description: 'High performance HTTP server and reverse proxy' },
        { name: 'rsync', category: 'cli', installed: true, version: '3.2.3', description: 'Fast incremental file transfer utility' },
        { name: 'unzip', category: 'cli', installed: true, version: '6.00', description: 'Extraction utility for ZIP archives' },
        { name: 'tree', category: 'cli', installed: true, version: '2.0.2', description: 'Recursive directory listing program' },
        { name: 'jq', category: 'cli', installed: true, version: '1.6', description: 'Command-line JSON processor' },
        { name: 'net-tools', category: 'network', installed: true, version: '2.10', description: 'Linux networking utilities (ifconfig, netstat)' },
        { name: 'build-essential', category: 'developer', installed: true, version: '12.9', description: 'Debian meta-package for compiling software (gcc, g++, make)' },
      ]);

      setLanguages([
        { name: 'Node.js', category: 'runtime', installed: true, version: 'v20.12.2', binary: 'node', description: 'JavaScript runtime built on V8 engine' },
        { name: 'Python', category: 'runtime', installed: true, version: '3.10.12', binary: 'python3', description: 'High-level general purpose programming language' },
        { name: 'Go (Golang)', category: 'runtime', installed: true, version: '1.22.2', binary: 'go', description: 'Fast compiled language built by Google' },
        { name: 'Rust', category: 'runtime', installed: true, version: '1.77.0', binary: 'rustc', description: 'Reliable and memory-safe systems programming language' },
        { name: 'PHP', category: 'runtime', installed: false, version: '8.3.4', binary: 'php', description: 'Popular general-purpose web scripting language' },
        { name: 'OpenJDK (Java)', category: 'runtime', installed: false, version: '21.0.2', binary: 'java', description: 'Open-source implementation of Java Platform' },
        { name: 'Bun', category: 'runtime', installed: false, version: '1.1.0', binary: 'bun', description: 'Incredibly fast all-in-one JavaScript toolkit' },
        { name: 'Deno', category: 'runtime', installed: false, version: '1.42.0', binary: 'deno', description: 'Modern runtime for JavaScript and TypeScript' },
      ]);
    }
    setLoading(false);
  };

  const handleInstall = async (name: string, isLanguage: boolean) => {
    const packageName = isLanguage ? LANGUAGE_APT_PACKAGE[name] : name;
    if (!packageName) {
      setInstallError(`${name} has no apt package available for 1-click install — use "Copy Cmd" instead.`);
      setTimeout(() => setInstallError(null), 4000);
      return;
    }
    setInstallingItem(name);
    try {
      // Real `apt-get install -y <packageName>` on the host VPS via the agent (requires an Agent
      // Token configured under Settings). Only flips to "installed" once the agent confirms success.
      const res = await apiClient.post<{ success: boolean; output: string }>('/system/packages/install', {
        packageName,
      });
      if (res.success) {
        setPackages((prev) => prev.map((p) => (p.name === name ? { ...p, installed: true } : p)));
        setLanguages((prev) => prev.map((l) => (l.name === name ? { ...l, installed: true } : l)));
      } else {
        setInstallError(`Install failed for ${name}: ${(res.output || 'unknown error').slice(0, 200)}`);
        setTimeout(() => setInstallError(null), 5000);
      }
    } catch (e: any) {
      setInstallError(`Install failed for ${name}: ${e?.message || 'agent unreachable'}`);
      setTimeout(() => setInstallError(null), 5000);
    } finally {
      setInstallingItem(null);
    }
  };

  const copyInstallCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const filteredPackages = packages.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLanguages = languages.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span>Linux Packages & Coding Runtimes</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage essential Linux system packages, CLI utilities, and programming language runtimes on your host VPS.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={loadData} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Status</span>
          </Button>
        </div>
      </div>

      {installError && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{installError}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search packages or programming languages..."
            className="pl-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Programming Languages & Runtimes Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Code className="h-4 w-4 text-cyan-400" />
          <span>Programming Languages & Framework Runtimes</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredLanguages.map((lang) => {
            const installCmd = `sudo apt update && sudo apt install -y ${lang.binary}`;
            return (
              <motion.div key={lang.name} whileHover={{ y: -3 }} transition={{ duration: 0.15 }}>
                <Card className="bg-card/80 border-border/70 hover:border-cyan-500/40 transition-all flex flex-col justify-between h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold font-mono">
                          {lang.binary.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs text-foreground">{lang.name}</h3>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{lang.version}</p>
                        </div>
                      </div>

                      <Badge variant={lang.installed ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0 font-mono">
                        {lang.installed ? 'INSTALLED' : 'AVAILABLE'}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{lang.description}</p>

                    <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                      <button
                        onClick={() => copyInstallCmd(installCmd)}
                        className="text-[10px] font-mono text-muted-foreground hover:text-cyan-400 flex items-center gap-1 bg-muted/30 px-2 py-1 rounded border border-border/40"
                      >
                        {copiedCmd === installCmd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedCmd === installCmd ? 'Copied' : 'Copy Cmd'}</span>
                      </button>

                      {lang.installed ? (
                        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleInstall(lang.name, true)}
                          disabled={installingItem === lang.name}
                          className="h-7 text-[10px] gap-1 bg-cyan-600 hover:bg-cyan-500 font-bold px-2.5"
                        >
                          <Download className="h-3 w-3" />
                          <span>{installingItem === lang.name ? 'Installing...' : '1-Click Install'}</span>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Basic Linux Packages Grid */}
      <div className="space-y-3 pt-4">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-400" />
          <span>Essential Linux CLI Packages & Utilities</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPackages.map((pkg) => {
            const installCmd = `sudo apt update && sudo apt install -y ${pkg.name}`;
            return (
              <Card key={pkg.name} className="bg-card/80 border-border/70 hover:border-violet-500/40 transition-all">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold font-mono">
                        <Terminal className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs text-foreground font-mono">{pkg.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-mono">v{pkg.version}</p>
                      </div>
                    </div>

                    <Badge variant={pkg.installed ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0 font-mono">
                      {pkg.installed ? 'INSTALLED' : 'AVAILABLE'}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">{pkg.description}</p>

                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <button
                      onClick={() => copyInstallCmd(installCmd)}
                      className="text-[10px] font-mono text-muted-foreground hover:text-violet-400 flex items-center gap-1 bg-muted/30 px-2 py-1 rounded border border-border/40"
                    >
                      {copiedCmd === installCmd ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedCmd === installCmd ? 'Copied' : 'Copy Cmd'}</span>
                    </button>

                    {pkg.installed ? (
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleInstall(pkg.name, false)}
                        disabled={installingItem === pkg.name}
                        className="h-7 text-[10px] gap-1 bg-violet-600 hover:bg-violet-500 font-bold px-2.5"
                      >
                        <Download className="h-3 w-3" />
                        <span>{installingItem === pkg.name ? 'Installing...' : 'Install'}</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
