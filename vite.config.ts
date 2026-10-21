import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The dev server proxies /api and /hubs to the backend, so the browser makes same-origin
// requests and CORS never enters the picture during development. The API base URL is
// therefore just the empty string in dev; a production build reads VITE_API_BASE_URL.
//
// Values come from the env files, never from this file: shared defaults in .env, a developer's
// own in .env.local (git-ignored), e.g. VITE_DEV_API_TARGET=http://localhost:5280 for
// `dotnet run`. See README.md.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const apiTarget = env.VITE_DEV_API_TARGET || 'https://localhost:55844';
  const port = Number(env.VITE_DEV_PORT) || 5173;

  return {
    // Path the app is served under: "/" by default, "/VPS/" for the IIS layout (.env.iis).
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port,
      proxy: {
        // secure: false lets the dev proxy talk to a local API on a self-signed HTTPS port.
        '/api': { target: apiTarget, changeOrigin: true, secure: false },
        '/hubs': { target: apiTarget, changeOrigin: true, secure: false, ws: true },
      },
      fs: {
        // Developer notes and other non-app files in this repository are never served, even by
        // the dev server (Vite's own defaults for .env and certificates are kept).
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/*.{md,doc,docx,xls,xlsx,sql,log,bak}'],
      },
    },
  };
});
