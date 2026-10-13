import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { configurePool, closePool, query } from "../db/pool";
import { hashCredential, hashSessionToken } from "../auth/crypto";
import { verifyTestDatabase } from "./test-database";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type FixtureProduct = {
  id: string;
  sku: string;
  stock: number;
  price: string;
  packSize?: number;
  cartonSize?: number;
};

const runId = randomUUID().replaceAll("-", "");
const userIds = new Map<string, string>();
const tokens = new Map<string, string>();
const products: FixtureProduct[] = [];
const categoryId = `it_cat_${runId}`;
const extraCategoryIds: string[] = [];
const createdSaleIds: string[] = [];
const cashierPassword = `test-${runId}-password`;
let app: FastifyInstance;
let fixtureReady = false;
let failProductId: string | null = null;
let activeTimeoutKey: string | null = null;
let signalTimeoutResponse: (() => void) | null = null;
let timeoutResponseGate: Promise<void> | null = null;

const migrationsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db/migrations",
);

function authHeaders(role: "CASHIER" | "INVENTORY" | "ADMIN") {
  return { cookie: `hs_session=${tokens.get(role)}` };
}

function checkoutBody(
  product: FixtureProduct,
  quantity = 1,
  overrides: Record<string, unknown> = {},
) {
  return {
    items: [
      {
        productId: product.id,
        quantity,
        sellingUnit: "BASE",
        priceTier: "RETAIL",
      },
    ],
    discount: { value: 0, type: "fixed" },
    paymentMethod: "CASH",
    amountPaid: product.price,
    ...overrides,
  };
}

async function addProduct(options: {
  stock: number;
  price?: string;
  packSize?: number;
  cartonSize?: number;
  packPrice?: string;
  cartonPrice?: string;
}): Promise<FixtureProduct> {
  const id = `it_prod_${runId}_${products.length}`;
  const sku = `IT-${runId.slice(0, 20)}-${products.length}`;
  const fixture: FixtureProduct = {
    id,
    sku,
    stock: options.stock,
    price: options.price || "2.50",
    packSize: options.packSize,
    cartonSize: options.cartonSize,
  };
  await query(
    `INSERT INTO products (
       id, name, category_id, sku, selling_price, stock_quantity, min_stock_threshold, base_unit,
       has_pack, pack_unit_name, pack_size, pack_retail_price,
       has_carton, carton_unit_name, carton_size, carton_retail_price, active
     ) VALUES ($1,$2,$3,$4,$5,$6,0,'bottle',$7,$8,$9,$10,$11,$12,$13,$14,TRUE)`,
    [
      id,
      `Integration fixture ${products.length}`,
      categoryId,
      sku,
      fixture.price,
      options.stock,
      Boolean(options.packSize),
      options.packSize ? `Pack of ${options.packSize}` : null,
      options.packSize || null,
      options.packPrice || null,
      Boolean(options.cartonSize),
      options.cartonSize ? `Carton of ${options.cartonSize}` : null,
      options.cartonSize || null,
      options.cartonPrice || null,
    ],
  );
  products.push(fixture);
  return fixture;
}

async function postCheckout(
  role: "CASHIER" | "INVENTORY" | "ADMIN",
  product: FixtureProduct,
  key = `it-${randomUUID()}`,
  body: Record<string, unknown> = checkoutBody(product),
) {
  return app.inject({
    method: "POST",
    url: "/api/sales",
    headers: { ...authHeaders(role), "idempotency-key": key },
    payload: body,
  });
}

async function getStock(productId: string): Promise<number> {
  const result = await query<{ stock_quantity: number }>(
    "SELECT stock_quantity FROM products WHERE id = $1",
    [productId],
  );
  return Number(result.rows[0].stock_quantity);
}

async function saleCounts(saleId: string) {
  const [sales, items, payments, movements, audits] = await Promise.all([
    query("SELECT count(*)::int AS count FROM sales WHERE id = $1", [saleId]),
    query("SELECT count(*)::int AS count FROM sale_items WHERE sale_id = $1", [
      saleId,
    ]),
    query("SELECT count(*)::int AS count FROM payments WHERE sale_id = $1", [
      saleId,
    ]),
    query(
      "SELECT count(*)::int AS count FROM stock_movements WHERE transaction_id = $1",
      [saleId],
    ),
    query(
      "SELECT count(*)::int AS count FROM audit_logs WHERE entity_type = 'SALE' AND entity_id = $1",
      [saleId],
    ),
  ]);
  return [sales, items, payments, movements, audits].map(
    (result) => result.rows[0].count as number,
  );
}

