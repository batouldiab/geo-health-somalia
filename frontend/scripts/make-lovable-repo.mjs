// Assemble the layout an app builder such as Lovable expects — one Vite project at the root of
// the repository, data under public/ — into <repo>/_lovable/ (git-ignored). Nothing in the
// project changes; run it again after every change here, then copy _lovable/* into the
// repository Lovable created and push. See docs/deploy-lovable.md.
//
//   node scripts/make-lovable-repo.mjs            # from frontend/
//   node scripts/make-lovable-repo.mjs --remote-voice   # also sets VITE_VOICE_REMOTE=1 (model from Hugging Face)
//
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(frontend, '..');
const out = path.join(repo, '_lovable');
const remoteVoice = process.argv.includes('--remote-voice');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// the project files, at the root
for (const f of ['index.html', 'finder.html', 'package.json', 'package-lock.json', 'tsconfig.json']) cpSync(path.join(frontend, f), path.join(out, f));
cpSync(path.join(frontend, 'src'), path.join(out, 'src'), { recursive: true });
cpSync(path.join(frontend, 'scripts'), path.join(out, 'scripts'), { recursive: true });
// public/: the service worker, icons, manifest, the speech model and runtime (when present) and the data files
cpSync(path.join(frontend, 'public'), path.join(out, 'public'), {
  recursive: true,
  filter: (src) => !(remoteVoice && (src.includes(path.sep + 'models') || src.includes(path.sep + 'ort'))),
});
cpSync(path.join(repo, 'data'), path.join(out, 'public', 'data'), { recursive: true });
// the documents the judges read, so the repository explains itself
mkdirSync(path.join(out, 'docs'), { recursive: true });
for (const f of ['video-script.md', 'responsible-ai.md', 'offline-package.md', 'evaluation.md']) {
  if (existsSync(path.join(repo, 'docs', f))) cpSync(path.join(repo, 'docs', f), path.join(out, 'docs', f));
}
cpSync(path.join(repo, 'README.md'), path.join(out, 'README.md'));
cpSync(path.join(repo, 'pipeline', 'sources.yaml'), path.join(out, 'docs', 'sources.yaml'));

// vite.config.ts without the ../data plugins: public/data is served at /data and copied to dist by Vite itself
writeFileSync(path.join(out, 'vite.config.ts'), `import { defineConfig, loadEnv, type Plugin } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// in remote voice mode (VITE_VOICE_REMOTE=1 in .env) the ONNX runtime comes from onnxruntime-web's
// CDN copy, so the 27 MB .wasm the bundler emits for it is never requested: leave it out of the build
function dropBundledRuntime(remoteVoice: boolean): Plugin {
  return {
    name: 'drop-bundled-runtime',
    apply: 'build',
    generateBundle(_, bundle) {
      if (!remoteVoice) return;
      for (const name of Object.keys(bundle)) if (/ort-wasm.*\.wasm$/.test(name)) delete bundle[name];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [dropBundledRuntime(loadEnv(mode, here, '').VITE_VOICE_REMOTE === '1')],
  // the app builder's preview reaches the dev server on port 8080, on every interface, through its own host name
  server: { host: '::', port: 8080, allowedHosts: true },
  preview: { host: '::', port: 8080, allowedHosts: true },
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
        main: path.resolve(here, 'index.html'),
        finder: path.resolve(here, 'finder.html'),
      },
    },
  },
}));
`);

// package.json: a Node version for the builder, and a build that does not need a separate typecheck step
const pkg = JSON.parse(readFileSync(path.join(out, 'package.json'), 'utf8'));
pkg.name = 'geo-health-bakool';
pkg.engines = { node: '>=22' };
pkg.scripts.build = 'vite build';
writeFileSync(path.join(out, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// onnxruntime-node (a dependency of transformers.js) tries to download GPU binaries after install; the
// browser build never uses them, and a builder's sandbox may not allow the download
writeFileSync(path.join(out, '.npmrc'), 'onnxruntime-node-install-cuda=skip\n');
if (remoteVoice) writeFileSync(path.join(out, '.env'), '# the speech model and runtime come from Hugging Face and onnxruntime-web\'s CDN on first use (see src/finder/speech.ts)\nVITE_VOICE_REMOTE=1\n');
writeFileSync(path.join(out, '.gitignore'), 'node_modules/\ndist/\n');

console.log(`Lovable layout written to ${out}${remoteVoice ? ' (remote voice: no model files included)' : ''}.`);
console.log('Next: copy everything in it into the repository Lovable created, commit, push to main, then Publish in Lovable (docs/deploy-lovable.md).');
