import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The marketing site is fully static: no agent, no API proxy, no tokens.
// It is deliberately decoupled from the app in ../src so it can be hosted
// on any CDN while the console stays behind the operator's firewall.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  css: {
    // Vite searches parent directories for a PostCSS config, and the repo root
    // has one wired to the console's Tailwind v3. This site is on v4 via the
    // plugin above, so an explicit empty config stops that search — without it
    // the v3 plugin runs first and rejects @layer base.
    postcss: { plugins: [] },
  },
  server: {
    // The preview harness assigns a free port via PORT; 3007 is just the
    // default for a plain `npm run dev`.
    port: Number(process.env.PORT) || 3007,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
