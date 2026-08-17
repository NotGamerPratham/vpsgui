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
  Zap,
} from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useServerStore } from '../../store/useServerStore';

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const { nodes } = useServerStore();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
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

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-50 w-full max-w-2xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-border px-4 py-3 bg-muted/30">
              <Search className="h-5 w-5 text-primary mr-3 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tools, containers, files... (Esc to close)"
                className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
              <button onClick={() => setCommandPaletteOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
              <div>
                <h5 className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Commands</h5>
                <div className="space-y-1 mt-1">
                  <button
                    onClick={() => handleSelect('/terminal')}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors group"
                  >
                    <Terminal className="h-4 w-4 mr-2.5 text-cyan-400" />
                    <span className="font-medium">Open SSH Split Workbench Terminal</span>
                  </button>
                  <button
                    onClick={() => handleSelect('/files')}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors group"
                  >
                    <FolderTree className="h-4 w-4 mr-2.5 text-violet-400" />
                    <span className="font-medium">Open VPS File Manager</span>
                  </button>
                  <button
                    onClick={() => handleSelect('/catalog')}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-xs hover:bg-primary/10 hover:text-primary transition-colors group"
                  >
                    <Box className="h-4 w-4 mr-2.5 text-emerald-400" />
                    <span className="font-medium">Deploy Application from Catalog</span>
                  </button>
                </div>
              </div>

              {/* Host VPS Node */}
              <div>
                <h5 className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Host VPS</h5>
                <div className="space-y-1 mt-1">
                  <button
                    onClick={() => handleSelect('/servers')}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center">
                      <Server className="h-4 w-4 mr-2.5 text-primary" />
                      <span className="font-medium text-foreground">{nodes[0]?.name || 'vps128'}</span>
                      <span className="ml-2 font-mono text-[10px] text-muted-foreground">({nodes[0]?.network?.publicIp || '127.0.0.1'})</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        nodes[0]?.status === 'online'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-muted-foreground bg-muted/20 border-border/60'
                      }`}
                    >
                      {(nodes[0]?.status || 'unknown').toUpperCase()}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer info */}
            <div className="flex items-center justify-between border-t border-border px-4 py-2 bg-muted/40 text-[10px] text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>Spotlight Live Host Search</span>
              </div>
              <span>Use ↑ ↓ to navigate, Enter to select</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
