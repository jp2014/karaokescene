import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiTarget = process.env.API_URL ?? 'http://localhost:8787';

/**
 * The before/after page for each change round (apps/web/changes, see scripts/changes).
 * Development only: `pnpm dev` serves it at /changes/; it is never part of a build.
 */
function changesPage(): Plugin {
  const root = fileURLToPath(new URL('./changes', import.meta.url));
  const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };
  return {
      name: 'ks-changes-page',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use('/changes', (req, res, next) => {
          const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
          if (req.originalUrl?.split('?')[0] === '/changes') {
            res.writeHead(301, { location: '/changes/' }).end();
            return;
          }
          const file = join(root, normalize(path === '/' ? '/index.html' : path));
          if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
          createReadStream(file).pipe(res);
        });
      },
    };
  }

  /**
   * __DEMO__ turns on the persona sign-in, Demo controls and simulated location/scans. It is
   * on for `vite` (dev) and for builds with VITE_DEMO=true (`pnpm start`), and off for real
   * deploys, where the demo code is dropped from the bundle entirely.
   */
  /** Guard: a real (non-demo) build must not contain demo-only code or copy. */
  function noDemoInBuild(): Plugin {
    const markers = ['usr_jess', '/api/demo', 'Demo:', 'for this demo', 'demo account'];
    return {
      name: 'ks-no-demo-in-build',
      apply: 'build',
      generateBundle(_, bundle) {
        const leaks = Object.values(bundle).flatMap((f) => {
          const text = f.type === 'chunk' ? f.code : typeof f.source === 'string' ? f.source : '';
          return markers.filter((m) => text.includes(m)).map((m) => `${f.fileName}: "${m}"`);
        });
        if (leaks.length) this.error(`Production build contains demo-only code:\n  ${leaks.join('\n  ')}`);
      },
    };
  }

  export default defineConfig(({ command, mode }) => {
    const demo = command === 'serve' || loadEnv(mode, process.cwd()).VITE_DEMO === 'true' || process.env.VITE_DEMO === 'true';
    return {
    define: { __DEMO__: JSON.stringify(demo) },
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), changesPage(), ...(demo ? [] : [noDemoInBuild()])],
    resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
    // host: true so phones on the same Wi-Fi can open the app (and scan real QR codes).
    server: { port: 5173, host: true, proxy: { '/api': apiTarget } },
    // MapLibre alone is ~800kB; it's lazy-loaded with the Discover route.
    build: { chunkSizeWarningLimit: 1200 },
    preview: { proxy: { '/api': apiTarget } },
  };
});
