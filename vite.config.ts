import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleDriveSyncPayload } from './api/drive-sync';

function driveSyncDevPlugin(): Plugin {
  return {
    name: 'drive-sync-api',
    configureServer(server) {
      server.middlewares.use('/api/drive-sync', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        let raw = '';
        req.on('data', (chunk) => {
          raw += String(chunk);
        });
        req.on('end', () => {
          void (async () => {
            try {
              const payload = JSON.parse(raw || '{}');
              const out = await handleDriveSyncPayload(payload);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(out));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: (e as Error).message }));
            }
          })();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), driveSyncDevPlugin()],
  server: { port: 5178, host: 'localhost' },
});
