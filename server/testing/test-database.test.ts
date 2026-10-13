import assert from "node:assert/strict";
import test from "node:test";
import { verifyTestDatabase } from "./test-database";

test("test database guard refuses a missing dedicated test URL", async () => {
  await assert.rejects(verifyTestDatabase({}), /TEST_DATABASE_URL/);
});

test("test database guard refuses a URL host that differs from the expected host before connecting", async () => {
  await assert.rejects(
    verifyTestDatabase({
      TEST_DATABASE_URL:
        "postgresql://integration:placeholder@test-db.example.invalid/test_store",
      TEST_DATABASE_EXPECTED_HOST: "another-test-db.example.invalid",
      TEST_DATABASE_EXPECTED_NAME: "test_store",
      TEST_DATABASE_EXPECTED_SCHEMA: "public",
      TEST_DATABASE_IDENTITY: "isolated test branch",
    }),
    /host does not match/,
  );
});

test("test database guard refuses production-looking target labels before connecting", async () => {
  await assert.rejects(
    verifyTestDatabase({
      TEST_DATABASE_URL:
        "postgresql://integration:placeholder@test-db.example.invalid/production_store",
      TEST_DATABASE_EXPECTED_HOST: "test-db.example.invalid",
      TEST_DATABASE_EXPECTED_NAME: "production_store",
      TEST_DATABASE_EXPECTED_SCHEMA: "public",
      TEST_DATABASE_IDENTITY: "isolated test branch",
    }),
    /protected production database/,
  );
});