async function createUser(role: "CASHIER" | "INVENTORY" | "ADMIN") {
  const id = randomUUID();
  const name = `Integration ${role}`;
  const email = `${role.toLowerCase()}-${runId}@integration.invalid`;
  const token = randomBytes(32).toString("hex");
  const passwordHash = await hashCredential(
    role === "CASHIER" ? cashierPassword : `test-${role}-${runId}`,
  );
  await query(
    `INSERT INTO users (id,name,email,role,active,password_hash) VALUES ($1,$2,$3,$4,TRUE,$5)`,
    [id, name, email, role, passwordHash],
  );
  userIds.set(role, id);
  await query(
    "INSERT INTO sessions (id,user_id,expires_at) VALUES ($1,$2,NOW() + INTERVAL '1 hour')",
    [hashSessionToken(token), id],
  );
  tokens.set(role, token);
}

const verifiedTarget = await verifyTestDatabase();
configurePool(verifiedTarget.connectionString, 30000);
console.log(
  `Integration target verified: ${verifiedTarget.identity.label} (${verifiedTarget.identity.host}/${verifiedTarget.identity.database}, ${verifiedTarget.identity.schema}; server address ${verifiedTarget.identity.serverAddress || "unavailable"}).`,
);

const migrationFiles = fs
  .readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const migrationHistory = await query<{ filename: string }>(
  "SELECT filename FROM schema_migrations ORDER BY filename",
);
assert.deepEqual(
  migrationHistory.rows.map((row) => row.filename),
  migrationFiles,
  "Run npm run db:test:migrate against the confirmed disposable database first.",
);
const imported = await import("../app");
app = await imported.buildApp();
app.addHook(
  "onSend",
  async (
    request: FastifyRequest,
    _reply: FastifyReply,
    payload: string | Buffer,
  ) => {
    if (
      activeTimeoutKey &&
      request.headers["x-integration-timeout-key"] === activeTimeoutKey &&
      signalTimeoutResponse &&
      timeoutResponseGate
    ) {
      signalTimeoutResponse();
      await timeoutResponseGate;
    }
    return payload;
  },
);

before(async () => {
  fixtureReady = true;
  await query(
    "INSERT INTO categories (id,name,description,active) VALUES ($1,$2,$3,TRUE)",
    [categoryId, `Integration ${runId}`, "Disposable integration-test fixture"],
  );
  await createUser("CASHIER");
  await createUser("INVENTORY");
  await createUser("ADMIN");
});

after(async () => {
  if (!fixtureReady) {
    if (app) await app.close().catch(() => undefined);
    await closePool().catch(() => undefined);
    return;
  }
  if (failProductId) {
    const suffix = runId;
    await query(
      `DROP TRIGGER IF EXISTS it_fail_${suffix} ON stock_movements`,
    ).catch(() => undefined);
    await query(`DROP FUNCTION IF EXISTS it_fail_fn_${suffix}()`).catch(
      () => undefined,
    );
  }
  await query("DELETE FROM sessions WHERE user_id = ANY($1::uuid[])", [
    [...userIds.values()],
  ]);
  await query(
    "DELETE FROM audit_logs WHERE user_id = ANY($1::uuid[]) OR entity_id = ANY($2::text[])",
    [[...userIds.values()], createdSaleIds],
  );
  await query(
    "DELETE FROM stock_movements WHERE product_id = ANY($1::varchar[])",
    [products.map((product) => product.id)],
  );
  await query("DELETE FROM payments WHERE sale_id = ANY($1::varchar[])", [
    createdSaleIds,
  ]);
  await query("DELETE FROM sale_items WHERE sale_id = ANY($1::varchar[])", [
    createdSaleIds,
  ]);
  await query(
    "DELETE FROM checkout_idempotency WHERE sale_id = ANY($1::varchar[])",
    [createdSaleIds],
  );
  await query("DELETE FROM sales WHERE id = ANY($1::varchar[])", [
    createdSaleIds,
  ]);
  await query("DELETE FROM products WHERE id = ANY($1::varchar[])", [
    products.map((product) => product.id),
  ]);
  await query("DELETE FROM users WHERE id = ANY($1::uuid[])", [
    [...userIds.values()],
  ]);
  await query("DELETE FROM categories WHERE id = $1", [categoryId]);
  await query("DELETE FROM categories WHERE id = ANY($1::varchar[])", [
    extraCategoryIds,
  ]);
  await app.close();
  await closePool();
});

