import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        // While the API is down (for example restarting after a code change), answer in the
        // API's own error format instead of an empty 500, so the app can explain and retry.
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res.headersSent || typeof res.writeHead !== 'function') return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                error: { code: 'SERVER_UNAVAILABLE', message: 'The API server is not responding.' },
              }),
            );
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { charts: ['recharts'], motion: ['framer-motion'] },
      },
    },
  },
});
