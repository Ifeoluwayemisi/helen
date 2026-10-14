import fs from "node:fs";
import path from "node:path";
import { PoolClient } from "pg";

export interface MigrationRunOptions {
  skip?: (filename: string) => boolean;
}

export async function applyMigrations(
  client: PoolClient,
  migrationsDirectory: string,
  report: (message: string) => void = console.log,
  options: MigrationRunOptions = {},
): Promise<string[]> {
  const files = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const knownFiles = new Set(files);
  const tracking = await client.query<{ table_exists: boolean }>(
    `SELECT to_regclass(format('%I.schema_migrations', current_schema())) IS NOT NULL AS table_exists`,
  );
  if (tracking.rows[0]?.table_exists) {
    const history = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations ORDER BY filename",
    );
    const unknown = history.rows
      .map((row) => row.filename)
      .filter((file) => !knownFiles.has(file));
    if (unknown.length)
      throw new Error(
        `Database migration history contains files absent from this checkout: ${unknown.join(", ")}`,
      );
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      skipped BOOLEAN NOT NULL DEFAULT FALSE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`
    ALTER TABLE schema_migrations
      ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT FALSE
  `);
  const history = await client.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations",
  );
  const executed = new Set(history.rows.map((row) => row.filename));

  for (const file of files) {
    if (executed.has(file)) {
      report(`[Skipped] ${file} (already recorded)`);
      continue;
    }
    if (options.skip?.(file)) {
      report(`[Skipped] ${file} (excluded by this environment's migration policy)`);
      await client.query(
        `INSERT INTO schema_migrations (filename, skipped) VALUES ($1, TRUE)
         ON CONFLICT (filename) DO NOTHING`,
        [file],
      );
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDirectory, file), "utf8");
    report(`[Applying] ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file],
      );
      await client.query("COMMIT");
      report(`[Applied] ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  const finalHistory = await client.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations ORDER BY filename",
  );
  const recorded = new Set(finalHistory.rows.map((row) => row.filename));
  const missing = files.filter((file) => !recorded.has(file));
  if (missing.length)
    throw new Error(
      `Migration history verification failed; missing: ${missing.join(", ")}`,
    );
  return files;
}
