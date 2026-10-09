import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: true,
    open: true
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        callback: resolve(__dirname, 'src/callback.html')
      }
    }
  },
  plugins: [
    {
      name: 'spotify-callback-rewrite',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Spotify redirects to http://127.0.0.1:5173/callback?code=...
          // Serve the callback page stored under src/ while keeping Spotify's URI at /callback.
          if (req.url) {
            const parsed = new URL(req.url, 'http://127.0.0.1:5173');
            if (parsed.pathname === '/callback') {
              req.url = '/src/callback.html' + parsed.search;
            }
          }
          next();
        });
      }
    }
  ]
});
