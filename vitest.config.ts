import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // jsdom would be needed for component tests; these cover services, the agent, and pure logic.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The agent-server suite boots a real HTTP daemon on a fixed port, so files must not run
    // concurrently and race for it.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
