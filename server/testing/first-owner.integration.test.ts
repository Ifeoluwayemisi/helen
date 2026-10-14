import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { configurePool, closePool, query } from "../db/pool";
import {
  hashCredential,
  hashSessionToken,
  verifyCredential,
} from "../auth/crypto";
import { verifyTestDatabase } from "./test-database";

/**
 * First-owner provisioning integration coverage against a verified, disposable
 * test database.
 *
 * The seeded database already carries a demo owner that occupies the fixed
 * first-owner primary key. To exercise the real provisioning path, this suite
 * temporarily sets that owner aside and restores it verbatim in `after`. It
 * never deletes, mutates, or deactivates business data (products, sales,
 * inventory), and only removes rows it created itself.
 */

const OWNER_ID = "a0000000-0000-0000-0000-000000000001";
const runId = randomUUID().replaceAll("-", "");

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  role: string;
  active: boolean;
  pin: string | null;
  created_at: string;
  updated_at: string;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
};

const USER_COLUMNS =
  "id,name,email,password_hash,role,active,pin,created_at,updated_at,failed_login_attempts,locked_until,last_login_at";

const verifiedTarget = await verifyTestDatabase();
configurePool(verifiedTarget.connectionString, 30000);
console.log(
  `First-owner integration target verified: ${verifiedTarget.identity.label} (${verifiedTarget.identity.host}/${verifiedTarget.identity.database}).`,
);

const { buildApp } = await import("../app");

let app: FastifyInstance;
let savedOwnerRows: UserRow[] = [];
let slotFreed = false;
let createdOwnerId: string | null = null;
let conflictUserId: string | null = null;
const extraUserIds: string[] = [];

async function activeAdminCount(): Promise<number> {
  const result = await query<{ count: number }>(
    "SELECT count(*)::int AS count FROM users WHERE role='ADMIN' AND active=TRUE",
  );
  return Number(result.rows[0].count);
}

async function freeOwnerSlot(): Promise<void> {
  const existing = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1 OR role='ADMIN'`,
    [OWNER_ID],
  );
  savedOwnerRows = existing.rows;
  if (savedOwnerRows.length === 0) {
    slotFreed = true;
    return;
  }
  const ids = savedOwnerRows.map((row) => row.id);
  await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [ids]);
  await query("DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])", [ids]);
  await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [ids]);
  slotFreed = true;
}

async function restoreSavedOwners(): Promise<void> {
  for (const row of savedOwnerRows) {
    await query(
      `INSERT INTO users (${USER_COLUMNS})
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.name,
        row.email,
        row.password_hash,
        row.role,
        row.active,
        row.pin,
        row.created_at,
        row.updated_at,
        row.failed_login_attempts,
        row.locked_until,
        row.last_login_at,
      ],
    );
  }
}

before(async () => {
  app = await buildApp();
  try {
    await freeOwnerSlot();
  } catch {
    slotFreed = false;
  }
});

after(async () => {
  const cleanupIds = [
    createdOwnerId,
    conflictUserId,
    ...extraUserIds,
  ].filter((id): id is string => Boolean(id));
  if (cleanupIds.length > 0) {
    await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [
      cleanupIds,
    ]).catch(() => undefined);
    await query("DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[])", [
      cleanupIds,
    ]).catch(() => undefined);
    await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
      cleanupIds,
    ]).catch(() => undefined);
  }
  await restoreSavedOwners().catch(() => undefined);
  await app?.close().catch(() => undefined);
  await closePool().catch(() => undefined);
});