describe("PostgreSQL checkout integration", () => {
  it("preserves login, logout, catalog, staff authorization, and inventory route behavior", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        email: `cashier-${runId}@integration.invalid`,
        credential: cashierPassword,
      },
    });
    assert.equal(login.statusCode, 200, login.body);
    const setCookie = login.headers["set-cookie"];
    const loginCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    assert.ok(loginCookie, "login should set the HTTP-only session cookie");
    const cookieHeader = loginCookie.split(";")[0];
    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieHeader },
    });
    assert.equal(me.statusCode, 200);
    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: cookieHeader },
    });
    assert.equal(logout.statusCode, 200);
    const loggedOut = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { cookie: cookieHeader },
    });
    assert.equal(loggedOut.statusCode, 401);

    const product = await addProduct({
      stock: 5,
      packSize: 3,
      packPrice: "7.00",
    });
    const inventoryPriceEdit = await app.inject({
      method: "PATCH",
      url: `/api/products/${product.id}`,
      headers: authHeaders("INVENTORY"),
      payload: { packRetailPrice: 8 },
    });
    assert.equal(inventoryPriceEdit.statusCode, 403);
    const catalog = await app.inject({
      method: "GET",
      url: `/api/products?search=${encodeURIComponent(product.sku)}`,
    });
    assert.equal(catalog.statusCode, 200);
    assert.equal(
      catalog
        .json()
        .products.some((entry: { id: string }) => entry.id === product.id),
      true,
    );
    const staff = await app.inject({
      method: "GET",
      url: "/api/staff",
      headers: authHeaders("ADMIN"),
    });
    const staffDenied = await app.inject({
      method: "GET",
      url: "/api/staff",
      headers: authHeaders("INVENTORY"),
    });
    assert.equal(staff.statusCode, 200);
    assert.equal(staffDenied.statusCode, 403);
    assert.equal(
      staff.json().users.every((user: Record<string, unknown>) => !("pin" in user)),
      true,
    );

    const createdCategory = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: authHeaders("ADMIN"),
      payload: {
        name: `Integration category ${runId}`,
        description: "Temporary integration category",
      },
    });
    const categoryDenied = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: authHeaders("INVENTORY"),
      payload: { name: `Denied category ${runId}` },
    });
    assert.equal(createdCategory.statusCode, 201, createdCategory.body);
    extraCategoryIds.push(createdCategory.json().category.id);
    assert.equal(categoryDenied.statusCode, 403);

    const settingsBefore = await query<{ store_name: string }>(
      "SELECT store_name FROM business_settings WHERE id='default'",
    );
    const settingsUpdated = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: authHeaders("ADMIN"),
      payload: { storeName: `Integration ${runId}` },
    });
    const settingsDenied = await app.inject({
      method: "PATCH",
      url: "/api/settings",
      headers: authHeaders("INVENTORY"),
      payload: { storeName: "Must not persist" },
    });
    assert.equal(settingsUpdated.statusCode, 200, settingsUpdated.body);
    assert.equal(settingsDenied.statusCode, 403);
    await query("UPDATE business_settings SET store_name=$1 WHERE id='default'", [
      settingsBefore.rows[0].store_name,
    ]);

    const receive = await app.inject({
      method: "POST",
      url: "/api/inventory/receive",
      headers: authHeaders("INVENTORY"),
      payload: { productId: product.id, quantity: 2, sellingUnit: "PACK" },
    });
    assert.equal(receive.statusCode, 200, receive.body);
    assert.equal(await getStock(product.id), 11);
    const adjust = await app.inject({
      method: "POST",
      url: "/api/inventory/adjust",
      headers: authHeaders("INVENTORY"),
      payload: {
        productId: product.id,
        newQuantity: 10,
        reason: "ADJUSTMENT",
        note: "Integration fixture reconciliation",
      },
    });
    assert.equal(adjust.statusCode, 200, adjust.body);
    assert.equal(await getStock(product.id), 10);
  });

  it("completes authorized cashier checkout, ignores client totals, and persists consistent snapshots", async () => {
    const product = await addProduct({ stock: 8 });
    const response = await postCheckout(
      "CASHIER",
      product,
      `it-success-${runId}`,
      {
        ...checkoutBody(product),
        clientPrice: 0,
        subtotal: 0,
        total: 0,
        items: [
          {
            productId: product.id,
            quantity: 1,
            sellingUnit: "BASE",
            priceTier: "RETAIL",
            unitPrice: 0,
            lineTotal: 0,
          },
        ],
      },
    );
    assert.equal(response.statusCode, 201, response.body);
    const sale = response.json().sale;
    createdSaleIds.push(sale.id);
    assert.equal(sale.cashierId, userIds.get("CASHIER"));
    assert.equal(sale.total, 2.5);
    assert.equal(sale.items[0].unitPrice, 2.5);
    assert.equal(sale.items[0].sellingUnitName, "bottle");
    assert.deepEqual(await saleCounts(sale.id), [1, 1, 1, 1, 1]);
    assert.equal(await getStock(product.id), 7);
  });

  it("rejects unauthenticated and inventory-role checkout", async () => {
    const product = await addProduct({ stock: 4 });
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/api/sales",
      headers: { "idempotency-key": `it-unauth-${runId}` },
      payload: checkoutBody(product),
    });
    const unauthorized = await postCheckout(
      "INVENTORY",
      product,
      `it-role-${runId}`,
    );
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthorized.statusCode, 403);
    assert.equal(await getStock(product.id), 4);
  });

  it("rejects invalid quantities, unsupported units, and unavailable pack configuration", async () => {
    const product = await addProduct({ stock: 5 });
    const badQuantity = await postCheckout(
      "CASHIER",
      product,
      `it-q-${runId}`,
      checkoutBody(product, 0),
    );
    const badUnit = await postCheckout("CASHIER", product, `it-unit-${runId}`, {
      ...checkoutBody(product),
      items: [
        {
          productId: product.id,
          quantity: 1,
          sellingUnit: "CRATE",
          priceTier: "RETAIL",
        },
      ],
    });
    const noPack = await postCheckout(
      "CASHIER",
      product,
      `it-nopack-${runId}`,
      {
        ...checkoutBody(product),
        items: [
          {
            productId: product.id,
            quantity: 1,
            sellingUnit: "PACK",
            priceTier: "RETAIL",
          },
        ],
      },
    );
    assert.equal(badQuantity.statusCode, 400);
    assert.equal(badUnit.statusCode, 400);
    assert.equal(noPack.statusCode, 400);
    assert.equal(await getStock(product.id), 5);
  });

  it("rejects insufficient stock without partial writes", async () => {
    const product = await addProduct({ stock: 1 });
    const response = await postCheckout(
      "CASHIER",
      product,
      `it-short-${runId}`,
      checkoutBody(product, 2, { amountPaid: 5 }),
    );
    assert.equal(response.statusCode, 409);
    assert.equal(await getStock(product.id), 1);
    const idempotency = await query(
      "SELECT count(*)::int AS count FROM checkout_idempotency WHERE idempotency_key = $1",
      [`it-short-${runId}`],
    );
    assert.equal(idempotency.rows[0].count, 0);
  });

  it("deducts pack and carton sales in base units and preserves selling-unit snapshots", async () => {
    const pack = await addProduct({
      stock: 50,
      packSize: 6,
      packPrice: "13.00",
    });
    const carton = await addProduct({
      stock: 50,
      cartonSize: 12,
      cartonPrice: "24.00",
    });
    const packResponse = await postCheckout(
      "CASHIER",
      pack,
      `it-pack-${runId}`,
      {
        ...checkoutBody(pack, 1, { amountPaid: 13 }),
        items: [
          {
            productId: pack.id,
            quantity: 1,
            sellingUnit: "PACK",
            priceTier: "RETAIL",
          },
        ],
      },
    );
    const cartonResponse = await postCheckout(
      "CASHIER",
      carton,
      `it-carton-${runId}`,
      {
        ...checkoutBody(carton, 1, { amountPaid: 24 }),
        items: [
          {
            productId: carton.id,
            quantity: 1,
            sellingUnit: "CARTON",
            priceTier: "RETAIL",
          },
        ],
      },
    );
    assert.equal(packResponse.statusCode, 201, packResponse.body);
    assert.equal(cartonResponse.statusCode, 201, cartonResponse.body);
    const packSale = packResponse.json().sale;
    const cartonSale = cartonResponse.json().sale;
    createdSaleIds.push(packSale.id, cartonSale.id);
    assert.equal(await getStock(pack.id), 44);
    assert.equal(await getStock(carton.id), 38);
    assert.equal(packSale.items[0].sellingUnitName, "Pack of 6");
    assert.equal(packSale.items[0].conversionFactor, 6);
    assert.equal(cartonSale.items[0].sellingUnitName, "Carton of 12");
    assert.equal(cartonSale.items[0].conversionFactor, 12);
    assert.equal(packSale.items[0].lineTotal, 13);
    assert.equal(cartonSale.items[0].lineTotal, 24);
  });

  it("rejects underpayment, calculates cash change, and requires exact electronic tender", async () => {
    const equalCash = await addProduct({ stock: 10 });
    const exact = await postCheckout("CASHIER", equalCash, `it-equal-${runId}`);
    assert.equal(exact.statusCode, 201);
    const equalSale = exact.json().sale;
    createdSaleIds.push(equalSale.id);
    assert.equal(equalSale.changeAmount, 0);

    const excess = await addProduct({ stock: 10 });
    const over = await postCheckout(
      "CASHIER",
      excess,
      `it-over-${runId}`,
      checkoutBody(excess, 1, { amountPaid: 5 }),
    );
    assert.equal(over.statusCode, 201);
    const overSale = over.json().sale;
    createdSaleIds.push(overSale.id);
    assert.equal(overSale.changeAmount, 2.5);

    const short = await addProduct({ stock: 10 });
    const under = await postCheckout(
      "CASHIER",
      short,
      `it-under-${runId}`,
      checkoutBody(short, 1, { amountPaid: 2 }),
    );
    assert.equal(under.statusCode, 400);

    for (const method of ["BANK_TRANSFER", "POS_CARD"]) {
      const electronic = await addProduct({ stock: 5 });
      const mismatch = await postCheckout(
        "CASHIER",
        electronic,
        `it-${method}-bad-${runId}`,
        checkoutBody(electronic, 1, {
          paymentMethod: method,
          amountPaid: 3,
          paymentConfirmed: true,
        }),
      );
      const accepted = await postCheckout(
        "CASHIER",
        electronic,
        `it-${method}-ok-${runId}`,
        checkoutBody(electronic, 1, {
          paymentMethod: method,
          amountPaid: 2.5,
          paymentConfirmed: true,
        }),
      );
      assert.equal(mismatch.statusCode, 400);
      assert.equal(accepted.statusCode, 201, accepted.body);
      createdSaleIds.push(accepted.json().sale.id);
    }
  });

  it("calculates discounts and tax without disagreement between sale, line, and payment values", async () => {
    const product = await addProduct({ stock: 5, price: "2.00" });
    const previous = await query(
      "SELECT enable_tax,tax_rate FROM business_settings WHERE id='default'",
    );
    try {
      await query(
        "UPDATE business_settings SET enable_tax=TRUE,tax_rate=7.50 WHERE id='default'",
      );
      const response = await postCheckout(
        "CASHIER",
        product,
        `it-tax-${runId}`,
        {
          ...checkoutBody(product, 1, { amountPaid: 1.88 }),
          discount: { value: 0.25, type: "fixed" },
        },
      );
      assert.equal(response.statusCode, 201, response.body);
      const sale = response.json().sale;
      createdSaleIds.push(sale.id);
      assert.equal(sale.subtotal, 2);
      assert.equal(sale.discount, 0.25);
      assert.equal(sale.taxAmount, 0.13);
      assert.equal(sale.total, 1.88);
      const persisted = await query(
        `SELECT s.total, p.amount AS payment_amount, si.line_total
         FROM sales s JOIN payments p ON p.sale_id=s.id JOIN sale_items si ON si.sale_id=s.id WHERE s.id=$1`,
        [sale.id],
      );
      assert.equal(Number(persisted.rows[0].total), 1.88);
      assert.equal(Number(persisted.rows[0].payment_amount), 1.88);
      assert.equal(Number(persisted.rows[0].line_total), 2);
    } finally {
      await query(
        "UPDATE business_settings SET enable_tax=$1,tax_rate=$2 WHERE id='default'",
        [previous.rows[0].enable_tax, previous.rows[0].tax_rate],
      );
    }
  });

  it("rolls every transaction write back after a forced stock-ledger failure", async () => {
    const product = await addProduct({ stock: 6 });
    failProductId = product.id;
    const triggerSuffix = runId;
    await query(
      `CREATE FUNCTION it_fail_fn_${triggerSuffix}() RETURNS trigger LANGUAGE plpgsql AS $body$ BEGIN IF NEW.product_id = '${product.id}' THEN RAISE EXCEPTION 'forced integration failure'; END IF; RETURN NEW; END $body$`,
    );
    await query(
      `CREATE TRIGGER it_fail_${triggerSuffix} BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION it_fail_fn_${triggerSuffix}()`,
    );
    const key = `it-rollback-${runId}`;
    const response = await postCheckout("CASHIER", product, key);
    assert.equal(response.statusCode, 500);
    assert.equal(await getStock(product.id), 6);
    const idempotency = await query(
      "SELECT count(*)::int AS count FROM checkout_idempotency WHERE idempotency_key=$1",
      [key],
    );
    assert.equal(idempotency.rows[0].count, 0);
    const fixtureSales = await query(
      "SELECT count(*)::int AS count FROM sales WHERE idempotency_key=$1",
      [key],
    );
    assert.equal(fixtureSales.rows[0].count, 0);
    await query(`DROP TRIGGER it_fail_${triggerSuffix} ON stock_movements`);
    await query(`DROP FUNCTION it_fail_fn_${triggerSuffix}()`);
    failProductId = null;
  });

  it("replays idempotently, rejects changed payloads, and recovers after a client timeout", async () => {
    const product = await addProduct({ stock: 10 });
    const key = `it-replay-${runId}`;
    const first = await postCheckout("CASHIER", product, key);
    assert.equal(first.statusCode, 201);
    const sale = first.json().sale;
    createdSaleIds.push(sale.id);
    const replay = await postCheckout("CASHIER", product, key);
    assert.equal(replay.statusCode, 200);
    assert.equal(replay.json().sale.id, sale.id);
    assert.equal(await getStock(product.id), 9);
    const changed = await postCheckout(
      "CASHIER",
      product,
      key,
      checkoutBody(product, 2, { amountPaid: 5 }),
    );
    assert.equal(changed.statusCode, 409);

    const timeoutProduct = await addProduct({ stock: 3 });
    const timeoutKey = `it-timeout-${runId}`;
    let reachedResponse!: () => void;
    let releaseResponse!: () => void;
    const responseReady = new Promise<void>(
      (resolve) => (reachedResponse = resolve),
    );
    const blockedResponse = new Promise<void>(
      (resolve) => (releaseResponse = resolve),
    );
    activeTimeoutKey = timeoutKey;
    signalTimeoutResponse = reachedResponse;
    timeoutResponseGate = blockedResponse;
    let baseUrl: string | undefined;
    const controller = new AbortController();
    let requestPromise: Promise<Response> | undefined;
    try {
      baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
      requestPromise = fetch(`${baseUrl}/api/sales`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `hs_session=${tokens.get("CASHIER")}`,
          "idempotency-key": timeoutKey,
          "x-integration-timeout-key": timeoutKey,
        },
        body: JSON.stringify(checkoutBody(timeoutProduct)),
        signal: controller.signal,
      });
      let timeoutHandle: NodeJS.Timeout | undefined;
      await Promise.race([
        responseReady,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(
                  "Checkout response did not reach the post-commit hook.",
                ),
              ),
            60_000,
          );
        }),
      ]).finally(() => clearTimeout(timeoutHandle));
      controller.abort();
      await requestPromise.catch(() => undefined);
    } finally {
      releaseResponse();
      activeTimeoutKey = null;
      signalTimeoutResponse = null;
      timeoutResponseGate = null;
    }
    const saleLookup = await query<{ id: string }>(
      "SELECT id FROM sales WHERE idempotency_key=$1",
      [timeoutKey],
    );
    assert.equal(
      saleLookup.rowCount,
      1,
      "the server should have committed before the client timed out",
    );
    const committedSaleId = saleLookup.rows[0].id;
    createdSaleIds.push(committedSaleId);
    const recovered = await postCheckout("CASHIER", timeoutProduct, timeoutKey);
    assert.equal(recovered.statusCode, 200);
    assert.equal(recovered.json().sale.id, committedSaleId);
    assert.equal(await getStock(timeoutProduct.id), 2);
  });

  it("prevents concurrent overselling under row locks", async () => {
    const product = await addProduct({ stock: 1 });
    const [left, right] = await Promise.all([
      postCheckout("CASHIER", product, `it-race-a-${runId}`),
      postCheckout("CASHIER", product, `it-race-b-${runId}`),
    ]);
    assert.deepEqual([left.statusCode, right.statusCode].sort(), [201, 409]);
    const saleResponse = left.statusCode === 201 ? left : right;
    createdSaleIds.push(saleResponse.json().sale.id);
    assert.equal(await getStock(product.id), 0);
  });

  it("scopes persisted sales history to the authenticated cashier and retains receipt snapshots", async () => {
    const cashierProduct = await addProduct({
      stock: 4,
      packSize: 4,
      packPrice: "8.00",
    });
    const outsiderProduct = await addProduct({ stock: 3 });
    const cashierSaleResponse = await postCheckout(
      "CASHIER",
      cashierProduct,
      `it-scope-a-${runId}`,
      {
        ...checkoutBody(cashierProduct, 1, { amountPaid: 8 }),
        items: [
          {
            productId: cashierProduct.id,
            quantity: 1,
            sellingUnit: "PACK",
            priceTier: "RETAIL",
          },
        ],
      },
    );
    assert.equal(cashierSaleResponse.statusCode, 201);
    const cashierSale = cashierSaleResponse.json().sale;
    createdSaleIds.push(cashierSale.id);
    const outsiderSaleResponse = await postCheckout(
      "ADMIN",
      outsiderProduct,
      `it-scope-b-${runId}`,
    );
    assert.equal(
      outsiderSaleResponse.statusCode,
      201,
      outsiderSaleResponse.body,
    );
    const outsiderSale = outsiderSaleResponse.json().sale;
    createdSaleIds.push(outsiderSale.id);

    const cashierHistory = await app.inject({
      method: "GET",
      url: "/api/sales",
      headers: authHeaders("CASHIER"),
    });
    const adminHistory = await app.inject({
      method: "GET",
      url: "/api/sales",
      headers: authHeaders("ADMIN"),
    });
    assert.equal(cashierHistory.statusCode, 200);
    assert.equal(
      cashierHistory
        .json()
        .sales.some((sale: { id: string }) => sale.id === outsiderSale.id),
      false,
    );
    assert.equal(
      adminHistory
        .json()
        .sales.some((sale: { id: string }) => sale.id === outsiderSale.id),
      true,
    );
    const persisted = cashierHistory
      .json()
      .sales.find((sale: { id: string }) => sale.id === cashierSale.id);
    assert.equal(persisted.items[0].sellingUnitName, "Pack of 4");
    assert.equal(persisted.items[0].conversionFactor, 4);
    assert.equal(persisted.items[0].unitPrice, 8);
    assert.equal(persisted.items[0].quantity, 1);
    assert.equal(persisted.items[0].lineTotal, 8);
  });
});
