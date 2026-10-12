import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { checkDatabaseConnection } from './db/pool';
import { config } from './config';
import { catalogRoutes } from './routes/catalog.routes';

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

  return app;
}
