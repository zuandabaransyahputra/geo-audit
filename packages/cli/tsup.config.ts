import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  clean: true,
  // The core package is private: bundle it, keep its npm dependencies external.
  noExternal: ['@geo-audit/core'],
  banner: { js: '#!/usr/bin/env node' },
});
