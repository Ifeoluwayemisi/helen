import { Client } from "pg";

export interface VerifiedTestDatabase {
  connectionString: string;
  identity: {
    label: string;
    host: string;
    database: string;
    schema: string;
    serverAddress: string | null;
  };
}

function requiredEnvironment(
  name: string,
  environment: NodeJS.ProcessEnv,
): string {
  const value = environment[name]?.trim();
  if (!value)
    throw new Error(
      `Set ${name} explicitly before running database integration work.`,
    );
  return value;
}

function rejectProtectedIdentity(value: string, field: string): void {
  if (/(^|[._-])(prod|production|live|primary)(?=$|[._-])/i.test(value)) {
    throw new Error(
      `${field} appears to identify a protected production database.`,
    );
  }
}

export async function verifyTestDatabase(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<VerifiedTestDatabase> {
  const connectionString = requiredEnvironment(
    "TEST_DATABASE_URL",
    environment,
  );
  const expectedHost = requiredEnvironment(
    "TEST_DATABASE_EXPECTED_HOST",
    environment,
  ).toLowerCase();
  const expectedDatabase = requiredEnvironment(
    "TEST_DATABASE_EXPECTED_NAME",
    environment,
  );
  const expectedSchema = requiredEnvironment(
    "TEST_DATABASE_EXPECTED_SCHEMA",
    environment,
  );
  const identityLabel = requiredEnvironment(
    "TEST_DATABASE_IDENTITY",
    environment,
  );
  const url = new URL(connectionString);

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname.slice(1)
  ) {
    throw new Error(
      "TEST_DATABASE_URL must be a PostgreSQL URL with an explicit host and database name.",
    );
  }
  if (!/\b(test|integration)\b/i.test(identityLabel)) {
    throw new Error(
      "TEST_DATABASE_IDENTITY must explicitly label a dedicated test database or isolated test branch.",
    );
  }
  rejectProtectedIdentity(identityLabel, "TEST_DATABASE_IDENTITY");
  rejectProtectedIdentity(expectedDatabase, "TEST_DATABASE_EXPECTED_NAME");
  rejectProtectedIdentity(expectedHost, "TEST_DATABASE_EXPECTED_HOST");
  if (url.hostname.toLowerCase() !== expectedHost) {
    throw new Error(
      "TEST_DATABASE_URL host does not match TEST_DATABASE_EXPECTED_HOST.",
    );
  }
  if (decodeURIComponent(url.pathname.slice(1)) !== expectedDatabase) {
    throw new Error(
      "TEST_DATABASE_URL database does not match TEST_DATABASE_EXPECTED_NAME.",
    );
  }
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(expectedSchema)) {
    throw new Error(
      "TEST_DATABASE_EXPECTED_SCHEMA must be a simple PostgreSQL schema name.",
    );
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    const result = await client.query<{
      database_name: string;
      server_address: string | null;
      schema_name: string;
    }>(`
      SELECT current_database() AS database_name,
             inet_server_addr()::text AS server_address,
             current_schema() AS schema_name
    `);
    const row = result.rows[0];
    if (
      !row ||
      row.database_name !== expectedDatabase ||
      row.schema_name !== expectedSchema
    ) {
      throw new Error(
        "Connected PostgreSQL database or schema does not match the explicitly expected test identity.",
      );
    }
    const expectedServerAddress =
      environment.TEST_DATABASE_EXPECTED_SERVER_ADDRESS?.trim();
    if (expectedServerAddress && row.server_address !== expectedServerAddress) {
      throw new Error(
        "Connected PostgreSQL server address does not match TEST_DATABASE_EXPECTED_SERVER_ADDRESS.",
      );
    }
    if (
      row.server_address &&
      !expectedServerAddress &&
      !/\b(test|integration)\b/i.test(identityLabel)
    ) {
      throw new Error(
        "A server address was returned but the test target identity is not explicit.",
      );
    }
    return {
      connectionString,
      identity: {
        label: identityLabel,
        host: url.hostname,
        database: row.database_name,
        schema: row.schema_name,
        serverAddress: row.server_address,
      },
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Connected PostgreSQL")
    )
      throw error;
    if (error instanceof Error && error.message.startsWith("A server address"))
      throw error;
    if (error instanceof Error && error.message.startsWith("TEST_DATABASE_"))
      throw error;
    throw new Error(
      "Unable to verify the dedicated test database identity. Check the test connection and expected identity settings without sharing credentials.",
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
