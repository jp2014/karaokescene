import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { fileURLToPath } from 'node:url';

const apiTarget = process.env.API_URL ?? 'http://localhost:8787';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: { alias: { '~': fileURLToPath(new URL('./src', import.meta.url)) } },
  // host: true so phones on the same Wi-Fi can open the app (and scan real QR codes).
  server: { port: 5173, host: true, proxy: { '/api': apiTarget } },
  // MapLibre alone is ~800kB; it's lazy-loaded with the Discover route.
  build: { chunkSizeWarningLimit: 1200 },
  preview: { proxy: { '/api': apiTarget } },
});
