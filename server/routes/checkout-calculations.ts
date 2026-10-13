export interface CheckoutLine {
  productId: string;
  quantity: number;
  sellingUnit: "BASE" | "PACK" | "CARTON";
  priceTier: "RETAIL" | "WHOLESALE";
}

export function parseCheckoutLine(value: unknown): CheckoutLine | null {
  if (!value || typeof value !== "object") return null;
  const line = value as Record<string, unknown>;
  if (
    typeof line.productId !== "string" ||
    !line.productId.trim() ||
    line.productId.length > 64
  )
    return null;
  if (
    typeof line.quantity !== "number" ||
    !Number.isSafeInteger(line.quantity) ||
    line.quantity <= 0 ||
    line.quantity > 1_000_000
  )
    return null;
  const sellingUnit = line.sellingUnit ?? "BASE";
  const priceTier = line.priceTier ?? "RETAIL";
  if (!["BASE", "PACK", "CARTON"].includes(String(sellingUnit))) return null;
  if (!["RETAIL", "WHOLESALE"].includes(String(priceTier))) return null;
  return {
    productId: line.productId.trim(),
    quantity: line.quantity,
    sellingUnit: sellingUnit as CheckoutLine["sellingUnit"],
    priceTier: priceTier as CheckoutLine["priceTier"],
  };
}

export function parseCents(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(cents);
}

export function calculateDiscountCents(
  subtotalCents: number,
  value: unknown,
  type: "fixed" | "percentage",
): number | null {
  const amount = parseCents(value);
  if (amount === null) return null;
  if (type === "fixed") return Math.min(subtotalCents, amount);
  if (amount > 10_000) return null;
  const percentageDiscount = Number(
    (BigInt(subtotalCents) * BigInt(amount) + 5_000n) / 10_000n,
  );
  return Math.min(subtotalCents, percentageDiscount);
}

export function calculateTaxCents(
  taxableCents: number,
  taxRate: unknown,
): number | null {
  const rate = parseCents(taxRate);
  if (rate === null) return null;
  const tax = (BigInt(taxableCents) * BigInt(rate) + 5_000n) / 10_000n;
  return tax > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(tax);
}

export function resolveSellingTerms(
  product: Record<string, unknown>,
  sellingUnit: "BASE" | "PACK" | "CARTON",
  priceTier: "RETAIL" | "WHOLESALE",
): { factor: number; unitName: string; priceCents: number } | null {
  const basePriceCents = parseCents(String(product.selling_price));
  if (basePriceCents === null) return null;

  if (sellingUnit === "BASE") {
    const rawPrice =
      priceTier === "WHOLESALE"
        ? (product.wholesale_price ?? product.selling_price)
        : product.selling_price;
    const priceCents = parseCents(String(rawPrice));
    return priceCents === null
      ? null
      : {
          factor: 1,
          unitName:
            typeof product.base_unit === "string" ? product.base_unit : "unit",
          priceCents,
        };
  }

  const prefix = sellingUnit === "PACK" ? "pack" : "carton";
  const enabled = product[`has_${prefix}`] === true;
  const factor = product[`${prefix}_size`];
  if (
    !enabled ||
    typeof factor !== "number" ||
    !Number.isSafeInteger(factor) ||
    factor <= 1
  )
    return null;

  const storedRetailPrice = product[`${prefix}_retail_price`];
  const retailCents =
    storedRetailPrice === null || storedRetailPrice === undefined
      ? basePriceCents * factor
      : parseCents(String(storedRetailPrice));
  if (retailCents === null || !Number.isSafeInteger(retailCents)) return null;
  const storedWholesalePrice = product[`${prefix}_wholesale_price`];
  const priceCents =
    priceTier === "WHOLESALE"
      ? storedWholesalePrice === null || storedWholesalePrice === undefined
        ? retailCents
        : parseCents(String(storedWholesalePrice))
      : retailCents;
  if (priceCents === null) return null;
  const configuredName = product[`${prefix}_unit_name`];
  const defaultName = `${sellingUnit === "PACK" ? "Pack" : "Carton"} of ${factor}`;
  return {
    factor,
    unitName:
      typeof configuredName === "string" && configuredName
        ? configuredName
        : defaultName,
    priceCents,
  };
}
