import React, { useState, useEffect } from 'react';
import { Package, Terminal, CheckCircle, Download, Code, Layers, Search, RefreshCw, Copy, Check, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { apiClient, ApiError } from '../../api/client';
import { copyToClipboard } from '../../lib/clipboard';

interface PackageItem {
  name: string;
  category: string;
  installed: boolean;
  /** null when the binary is present but did not report a parseable version. */
  version: string | null;
  description: string;
}

interface LanguageItem {
  name: string;
  category: string;
  installed: boolean;
  version: string | null;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.get<{ packages: PackageItem[]; languages: LanguageItem[] }>('/system/packages');
      setPackages(Array.isArray(res?.packages) ? res.packages : []);
      setLanguages(Array.isArray(res?.languages) ? res.languages : []);
    } catch (e) {
      // Show nothing rather than a plausible-looking fiction. The previous fallback hard-coded
      // twelve packages and four runtimes as "INSTALLED" with invented version numbers, so an
      // unreachable agent looked exactly like a fully provisioned host.
      setPackages([]);
      setLanguages([]);
      setLoadError(
        e instanceof ApiError && e.status === 401
          ? 'Unauthorized — set a valid Agent Token under Settings to read installed packages.'
          : `Could not reach the agent: ${e instanceof Error ? e.message : 'unknown error'}`
      );
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

  const copyInstallCmd = async (cmd: string) => {
    // copyToClipboard falls back to execCommand, so this works over plain HTTP where
    // navigator.clipboard does not exist at all.
    if ((await copyToClipboard(cmd)) === 'copied') {
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
      return;
    }
    // Last resort: show the command so it can be selected, rather than only saying "copy manually".
    window.prompt('Copy the install command:', cmd);
  };

  /** The apt package name, which is often not the binary name (node -> nodejs, java -> default-jdk). */
  const aptNameFor = (lang: LanguageItem): string | null => LANGUAGE_APT_PACKAGE[lang.name] ?? null;

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

      {loadError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {!loading && !loadError && packages.length === 0 && languages.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
          The agent reported no packages or runtimes for this host.
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
            const aptName = aptNameFor(lang);
            // `apt install node` fails — the Debian package is `nodejs`. Fall back to a pointer to
            // the upstream installer for runtimes with no apt package at all (Bun, Deno).
            const installCmd = aptName
              ? `sudo apt update && sudo apt install -y ${aptName}`
              : `# ${lang.name} has no apt package — see the official installer for ${lang.name}`;
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
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-[140px]" title={lang.version ?? ''}>
                            {lang.version ?? (lang.installed ? 'version unknown' : 'not installed')}
                          </p>
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
                        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px]" title={pkg.version ?? ''}>
                          {pkg.version ?? (pkg.installed ? 'version unknown' : 'not installed')}
                        </p>
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
