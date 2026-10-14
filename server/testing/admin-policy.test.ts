import assert from "node:assert/strict";
import test from "node:test";
import { wouldRemoveLastActiveAdmin } from "../auth/admin-policy";

test("blocks deactivating the last active admin", () => {
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: true },
      "ADMIN",
      false,
      1,
    ),
    true,
  );
});

test("blocks demoting the last active admin", () => {
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: true },
      "CASHIER",
      true,
      1,
    ),
    true,
  );
});

test("allows removing an admin while another active admin remains", () => {
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: true },
      "ADMIN",
      false,
      2,
    ),
    false,
  );
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: true },
      "INVENTORY",
      true,
      2,
    ),
    false,
  );
});

test("ignores changes to non-admins and no-op changes", () => {
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "CASHIER", active: true },
      "CASHIER",
      false,
      1,
    ),
    false,
  );
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: true },
      "ADMIN",
      true,
      1,
    ),
    false,
  );
});

test("an already-inactive admin is not counted as removable", () => {
  assert.equal(
    wouldRemoveLastActiveAdmin(
      { role: "ADMIN", active: false },
      "CASHIER",
      false,
      0,
    ),
    false,
  );
});
