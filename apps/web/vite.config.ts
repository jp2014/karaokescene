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
export default defineConfig(({ command, mode }) => ({
  define: { __DEMO__: JSON.stringify(command === 'serve' || loadEnv(mode, process.cwd()).VITE_DEMO === 'true' || process.env.VITE_DEMO === 'true') },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), changesPage()],
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  // host: true so phones on the same Wi-Fi can open the app (and scan real QR codes).
  server: { port: 5173, host: true, proxy: { '/api': apiTarget } },
  // MapLibre alone is ~800kB; it's lazy-loaded with the Discover route.
  build: { chunkSizeWarningLimit: 1200 },
  preview: { proxy: { '/api': apiTarget } },
}));
