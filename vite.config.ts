import type { Connect } from 'vite';
import product from './api/product.ts';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const productApi: Connect.NextHandleFunction = (req, res, next) => {
  if (req.url?.split('?')[0] === '/api/product') void product(req, res);
  else next();
};
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'zaeme-produktabfrage',
      configureServer(server) {
        server.middlewares.use(productApi);
      },
      configurePreviewServer(server) {
        server.middlewares.use(productApi);
      },
    },
  ],
  build: { license: { fileName: 'drittlizenzen.txt' } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
