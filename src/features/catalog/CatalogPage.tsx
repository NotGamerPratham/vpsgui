import React, { useState, useEffect } from 'react';
import { Box, Download, Star, Search } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { catalogService } from '../../services/catalogService';
import { CatalogItem, CatalogCategory } from '../../types/catalog';

export function CatalogPage() {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    catalogService.fetchCatalog().then((res) => {
      setCatalogItems(res);
    });
  }, []);

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

            <div className="border-t border-border/60 pt-3 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] text-muted-foreground font-mono">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>{item.rating}</span>
                <span>•</span>
                <span>{item.downloadsCount.toLocaleString()} deploys</span>
              </div>

              <Button size="sm" className="gap-1.5 text-xs bg-primary">
                <Download className="h-3.5 w-3.5" />
                <span>Deploy to VPS</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
