import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { applyMigrations } from "../db/migration-runner";
import { verifyTestDatabase } from "./test-database";

const directory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(directory, "../db/migrations");

async function main(): Promise<void> {
  const verified = await verifyTestDatabase();
  const pool = new Pool({
    connectionString: verified.connectionString,
    max: 1,
  });
  const client = await pool.connect();
  try {
    const state = await client.query<{
      has_history: boolean;
      existing_table_count: number;
    }>(`
      SELECT to_regclass(format('%I.schema_migrations', current_schema())) IS NOT NULL AS has_history,
             (SELECT count(*)::int
              FROM information_schema.tables
              WHERE table_schema = current_schema() AND table_type = 'BASE TABLE') AS existing_table_count
    `);
    const current = state.rows[0];
    if (!current?.has_history && current?.existing_table_count > 0) {
      const existingTables = await client.query<{ table_name: string }>(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      throw new Error(
        `Refusing migration: schema ${verified.identity.schema} has existing tables but no migration history (${existingTables.rows.map((row) => row.table_name).join(", ")}). No changes were made. Use a new disposable test database.`,
      );
    }

    console.log(
      `Verified test target: ${verified.identity.label} (${verified.identity.host}/${verified.identity.database}, schema ${verified.identity.schema}, server ${verified.identity.serverAddress || "address unavailable"}).`,
    );
    console.log(
      "Warning: migration 004_demo_seed.sql inserts demonstration users, products, categories, and settings.",
    );
    if (!fs.existsSync(migrationsDirectory))
      throw new Error("Migration directory was not found.");
    await applyMigrations(client, migrationsDirectory, (message) =>
      console.log(message),
    );
    console.log(
      "Migration history verified against all checked-in migration files.",
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Test database migration failed.",
  );
  process.exitCode = 1;
});
