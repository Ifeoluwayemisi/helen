import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { PoolClient } from "pg";
import { applyMigrations } from "../db/migration-runner";
import { isProductionDisabledMigration } from "../db/migration-policy";

const DEMO_SEED_MARKER = "DEMO_SEED_MARKER";

interface RecordedMigration {
  filename: string;
  skipped: boolean;
}

function createFixtureDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "hellen-migrations-"));
  fs.writeFileSync(
    path.join(directory, "001_init.sql"),
    "CREATE TABLE demo_marker (id integer);",
  );
  fs.writeFileSync(
    path.join(directory, "004_demo_seed.sql"),
    `INSERT INTO demo_marker VALUES (1); -- ${DEMO_SEED_MARKER}`,
  );
  fs.writeFileSync(
    path.join(directory, "006_later.sql"),
    "ALTER TABLE demo_marker ADD COLUMN note text;",
  );
  return directory;
}

function createStubClient(recorded: RecordedMigration[]) {
  const executedSql: string[] = [];
  const client = {
    async query(text: string, params?: unknown[]) {
      if (/to_regclass/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/CREATE TABLE IF NOT EXISTS schema_migrations/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/ALTER TABLE schema_migrations/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/SELECT filename FROM schema_migrations/i.test(text)) {
        return {
          rows: recorded.map((entry) => ({ filename: entry.filename })),
          rowCount: recorded.length,
        };
      }
      if (/^\s*(BEGIN|COMMIT|ROLLBACK)\s*$/i.test(text)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO schema_migrations/i.test(text)) {
        recorded.push({
          filename: String(params?.[0]),
          skipped: /\bskipped\b/i.test(text),
        });
        return { rows: [], rowCount: 0 };
      }
      executedSql.push(text);
      return { rows: [], rowCount: 0 };
    },
  };
  return { client: client as unknown as PoolClient, executedSql };
}

test("production migration policy disables only the demo seed migration", () => {
  assert.equal(
    isProductionDisabledMigration("004_demo_seed.sql", "production"),
    true,
  );
  assert.equal(
    isProductionDisabledMigration("004_demo_seed.sql", "development"),
    false,
  );
  assert.equal(isProductionDisabledMigration("001_init.sql", "production"), false);
  assert.equal(isProductionDisabledMigration("006_later.sql", "production"), false);
});

test("production runs record 004 as skipped, leave its SQL unexecuted, and keep history intact", async () => {
  const directory = createFixtureDirectory();
  const recorded: RecordedMigration[] = [];
  const { client, executedSql } = createStubClient(recorded);
  const reports: string[] = [];
  try {
    const applied = await applyMigrations(
      client,
      directory,
      (message) => reports.push(message),
      {
        skip: (file) => isProductionDisabledMigration(file, "production"),
      },
    );

    assert.deepEqual(applied, [
      "001_init.sql",
      "004_demo_seed.sql",
      "006_later.sql",
    ]);
    assert.deepEqual(recorded, [
      { filename: "001_init.sql", skipped: false },
      { filename: "004_demo_seed.sql", skipped: true },
      { filename: "006_later.sql", skipped: false },
    ]);
    assert.ok(
      reports.includes(
        "[Skipped] 004_demo_seed.sql (excluded by this environment's migration policy)",
      ),
      "the skip policy message should be reported",
    );
    assert.ok(
      !executedSql.some((sql) => sql.includes(DEMO_SEED_MARKER)),
      "the demo seed migration SQL must never be executed in production",
    );
    assert.ok(
      executedSql.some((sql) => sql.includes("demo_marker")),
      "other migrations must still execute",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("non-production runs apply 004 through the normal path without the skipped flag", async () => {
  const directory = createFixtureDirectory();
  const recorded: RecordedMigration[] = [];
  const { client, executedSql } = createStubClient(recorded);
  const reports: string[] = [];
  try {
    const applied = await applyMigrations(
      client,
      directory,
      (message) => reports.push(message),
      {
        skip: (file) => isProductionDisabledMigration(file, "development"),
      },
    );

    assert.deepEqual(applied, [
      "001_init.sql",
      "004_demo_seed.sql",
      "006_later.sql",
    ]);
    assert.deepEqual(recorded, [
      { filename: "001_init.sql", skipped: false },
      { filename: "004_demo_seed.sql", skipped: false },
      { filename: "006_later.sql", skipped: false },
    ]);
    assert.ok(reports.includes("[Applying] 004_demo_seed.sql"));
    assert.ok(
      executedSql.some((sql) => sql.includes(DEMO_SEED_MARKER)),
      "the demo seed migration SQL should execute outside production",
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
