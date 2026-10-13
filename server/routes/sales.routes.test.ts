import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";

test("sales history requires an authenticated session", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/sales" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("checkout rejects unauthenticated requests before validating or mutating data", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: { "idempotency-key": "unauth-test-key-001" },
      payload: {
        items: [{ productId: "prod_1", quantity: 1 }],
        paymentMethod: "CASH",
        amountPaid: 1,
      },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});
