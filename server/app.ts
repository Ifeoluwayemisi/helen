import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { checkDatabaseConnection } from './db/pool';
import { config } from './config';
import { catalogRoutes } from './routes/catalog.routes';
import { authRoutes } from './routes/auth.routes';
import { staffRoutes } from './routes/staff.routes';
import { inventoryRoutes } from './routes/inventory.routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    },
  });

  // Enable CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Enable Cookie parsing & signing
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'hellen-store-secure-cookie-secret-key-2026',
  });

  // Health endpoint: GET /api/health
  app.get('/api/health', async (_request, reply) => {
    const dbStatus = await checkDatabaseConnection();

    return reply.status(200).send({
      status: 'ok',
      service: 'hellen-store-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: {
        configured: Boolean(config.databaseUrl),
        connected: dbStatus.connected,
        latencyMs: dbStatus.latencyMs,
        error: dbStatus.error,
      },
    });
  });

  // Catalog read routes: GET /api/products, /api/categories, /api/settings
  await app.register(catalogRoutes);

  // Auth routes: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, setup
  await app.register(authRoutes);

  // Staff management & audit routes: GET/POST/PATCH /api/staff, GET /api/audit-logs
  await app.register(staffRoutes);

  // Inventory & stock ledger routes: POST /api/inventory/receive, /api/inventory/adjust, GET /api/inventory/movements
  await app.register(inventoryRoutes);

  return app;
}
