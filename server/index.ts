import { buildApp } from './app';
import { config } from './config';
import { closePool } from './db/pool';

async function start() {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Gracefully shutting down Hellen Store server...`);
    try {
      await app.close();
      await closePool();
      app.log.info('Server and database pool closed successfully.');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n🟢 Hellen Store API Server running at http://${config.host}:${config.port}`);
    console.log(`👉 Health Check: http://${config.host}:${config.port}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
