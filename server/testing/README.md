# PostgreSQL Integration Tests

These commands are for a dedicated disposable PostgreSQL database or isolated Neon test branch only. Never point them at the live business database.

## Required identity settings

Provide these to the test process without placing credentials in source control or chat:

- `TEST_DATABASE_URL`: PostgreSQL URL for the disposable database. The integration harness never falls back to `DATABASE_URL`.
- `TEST_DATABASE_EXPECTED_HOST`: exact hostname in the test URL.
- `TEST_DATABASE_EXPECTED_NAME`: exact PostgreSQL database name.
- `TEST_DATABASE_EXPECTED_SCHEMA`: schema returned by `current_schema()` (usually `public`).
- `TEST_DATABASE_IDENTITY`: human-readable test target label that includes `test` or `integration` and identifies the isolated branch/database.
- `TEST_DATABASE_EXPECTED_SERVER_ADDRESS`: optional exact `inet_server_addr()` value, when stable and available from the provider.

The guard connects using only `TEST_DATABASE_URL`, queries `current_database()`, `current_schema()`, and `inet_server_addr()`, and compares the host, database, and schema to the explicit expected values. It rejects production-looking identity strings and refuses missing or mismatched values. The returned server address is reported without credentials; providers may return `NULL` or change addresses. A database name and hostname comparison cannot prove organizational isolation or establish who owns a Neon branch. Use a separately created disposable database/branch, record its provider-side branch identity, and verify its lifecycle/access outside this process as well.

## Apply migrations

From a newly created empty test database, run:

```powershell
npm run db:test:migrate
```

The command checks the configured identity before connecting for mutation, refuses a schema containing tables without migration history, applies checked-in migrations in sorted order and records each migration transactionally. It never drops, truncates, or resets tables. Migration `004_demo_seed.sql` intentionally inserts demonstration staff, products, categories, and business settings into the disposable test database.

If migrations already exist, their history must contain only migration filenames present in this checkout. The runner skips recorded files and verifies the final history. It does not repair or rewrite applied migrations.

## Run tests

After migrations complete against the same verified disposable database:

```powershell
npm run test:integration
```

A missing or mismatched test identity fails the command before fixtures are inserted. The integration suite uses the real Fastify app, PostgreSQL pool, auth middleware, and checkout routes. Fixtures are unique per process and cleanup is limited to those fixture IDs. The forced rollback test creates a trigger scoped to its one fixture product and removes it during teardown. Do not run concurrent copies of the suite against the same database.

Database-free calculation and unauthenticated-route tests remain separate:

```powershell
npm run test:checkout
```
