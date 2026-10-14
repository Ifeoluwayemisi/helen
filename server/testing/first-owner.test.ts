import assert from "node:assert/strict";
import test from "node:test";
import {
  provisionFirstOwner,
  ProvisionQueryClient,
} from "../auth/service";

type FakeAccount = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "CASHIER" | "INVENTORY";
  active: boolean;
  passwordHash: string;
};

type RecordedQuery = { text: string; params?: unknown[] };

/**
 * In-memory stand-in for the users table plus PostgreSQL advisory-lock
 * semantics. The `SELECT pg_advisory_xact_lock(...)` call serializes callers
 * exactly like a real transaction-scoped advisory lock, so the concurrency
 * regression test exercises the same ordering the database guarantees.
 */
function createFakeDatabase(seed: FakeAccount[] = []) {
  const accounts = new Map<string, FakeAccount>(
    seed.map((account) => [account.id, { ...account }]),
  );
  let lockTail: Promise<void> = Promise.resolve();
  const successfulInserts: FakeAccount[] = [];
  const allQueries: RecordedQuery[] = [];

  const values = () => [...accounts.values()];

  function makeClient(): ProvisionQueryClient & { queries: RecordedQuery[] } {
    const clientQueries: RecordedQuery[] = [];
    let releaseLock: (() => void) | null = null;

    const client = {
      queries: clientQueries,
      async query(
        text: string,
        params?: unknown[],
      ): Promise<{ rowCount: number | null; rows?: unknown[] }> {
        clientQueries.push({ text, params });
        allQueries.push({ text, params });
        const normalized = text.trim().toLowerCase();

        if (normalized === "begin") return { rowCount: null };

        if (normalized.startsWith("select pg_advisory_xact_lock")) {
          const previous = lockTail;
          let resolveLock!: () => void;
          lockTail = new Promise<void>((resolve) => {
            resolveLock = resolve;
          });
          releaseLock = resolveLock;
          await previous;
          return { rowCount: 1 };
        }

        if (normalized.startsWith("select id from users where role")) {
          const owner = values().find(
            (account) => account.role === "ADMIN",
          );
          return owner
            ? { rowCount: 1, rows: [{ id: owner.id }] }
            : { rowCount: 0, rows: [] };
        }

        if (normalized.startsWith("insert into users")) {
          const [id, name, email, passwordHash] = (params ?? []) as string[];
          const conflict = values().some(
            (account) => account.id === id || account.email === email,
          );
          if (conflict) return { rowCount: 0, rows: [] };
          const created: FakeAccount = {
            id,
            name,
            email,
            role: "ADMIN",
            active: true,
            passwordHash,
          };
          accounts.set(id, created);
          successfulInserts.push(created);
          return { rowCount: 1, rows: [{ id }] };
        }

        if (normalized === "commit" || normalized === "rollback") {
          if (releaseLock) {
            releaseLock();
            releaseLock = null;
          }
          return { rowCount: null };
        }

        return { rowCount: 0, rows: [] };
      },
      release() {},
    };

    return client;
  }

  return {
    makeClient,
    allQueries,
    successfulInserts,
    accountList: values,
    adminCount: () =>
      values().filter((account) => account.role === "ADMIN").length,
  };
}

const OWNER_INPUT = {
  userId: "a0000000-0000-0000-0000-000000000001",
  name: "Ada Owner",
  email: "ada.owner@example.com",
  passwordHash: "scrypt$fake$hash",
};

