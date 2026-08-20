import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The server build, plus prerendering as its final step.
 *
 * Prerendering used to be a separate `node scripts/prerender.mjs` command in the
 * build script. That hardcoded the runtime: `bun run build` invoked the real
 * Node for it (Bun does not shim `node` inside `bun run`), so a machine with
 * only Bun installed could not build the site at all.
 *
 * Running it from `closeBundle` instead means whichever runtime is executing
 * Vite also does the prerender - Node under npm, Bun under bun, no branch.
 */
function prerenderPlugin()
{
  return {
    name: 'vpsgui-prerender',
    apply: 'build',
    closeBundle: {
      sequential: true,
      order: 'post',
      async handler()
      {
        // Imported for its side effects, after the SSR bundle is on disk.
        //
        // An absolute file:// URL, built at runtime and marked @vite-ignore, so
        // Rollup does not try to resolve it as part of the bundle - Vite
        // transpiles this config to a temp file, against which a relative path
        // points at the wrong directory. The query string defeats the module
        // cache so a watch rebuild re-runs it.
        const entry = pathToFileURL(path.resolve(process.cwd(), 'scripts/prerender.mjs'));
        await import(/* @vite-ignore */ `${entry.href}?t=${Date.now()}`);
      },
    },
  };
}

export default defineConfig({
  // No Tailwind plugin here: the stylesheet is emitted by the client build and
  // linked from the template, so pulling it into the SSR bundle would only
  // produce a second copy that is immediately discarded.
  plugins: [react(), prerenderPlugin()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  // The repo root carries a PostCSS config wired to the console's Tailwind v3.
  css: { postcss: { plugins: [] } },
  build: {
    ssr: 'src/entry-server.tsx',
    outDir: 'dist-ssr',
    // The client build owns dist/; wiping it here would delete what we are
    // about to prerender into.
    emptyOutDir: true,
  },
});
