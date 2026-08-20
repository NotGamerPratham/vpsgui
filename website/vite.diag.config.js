/**
 * Diagnostic build config. Not used by `npm run build`.
 *
 * The production bundle ships React's minified build, so a hydration mismatch
 * prints "Minified React error #425" and nothing else. This config forces the
 * development build, which prints the actual mismatched text and the component
 * stack that produced it.
 *
 *   npx vite build -c vite.diag.config.js
 *   npx vite build -c vite.diag.config.js --ssr src/entry-server.tsx --outDir dist-ssr
 *   node scripts/prerender.mjs
 *   npm run preview
 *
 * Then read the console. Rebuild with `npm run build` afterwards - the bundle
 * this produces is ~3x larger and must never be deployed.
 */
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(process.cwd(), 'src') } },
  // The repo root has a PostCSS config wired to the console's Tailwind v3.
  css: { postcss: { plugins: [] } },
  define: { 'process.env.NODE_ENV': '"development"' },
  build: { outDir: 'dist', minify: false, sourcemap: false },
});
