import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { fileURLToPath } from 'node:url';

const apiTarget = process.env.API_URL ?? 'http://localhost:8787';

/**
 * __DEMO__ turns on the persona sign-in, Demo controls and simulated location/scans. It is
 * on for `vite` (dev) and for builds with VITE_DEMO=true (`pnpm start`), and off for real
 * deploys, where the demo code is dropped from the bundle entirely.
 */
export default defineConfig(({ command, mode }) => ({
  define: { __DEMO__: JSON.stringify(command === 'serve' || loadEnv(mode, process.cwd()).VITE_DEMO === 'true' || process.env.VITE_DEMO === 'true') },
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  // host: true so phones on the same Wi-Fi can open the app (and scan real QR codes).
  server: { port: 5173, host: true, proxy: { '/api': apiTarget } },
  // MapLibre alone is ~800kB; it's lazy-loaded with the Discover route.
  build: { chunkSizeWarningLimit: 1200 },
  preview: { proxy: { '/api': apiTarget } },
}));
