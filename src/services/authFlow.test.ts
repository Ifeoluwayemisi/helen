import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_OWNER_CREDENTIAL_LENGTH,
  ownerSetupFailureMessage,
  shouldShowOwnerSetup,
  validateOwnerSetupInput,
} from "./authFlow";

test("owner setup is only offered once the server confirms no owner exists", () => {
  assert.equal(shouldShowOwnerSetup({ checked: false, hasOwner: false }), false);
  assert.equal(shouldShowOwnerSetup({ checked: false, hasOwner: true }), false);
  assert.equal(shouldShowOwnerSetup({ checked: true, hasOwner: true }), false);
  assert.equal(shouldShowOwnerSetup({ checked: true, hasOwner: false }), true);
});

test("owner setup accepts a valid name, email and credential", () => {
  assert.equal(
    validateOwnerSetupInput({
      name: "Hellen Olayode",
      email: "owner@example.com",
      credential: "1234",
    }),
    null,
  );
});

test("owner setup requires a non-empty name", () => {
  assert.match(
    validateOwnerSetupInput({ name: "   ", email: "a@b.co", credential: "1234" }) ?? "",
    /name is required/i,
  );
});

test("owner setup requires a well-formed email", () => {
  assert.match(
    validateOwnerSetupInput({ name: "Ada", email: "", credential: "1234" }) ?? "",
    /email is required/i,
  );
  assert.match(
    validateOwnerSetupInput({ name: "Ada", email: "not-an-email", credential: "1234" }) ?? "",
    /valid email/i,
  );
});

test("owner setup enforces the minimum credential length", () => {
  const short = "1".repeat(MIN_OWNER_CREDENTIAL_LENGTH - 1);
  assert.match(
    validateOwnerSetupInput({ name: "Ada", email: "a@b.co", credential: short }) ?? "",
    new RegExp(`at least ${MIN_OWNER_CREDENTIAL_LENGTH} characters`),
  );
});

test("owner setup surfaces server errors and falls back to a safe message", () => {
  assert.equal(ownerSetupFailureMessage(new Error("Owner already exists.")), "Owner already exists.");
  assert.equal(ownerSetupFailureMessage(undefined), "Store owner setup failed. Please try again.");
});
