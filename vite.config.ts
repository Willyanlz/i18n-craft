import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import handler from './api/translate';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-translation-api',
      configureServer(server) {
        server.middlewares.use('/api/translate', (req, res) => {
          void handler(req, res);
        });
      },
    },
  ],
});
