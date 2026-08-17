import React, { useState, useEffect } from 'react';
import { Box, Search, ShieldCheck, Copy, Check } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { catalogService } from '../../services/catalogService';
import { CatalogItem, CatalogCategory } from '../../types/catalog';
import { copyToClipboard } from '../../lib/clipboard';

export function CatalogPage() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    catalogService.fetchCatalog().then(setCatalogItems);
  }, []);

  /** Build the `docker run` line for an item, including its documented ports and env. */
  const copyRunCommand = async (item: CatalogItem) => {
    if (!item.image) return;
    const ports = (item.defaultPorts || []).map((p) => `-p ${p}:${p}`).join(' ');
    const env = Object.entries(item.defaultEnv || {})
      .map(([k, v]) => `-e ${k}=${v}`)
      .join(' ');
    const cmd = ['docker run -d --name', item.id, ports, env, item.image].filter(Boolean).join(' ');

    // Falls back to execCommand, so this works over plain HTTP too.
    if ((await copyToClipboard(cmd)) === 'copied') {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }
    window.prompt('Copy the run command:', cmd);
  };

  const categories: { id: CatalogCategory | 'all'; label: string }[] = [
    { id: 'all', label: 'All Catalog' },
    { id: 'applications', label: 'Applications' },
    { id: 'stacks', label: '1-Click Stacks' },
    { id: 'docker_images', label: 'Docker Images' },
    { id: 'vm_images', label: 'VM Images' },
    { id: 'operating_systems', label: 'OS Templates' },
    { id: 'plugins', label: 'Plugins' },
  ];

  const filtered = catalogItems.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            <span>Open Infrastructure Catalog</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover and deploy 1-Click application stacks, Docker containers, OS templates, and community plugins onto your VPS.
          </p>
        </div>
      </div>

      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-1 overflow-x-auto w-full md:w-auto bg-muted/40 p-1 rounded-lg border border-border/60">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                selectedCategory === cat.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search catalog apps..."
            className="pl-9 text-xs bg-card"
          />
        </div>
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item) => (
          <Card key={item.id} className="bg-card/70 border-border/70 hover:border-primary/40 transition-all flex flex-col justify-between p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold">
                    <Box className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{item.name}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">{item.version}</p>
                  </div>
                </div>

                <Badge variant="purple" className="text-[9px] px-1.5 py-0 uppercase">
                  {item.category}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.description}</p>

              <div className="flex flex-wrap gap-1">
                {item.tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] py-0 px-1.5">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t border-border/60 pt-3 flex items-center justify-between gap-2">
              {/* Shows the publisher and image reference — facts the catalog actually carries.
                  Star ratings and deploy counts would need a registry the agent does not query,
                  and `downloadsCount.toLocaleString()` threw outright once they became null. */}
              <div className="flex items-center space-x-1.5 text-[11px] text-muted-foreground font-mono min-w-0">
                {item.official && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                <span className="truncate" title={item.image || item.publisher}>
                  {item.image || item.publisher}
                </span>
              </div>

              {/* Copies the exact command instead of a "Deploy" button that never had a handler
                  and no agent endpoint behind it. */}
              <Button
                size="sm"
                variant="outline"
                disabled={!item.image}
                onClick={() => item.image && copyRunCommand(item)}
                className="gap-1.5 text-xs shrink-0"
              >
                {copiedId === item.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === item.id ? 'Copied' : 'Copy run cmd'}</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
