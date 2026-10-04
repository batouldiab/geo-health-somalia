import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');

const MIME: Record<string, string> = {
  '.json': 'application/json',
  '.gz': 'application/gzip',
  '.geojson': 'application/geo+json',
};

// Serve the repo-level data/ directory at /data in dev and preview (the build copies it into dist/data).
function serveData(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    const url = (req.url ?? '').split('?')[0];
    if (!url.startsWith('/data/')) return next();
    const file = path.join(DATA_DIR, path.normalize(url.slice('/data/'.length)));
    if (!file.startsWith(DATA_DIR) || !fs.existsSync(file)) return next();
    res.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  };
  return {
    name: 'serve-data',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

// Copy the repo-level data/ directory into dist/data at build time, so dist/ is a
// complete static site (any static host serves it; no API, no server-side code).
function copyData(): Plugin {
  return {
    name: 'copy-data',
    apply: 'build',
    closeBundle() {
      const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist', 'data');
      fs.mkdirSync(out, { recursive: true });
      for (const f of fs.readdirSync(DATA_DIR)) {
        if (/\.(json|gz|geojson)$/.test(f)) fs.copyFileSync(path.join(DATA_DIR, f), path.join(out, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [serveData(), copyData()],
  // transformers.js (speech in the finder) ships WebAssembly and workers that Vite's
  // dependency pre-bundling breaks; it is loaded as is
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
  build: {
    sourcemap: true,
    // two pages: the map (index.html) and the offline facility finder (finder.html)
    rollupOptions: {
      input: {
        main: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'index.html'),
        finder: path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'finder.html'),
      },
    },
  },
});
