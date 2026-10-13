import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateDiscountCents,
  calculateTaxCents,
  parseCents,
  parseCheckoutLine,
  resolveSellingTerms,
} from "./checkout-calculations";

test("parses monetary values without binary floating point arithmetic", () => {
  assert.equal(parseCents(12.34), 1234);
  assert.equal(parseCents("12"), 1200);
  assert.equal(parseCents("12.345"), null);
  assert.equal(parseCents(-1), null);
});

test("calculates fixed and percentage discounts in cents", () => {
  assert.equal(calculateDiscountCents(10_000, "12.34", "fixed"), 1234);
  assert.equal(calculateDiscountCents(10_001, 12.5, "percentage"), 1250);
  assert.equal(calculateDiscountCents(1_000, 100.01, "percentage"), null);
});

test("calculates tax in cents with half-up rounding", () => {
  assert.equal(calculateTaxCents(10_000, "7.50"), 750);
  assert.equal(calculateTaxCents(1, 50), 1);
  assert.equal(
    calculateTaxCents(999_999_999_999, "999.99"),
    Number((999_999_999_999n * 99_999n + 5_000n) / 10_000n),
  );
});

test("resolves persisted selling-unit prices and stock conversions", () => {
  const product = {
    selling_price: "350.00",
    wholesale_price: "300.00",
    base_unit: "bottle",
    has_pack: true,
    pack_size: 12,
    pack_unit_name: "Pack of 12",
    pack_retail_price: "4200.00",
    pack_wholesale_price: "3600.00",
    has_carton: true,
    carton_size: 24,
    carton_unit_name: "Carton of 24",
    carton_retail_price: "8200.00",
    carton_wholesale_price: "7000.00",
  };
  assert.deepEqual(resolveSellingTerms(product, "PACK", "WHOLESALE"), {
    factor: 12,
    unitName: "Pack of 12",
    priceCents: 360_000,
  });
  assert.deepEqual(resolveSellingTerms(product, "CARTON", "RETAIL"), {
    factor: 24,
    unitName: "Carton of 24",
    priceCents: 820_000,
  });
  assert.equal(
    resolveSellingTerms({ ...product, has_pack: false }, "PACK", "RETAIL"),
    null,
  );
});

test("rejects invalid checkout quantities and selling units", () => {
  assert.equal(parseCheckoutLine({ productId: "p1", quantity: 0 }), null);
  assert.equal(parseCheckoutLine({ productId: "p1", quantity: 1.5 }), null);
  assert.equal(
    parseCheckoutLine({ productId: "p1", quantity: 1, sellingUnit: "CASE" }),
    null,
  );
  assert.equal(
    parseCheckoutLine({ productId: " p1 ", quantity: 1 })?.productId,
    "p1",
  );
});