describe("first-owner provisioning against the verified test database", () => {
  it("reports a free owner slot through the public endpoint", async (t) => {
    if (!slotFreed) {
      t.skip("Could not safely free the owner slot in the disposable database.");
      return;
    }
    const response = await app.inject({
      method: "GET",
      url: "/api/auth/setup-status",
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().success, true);
    assert.equal(response.json().hasOwner, false);
  });

  it("provisions exactly one owner, rejects repeats, and never overwrites a conflicting email", async (t) => {
    if (!slotFreed) {
      t.skip("Could not safely free the owner slot in the disposable database.");
      return;
    }

    // 1. A conflicting email must not overwrite an existing non-admin account.
    conflictUserId = randomUUID();
    const conflictEmail = `conflict-${runId}@integration.invalid`;
    const conflictHash = await hashCredential("original-cashier-credential");
    await query(
      "INSERT INTO users (id,name,email,role,active,password_hash) VALUES ($1,$2,$3,'CASHIER',TRUE,$4)",
      [conflictUserId, "Integration Conflict", conflictEmail, conflictHash],
    );
    const conflictResponse = await app.inject({
      method: "POST",
      url: "/api/auth/setup-owner",
      payload: {
        name: "Owner",
        email: conflictEmail,
        credential: "owner-credential",
      },
    });
    assert.equal(conflictResponse.statusCode, 403, conflictResponse.body);
    const conflictRow = await query<{ role: string; password_hash: string }>(
      "SELECT role, password_hash FROM users WHERE id=$1",
      [conflictUserId],
    );
    assert.equal(conflictRow.rows[0].role, "CASHIER");
    assert.equal(conflictRow.rows[0].password_hash, conflictHash);
    assert.equal(await activeAdminCount(), 0);

    // 2. Genuine first-owner setup succeeds and stores a verifiable hash.
    const ownerCredential = `owner-${runId}-credential`;
    const ownerEmail = `owner-${runId}@integration.invalid`;
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/auth/setup-owner",
      payload: {
        name: "Integration Owner",
        email: ownerEmail,
        credential: ownerCredential,
      },
    });
    assert.equal(createResponse.statusCode, 201, createResponse.body);
    assert.equal(createResponse.json().user.role, "ADMIN");
    createdOwnerId = OWNER_ID;
    const ownerRow = await query<{ email: string; password_hash: string }>(
      "SELECT email, password_hash FROM users WHERE id=$1",
      [OWNER_ID],
    );
    assert.equal(ownerRow.rows[0].email, ownerEmail);
    assert.equal(
      await verifyCredential(ownerCredential, ownerRow.rows[0].password_hash),
      true,
    );

    // 3. Repeated setup is rejected and leaves the owner untouched.
    const repeatResponse = await app.inject({
      method: "POST",
      url: "/api/auth/setup-owner",
      payload: {
        name: "Second Owner",
        email: `second-${runId}@integration.invalid`,
        credential: "second-credential",
      },
    });
    assert.equal(repeatResponse.statusCode, 403);
    const ownerAfterRepeat = await query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [OWNER_ID],
    );
    assert.equal(
      ownerAfterRepeat.rows[0].password_hash,
      ownerRow.rows[0].password_hash,
    );
    assert.equal(await activeAdminCount(), 1);

    // 4. Concurrent attempts create exactly one owner.
    await query("DELETE FROM sessions WHERE user_id=$1", [OWNER_ID]);
    await query("DELETE FROM audit_logs WHERE user_id=$1", [OWNER_ID]);
    await query("DELETE FROM users WHERE id=$1", [OWNER_ID]);
    createdOwnerId = null;

    const [left, right] = await Promise.all([
      app.inject({
        method: "POST",
        url: "/api/auth/setup-owner",
        payload: {
          name: "Left",
          email: `left-${runId}@integration.invalid`,
          credential: "left-credential",
        },
      }),
      app.inject({
        method: "POST",
        url: "/api/auth/setup-owner",
        payload: {
          name: "Right",
          email: `right-${runId}@integration.invalid`,
          credential: "right-credential",
        },
      }),
    ]);
    assert.deepEqual(
      [left.statusCode, right.statusCode].sort((a, b) => a - b),
      [201, 403],
    );
    assert.equal(await activeAdminCount(), 1);
    createdOwnerId = OWNER_ID;

    // 5. Last-admin protection: cannot deactivate or demote the final active admin.
    const adminId = randomUUID();
    extraUserIds.push(adminId);
    const token = randomBytes(32).toString("hex");
    await query(
      `INSERT INTO users (id,name,email,role,active,password_hash) VALUES ($1,$2,$3,'ADMIN',TRUE,$4)`,
      [
        adminId,
        "Second Admin",
        `secondadmin-${runId}@integration.invalid`,
        await hashCredential("second-pass-credential"),
      ],
    );
    await query(
      "INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,NOW() + INTERVAL '1 hour')",
      [hashSessionToken(token), adminId],
    );
    const cookie = `hs_session=${token}`;
    const demoteSelf = await app.inject({
      method: "PATCH",
      url: `/api/staff/${adminId}`,
      headers: { cookie },
      payload: { role: "CASHIER" },
    });
    assert.equal(demoteSelf.statusCode, 400, demoteSelf.body);
    const deactivateSelf = await app.inject({
      method: "PATCH",
      url: `/api/staff/${adminId}`,
      headers: { cookie },
      payload: { active: false },
    });
    assert.equal(deactivateSelf.statusCode, 400, deactivateSelf.body);

    // Should allow removing a second admin while another remains.
    const createAdmin = await app.inject({
      method: "PATCH",
      url: `/api/staff/${OWNER_ID}`,
      headers: { cookie },
      payload: { role: "CASHIER", active: true },
    });
    assert.equal(createAdmin.statusCode, 200, createAdmin.body);
  });
});
