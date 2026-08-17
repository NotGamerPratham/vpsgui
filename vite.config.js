import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

// package.json declares "type": "module", so __dirname is not defined in this scope.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Documented dev port (see CLAUDE.md / README). This was 3000, which contradicted the docs and
    // collided with the `preview` server below.
    port: 3001,
    strictPort: true,
    host: true,
    proxy: {
      // Forward API calls to a locally running agent so `npm run dev` works same-origin, exactly as
      // nginx does in production. Override the target with VITE_AGENT_ORIGIN if the agent is elsewhere.
      '/api/v1': {
        target: process.env.VITE_AGENT_ORIGIN || 'http://127.0.0.1:46509',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 700,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Everything landed in one ~950 kB chunk, so the whole charting and animation stack blocked
        // first paint. Splitting the heavy, rarely-changing vendors lets them cache independently
        // of app code.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
