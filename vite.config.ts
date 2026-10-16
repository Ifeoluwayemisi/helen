import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

// The repository's .env sets NODE_ENV=development so the API dev server can run.
// Vite would otherwise consume that value for `vite build`, emitting a development
// client bundle (dev React runtime + every `import.meta.env.PROD` guard bypassed).
// Force production mode for builds regardless of .env, without editing .env.
if (process.argv.includes('build')) {
  process.env.NODE_ENV = 'production';
  process.env.VITE_USER_NODE_ENV = 'production';
}

function fastifyApiPlugin() {
  let fastifyAppPromise: Promise<any> | null = null;

  // Shared handler used by both the dev server and `vite preview`. Without
  // registering this for preview, a built frontend has no `/api` backend and
  // every auth/session call fails with a bare 404.
  const handleApiRequest = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api')) {
      return next();
    }

    try {
      if (!fastifyAppPromise) {
        const { buildApp } = await import('./server/app.ts');
        fastifyAppPromise = buildApp();
      }
      const app = await fastifyAppPromise;

      // Collect body chunks if request has a payload
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const payload = chunks.length > 0 ? Buffer.concat(chunks).toString() : undefined;

      const response = await app.inject({
        method: req.method,
        url: req.url,
        headers: req.headers,
        payload,
      });

      res.statusCode = response.statusCode;
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) {
          res.setHeader(key, value);
        }
      }
      res.end(response.body);
    } catch (err: any) {
      console.error('[API Middleware Error]:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'Internal API Server Error' }));
    }
  };

  return {
    name: 'fastify-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(handleApiRequest);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handleApiRequest);
    },
  };
}

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    console.warn(
      '[build] This frontend build does not consume server secrets. The API server separately requires COOKIE_SECRET, CORS_ORIGINS, and DATABASE_URL at startup and fails closed if they are missing or invalid.',
    );
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      fastifyApiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Hellen Store POS & Inventory',
          short_name: 'HellenStore',
          description: 'Point of Sale & Inventory Management for Hellen Store supermarket operations.',
          theme_color: '#166534',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
