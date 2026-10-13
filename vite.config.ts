import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

function fastifyApiPlugin() {
  let fastifyAppPromise: Promise<any> | null = null;
  return {
    name: 'fastify-api-middleware',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
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
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    if (!env.COOKIE_SECRET || env.COOKIE_SECRET.length < 32) {
      throw new Error('Production builds require COOKIE_SECRET with at least 32 characters.');
    }
    if (!env.CORS_ORIGINS?.trim()) {
      throw new Error('Production builds require CORS_ORIGINS with approved frontend origins.');
    }
    if (!env.DATABASE_URL?.trim()) {
      throw new Error('Production builds require a server-side DATABASE_URL.');
    }
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
