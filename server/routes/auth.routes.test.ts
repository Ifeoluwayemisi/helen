import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app";

test("login rejects a missing email before touching the database", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {},
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("login rejects a missing credential before touching the database", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@example.com" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("login rejects a body that is missing entirely instead of crashing", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("login rejects non-string credentials instead of crashing", async () => {
  const app = await buildApp();
  try {
    const numericCredential = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "owner@example.com", credential: 1234 },
    });
    const numericEmail = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: 42, credential: "1234" },
    });
    assert.equal(numericCredential.statusCode, 400);
    assert.equal(numericCredential.json().success, false);
    assert.equal(numericEmail.statusCode, 400);
    assert.equal(numericEmail.json().success, false);
  } finally {
    await app.close();
  }
});

test("session introspection requires an authenticated cookie", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/auth/me" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("staff directory requires an authenticated admin session", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/api/staff" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("product mutations reject unauthenticated requests before validation", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/products",
      payload: {},
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});

test("settings mutations reject unauthenticated requests before validation", async () => {
  const app = await buildApp();
  try {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      payload: {},
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().success, false);
  } finally {
    await app.close();
  }
});
