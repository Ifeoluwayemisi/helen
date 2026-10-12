import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getClient, closePool } from './pool';
import { config } from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  if (!config.databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not configured in your environment.');
    console.error('   Please provide a valid PostgreSQL connection string in .env before running migrations.');
    process.exit(1);
  }

  console.log('🚀 Connecting to PostgreSQL database for migration check...');
  let client;
  try {
    client = await getClient();
  } catch (err: unknown) {
    console.error('❌ Failed to connect to database:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Read executed migrations
    const res = await client.query('SELECT filename FROM schema_migrations;');
    const executedMigrations = new Set(res.rows.map((r: { filename: string }) => r.filename));

    // 3. Find migration files in server/db/migrations
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️  No migrations directory found at', migrationsDir);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migration files.`);

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`  ✓ [Skipped] ${file} (already executed)`);
        continue;
      }

      console.log(`  ⏳ [Applying] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Execute inside transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [file]);
        await client.query('COMMIT');
        console.log(`  ✅ [Applied]  ${file}`);
      } catch (migrationErr: unknown) {
        await client.query('ROLLBACK');
        console.error(`  ❌ [Failed]   ${file}:`, migrationErr instanceof Error ? migrationErr.message : migrationErr);
        throw migrationErr;
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } finally {
    client.release();
    await closePool();
  }
}

// Run if executed directly
runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
