import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getClient, closePool } from "./pool";
import { config } from "../config";
import { applyMigrations } from "./migration-runner";
import { isProductionDisabledMigration } from "./migration-policy";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  if (!config.databaseUrl) {
    console.error(
      "❌ Error: DATABASE_URL is not configured in your environment.",
    );
    console.error(
      "   Please provide a valid PostgreSQL connection string in .env before running migrations.",
    );
    process.exit(1);
  }

  console.log("🚀 Connecting to PostgreSQL database for migration check...");
  let client;
  try {
    client = await getClient();
  } catch (err: unknown) {
    console.error(
      "❌ Failed to connect to database:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  try {
    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log("⚠️  No migrations directory found at", migrationsDir);
      return;
    }
    await applyMigrations(
      client,
      migrationsDir,
      (message) => console.log(`  ${message}`),
      {
        skip: (file) => isProductionDisabledMigration(file, config.nodeEnv),
      },
    );
    console.log("🎉 All migrations completed successfully!");
  } finally {
    client.release();
    await closePool();
  }
}

// Run if executed directly
runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