test("provisions the first owner inside a serialized, non-overwriting transaction", async () => {
  const db = createFakeDatabase();
  const client = db.makeClient();

  const result = await provisionFirstOwner(client, OWNER_INPUT);

  assert.equal(result.provisioned, true);
  const texts = client.queries.map((query) => query.text.trim().toLowerCase());
  assert.ok(texts.includes("begin"));
  assert.ok(texts.some((text) => text.includes("pg_advisory_xact_lock")));
  assert.ok(texts.includes("commit"));
  assert.equal(texts.includes("rollback"), false);

  const insert = client.queries.find((query) =>
    query.text.trim().toLowerCase().startsWith("insert into users"),
  );
  assert.ok(insert, "expected an INSERT for the new owner");
  assert.match(insert!.text, /on conflict do nothing/i);
  assert.doesNotMatch(insert!.text, /do update/i);
  assert.equal(db.adminCount(), 1);
  const owner = db.accountList().find((account) => account.role === "ADMIN")!;
  assert.equal(owner.passwordHash, OWNER_INPUT.passwordHash);
  assert.equal(owner.email, OWNER_INPUT.email);
  assert.equal(owner.active, true);
});

test("refuses repeated setup and never overwrites the existing owner", async () => {
  const db = createFakeDatabase();
  const first = await provisionFirstOwner(db.makeClient(), OWNER_INPUT);
  assert.equal(first.provisioned, true);
  const ownerAfterFirst = db.accountList().find(
    (account) => account.role === "ADMIN",
  )!;

  const second = await provisionFirstOwner(db.makeClient(), {
    ...OWNER_INPUT,
    name: "Impostor",
    email: "impostor@example.com",
    passwordHash: "scrypt$attacker$hash",
  });

  assert.equal(second.provisioned, false);
  assert.equal(db.successfulInserts.length, 1);
  const ownerAfterSecond = db.accountList().find(
    (account) => account.role === "ADMIN",
  )!;
  assert.equal(ownerAfterSecond.passwordHash, ownerAfterFirst.passwordHash);
  assert.equal(ownerAfterSecond.name, "Ada Owner");
  assert.equal(db.adminCount(), 1);
});

test("a conflicting email is not overwritten and provisioning reports failure", async () => {
  const db = createFakeDatabase([
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Existing Cashier",
      email: OWNER_INPUT.email,
      role: "CASHIER",
      active: true,
      passwordHash: "scrypt$existing$cashier",
    },
  ]);

  const result = await provisionFirstOwner(db.makeClient(), OWNER_INPUT);

  assert.equal(result.provisioned, false);
  assert.equal(db.successfulInserts.length, 0);
  const existing = db.accountList().find((account) => account.role === "CASHIER")!;
  assert.equal(existing.passwordHash, "scrypt$existing$cashier");
  assert.equal(existing.email, OWNER_INPUT.email);
  assert.equal(db.adminCount(), 0);
  const inserts = db.allQueries.filter((query) =>
    query.text.trim().toLowerCase().startsWith("insert into users"),
  );
  assert.ok(inserts.every((query) => !/do update/i.test(query.text)));
});

test("an inactive admin still blocks provisioning so a second owner cannot be created", async () => {
  const db = createFakeDatabase([
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Dormant Owner",
      email: "dormant@example.com",
      role: "ADMIN",
      active: false,
      passwordHash: "scrypt$dormant$owner",
    },
  ]);

  const result = await provisionFirstOwner(db.makeClient(), OWNER_INPUT);

  assert.equal(result.provisioned, false);
  assert.equal(db.successfulInserts.length, 0);
  assert.equal(db.adminCount(), 1);
  assert.equal(
    db.accountList().find((account) => account.role === "ADMIN")!.id,
    "22222222-2222-2222-2222-222222222222",
  );
});

test("concurrent setup attempts create exactly one owner", async () => {
  const db = createFakeDatabase();

  const [left, right] = await Promise.all([
    provisionFirstOwner(db.makeClient(), {
      ...OWNER_INPUT,
      email: "left@example.com",
    }),
    provisionFirstOwner(db.makeClient(), {
      ...OWNER_INPUT,
      email: "right@example.com",
    }),
  ]);

  assert.equal([left.provisioned, right.provisioned].filter(Boolean).length, 1);
  assert.equal(db.adminCount(), 1);
  assert.equal(db.successfulInserts.length, 1);
});
