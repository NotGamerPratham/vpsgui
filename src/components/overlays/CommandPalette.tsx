import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Server,
  Terminal,
  Box,
  FolderTree,
  X,
  ArrowRight,
  Command,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useServerStore } from '../../store/useServerStore';

const COMMAND_ITEMS = [
  { label: 'Open Host Terminal', path: '/terminal', icon: Terminal, keywords: 'ssh shell console terminal' },
  { label: 'Open File Explorer', path: '/files', icon: FolderTree, keywords: 'files directory manager editor' },
  { label: 'Manage Docker Containers', path: '/docker/containers', icon: Box, keywords: 'docker containers workloads' },
  { label: 'Deploy from Open Catalog', path: '/catalog', icon: Box, keywords: 'deploy app catalog nginx postgres' },
];

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { nodes } = useServerStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const handleSelect = (path: string) => {
    setCommandPaletteOpen(false);
    setQuery('');
    navigate(path);
  };

  const q = query.trim().toLowerCase();
  const filteredCommands = q
    ? COMMAND_ITEMS.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.keywords.toLowerCase().includes(q)
      )
    : COMMAND_ITEMS;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="relative z-50 w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-border/80 bg-background/50 px-4 py-3.5">
              <Search className="mr-3 h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools, containers, files... (Esc to close)"
                className="w-full bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <button
                onClick={() => setCommandPaletteOpen(false)}
                aria-label="Close command palette"
                className="rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
              <div>
                <h5 className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Quick Commands
                </h5>
                <div className="mt-1 space-y-1">
                  {filteredCommands.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground">No matching commands.</p>
                  ) : (
                    filteredCommands.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          onClick={() => handleSelect(item.path)}
                          className="group flex w-full items-center justify-between rounded-full px-3.5 py-2 text-xs text-foreground transition-colors hover:bg-accent"
                        >
                          <span className="flex items-center gap-2.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
                            <span className="font-medium">{item.label}</span>
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Active Host VPS */}
              <div>
                <h5 className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Active Host
                </h5>
                <div className="mt-1">
                  <button
                    onClick={() => handleSelect('/servers')}
                    className="flex w-full items-center justify-between rounded-full px-3.5 py-2 text-xs transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center">
                      <Server className="mr-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">
                        {nodes[0]?.name || 'No host connected'}
                      </span>
                      {nodes[0]?.network?.publicIp && nodes[0].network.publicIp !== nodes[0].name && (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                          {nodes[0].network.publicIp}
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${
                        nodes[0]?.status === 'online'
                          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                          : 'border-border/80 bg-secondary text-muted-foreground'
                      }`}
                    >
                      {(nodes[0]?.status || 'unknown').toUpperCase()}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border/80 bg-background/50 px-4 py-2.5 text-[10px] text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Command className="h-3 w-3" />
                <span>Workspace Command Explorer</span>
              </div>
              <span>Esc to dismiss</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
