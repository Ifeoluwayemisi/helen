import { createHash, randomUUID } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { getClient, query } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  calculateDiscountCents,
  calculateTaxCents,
  CheckoutLine,
  parseCents,
  parseCheckoutLine,
  resolveSellingTerms,
} from "./checkout-calculations";

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "POS_CARD";
const MAX_MONEY_CENTS = 999_999_999_999;

interface CheckoutBody {
  items?: CheckoutLine[];
  discount?: { value?: unknown; type?: unknown };
  paymentMethod?: unknown;
  amountPaid?: unknown;
  paymentReference?: unknown;
  paymentConfirmed?: unknown;
}

const saleSelect = `
  SELECT id, receipt_number AS "receiptNumber", cashier_id AS "cashierId", cashier_name AS "cashierName",
         subtotal::float AS subtotal, discount::float AS discount, discount_type AS "discountType",
         tax_amount::float AS "taxAmount", total::float AS total, amount_paid::float AS "amountPaid",
         change_amount::float AS "changeAmount", payment_method AS "paymentMethod",
         payment_reference AS "paymentReference", payment_confirmed_by AS "paymentConfirmedBy",
         status, created_at AS "createdAt", idempotency_key AS "idempotencyKey"
  FROM sales WHERE id = $1`;

async function loadSale(
  client: Awaited<ReturnType<typeof getClient>>,
  saleId: string,
) {
  const result = await client.query(saleSelect, [saleId]);
  if (!result.rows[0]) return null;
  const sale = result.rows[0];
  const items = await client.query(
    `SELECT id, product_id AS "productId", product_name AS "productName", sku, quantity,
            unit_price::float AS "unitPrice", cost_price_snapshot::float AS "costPriceSnapshot",
            line_total::float AS "lineTotal", selling_unit AS "sellingUnit",
            selling_unit_name AS "sellingUnitName", conversion_factor AS "conversionFactor",
            price_tier AS "priceTier"
     FROM sale_items WHERE sale_id = $1 ORDER BY id`,
    [saleId],
  );
  return { ...sale, items: items.rows };
}

function toMoney(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export const salesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/api/sales",
    { preHandler: requireRole(["ADMIN", "CASHIER"]) },
    async (request, reply) => {
      const key = request.headers["idempotency-key"];
      if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
        return reply
          .status(400)
          .send({
            success: false,
            error: "A valid Idempotency-Key header is required.",
          });
      }

      const body = request.body as CheckoutBody | null;
      if (
        !body ||
        !Array.isArray(body.items) ||
        body.items.length === 0 ||
        body.items.length > 100
      ) {
        return reply
          .status(400)
          .send({
            success: false,
            error: "Checkout must include between 1 and 100 items.",
          });
      }
      const items = body.items.map(parseCheckoutLine);
      if (items.some((line) => line === null)) {
        return reply
          .status(400)
          .send({
            success: false,
            error:
              "Each item requires a product ID, positive integer quantity, supported selling unit, and price tier.",
          });
      }
      const lines = items as CheckoutLine[];
      const lineKeys = lines.map((line) =>
        JSON.stringify([line.productId, line.sellingUnit, line.priceTier]),
      );
      if (new Set(lineKeys).size !== lineKeys.length) {
        return reply
          .status(400)
          .send({
            success: false,
            error: "Duplicate checkout lines are not supported.",
          });
      }

      const paymentMethod = body.paymentMethod;
      if (
        !["CASH", "BANK_TRANSFER", "POS_CARD"].includes(String(paymentMethod))
      ) {
        return reply
          .status(400)
          .send({ success: false, error: "Unsupported payment method." });
      }
      const amountPaidCents = parseCents(body.amountPaid);
      if (amountPaidCents === null || amountPaidCents > MAX_MONEY_CENTS) {
        return reply
          .status(400)
          .send({
            success: false,
            error:
              "Amount paid must be a non-negative amount with at most two decimal places.",
          });
      }
      if (
        body.paymentReference !== undefined &&
        (typeof body.paymentReference !== "string" ||
          body.paymentReference.length > 255)
      ) {
        return reply
          .status(400)
          .send({
            success: false,
            error: "Payment reference must be 255 characters or fewer.",
          });
      }
      if (paymentMethod !== "CASH" && body.paymentConfirmed !== true) {
        return reply
          .status(400)
          .send({
            success: false,
            error:
              "Confirm that the transfer or card payment was verified before recording it.",
          });
      }

      const discountType = body.discount?.type ?? "fixed";
      const discountValue = body.discount?.value ?? 0;
      if (discountType !== "fixed" && discountType !== "percentage") {
        return reply
          .status(400)
          .send({
            success: false,
            error: "Discount type must be fixed or percentage.",
          });
      }
      const discountInputCents = parseCents(discountValue);
      if (discountInputCents === null) {
        return reply
          .status(400)
          .send({
            success: false,
            error:
              "Discount must be a non-negative amount with at most two decimal places.",
          });
      }
      const canonicalLines = [...lines].sort((left, right) =>
        JSON.stringify([
          left.productId,
          left.sellingUnit,
          left.priceTier,
        ]).localeCompare(
          JSON.stringify([right.productId, right.sellingUnit, right.priceTier]),
        ),
      );
      const canonicalPayload = JSON.stringify({
        items: canonicalLines,
        discount: { value: discountInputCents, type: discountType },
        paymentMethod,
        amountPaidCents,
        paymentReference:
          typeof body.paymentReference === "string"
            ? body.paymentReference.trim()
            : "",
        paymentConfirmed: body.paymentConfirmed === true,
      });
      const payloadHash = createHash("sha256")
        .update(canonicalPayload)
        .digest("hex");
      const user = request.currentUser!;
      const client = await getClient();
      let transactionOpen = false;

      try {
        await client.query("BEGIN");
        transactionOpen = true;

        const claim = await client.query(
          `INSERT INTO checkout_idempotency (idempotency_key, payload_hash, sale_id, response_json)
         VALUES ($1, $2, NULL, '{}'::jsonb) ON CONFLICT (idempotency_key) DO NOTHING RETURNING idempotency_key`,
          [key, payloadHash],
        );
        if (claim.rowCount === 0) {
          const existing = await client.query(
            "SELECT payload_hash, sale_id, response_json FROM checkout_idempotency WHERE idempotency_key = $1 FOR UPDATE",
            [key],
          );
          if (
            !existing.rows[0] ||
            existing.rows[0].payload_hash !== payloadHash
          ) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return reply
              .status(409)
              .send({
                success: false,
                error:
                  "This idempotency key was already used for a different checkout request.",
              });
          }
          const savedSale = existing.rows[0].response_json;
          if (existing.rows[0].sale_id && savedSale?.id) {
            await client.query("COMMIT");
            transactionOpen = false;
            return reply
              .status(200)
              .send({ success: true, sale: savedSale, replayed: true });
          }
          await client.query("ROLLBACK");
          transactionOpen = false;
          return reply
            .status(409)
            .send({
              success: false,
              error:
                "Checkout is already being processed. Retry with the same key.",
            });
        }

        const productIds = [
          ...new Set(lines.map((line) => line.productId)),
        ].sort();
        const productResult = await client.query(
          `SELECT id, name, sku, active, selling_price, wholesale_price, stock_quantity, cost_price, base_unit,
                has_pack, pack_unit_name, pack_size, pack_retail_price, pack_wholesale_price,
                has_carton, carton_unit_name, carton_size, carton_retail_price, carton_wholesale_price
         FROM products WHERE id = ANY($1::varchar[]) ORDER BY id FOR UPDATE`,
          [productIds],
        );
        const products = new Map(
          productResult.rows.map((product) => [product.id, product]),
        );
        if (products.size !== productIds.length) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return reply
            .status(404)
            .send({
              success: false,
              error:
                "One or more products are no longer available in the catalog.",
            });
        }

        const settingsResult = await client.query(
          "SELECT enable_tax, tax_rate FROM business_settings WHERE id = 'default'",
        );
        const settings = settingsResult.rows[0];
        let subtotalCents = 0;
        const requestedBaseUnits = new Map<string, number>();
        const resolvedItems: Array<{
          line: CheckoutLine;
          product: Record<string, any>;
          unitName: string;
          factor: number;
          priceCents: number;
          lineCents: number;
          baseUnits: number;
        }> = [];

        for (const line of lines) {
          const product = products.get(line.productId)!;
          if (!product.active) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return reply
              .status(409)
              .send({
                success: false,
                error: `Product ${product.name} is inactive and cannot be sold.`,
              });
          }

          const terms = resolveSellingTerms(
            product,
            line.sellingUnit,
            line.priceTier,
          );
          if (!terms) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return reply
              .status(400)
              .send({
                success: false,
                error: `Product ${product.name} does not have a valid ${line.sellingUnit.toLowerCase()} selling price.`,
              });
          }
          const { factor, unitName, priceCents } = terms;
          const baseUnits = line.quantity * factor;
          const lineCents = priceCents * line.quantity;
          if (
            !Number.isSafeInteger(baseUnits) ||
            !Number.isSafeInteger(lineCents) ||
            lineCents < 0 ||
            !Number.isSafeInteger(subtotalCents + lineCents) ||
            subtotalCents + lineCents > MAX_MONEY_CENTS
          ) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return reply
              .status(400)
              .send({
                success: false,
                error:
                  "Checkout quantities or amounts exceed supported limits.",
              });
          }
          const totalRequested =
            (requestedBaseUnits.get(product.id) || 0) + baseUnits;
          requestedBaseUnits.set(product.id, totalRequested);
          if (
            !Number.isSafeInteger(totalRequested) ||
            totalRequested > Number(product.stock_quantity)
          ) {
            await client.query("ROLLBACK");
            transactionOpen = false;
            return reply
              .status(409)
              .send({
                success: false,
                error: `Insufficient stock for ${product.name}. Available: ${product.stock_quantity} ${product.base_unit}.`,
              });
          }
          subtotalCents += lineCents;
          resolvedItems.push({
            line,
            product,
            unitName,
            factor,
            priceCents,
            lineCents,
            baseUnits,
          });
        }

        const discountCents = calculateDiscountCents(
          subtotalCents,
          discountValue,
          discountType,
        );
        if (discountCents === null) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return reply
            .status(400)
            .send({
              success: false,
              error: "Percentage discount cannot exceed 100%.",
            });
        }
        const taxableCents = subtotalCents - discountCents;
        const taxCentsResult = settings?.enable_tax
          ? calculateTaxCents(taxableCents, settings.tax_rate)
          : 0;
        if (taxCentsResult === null)
          throw new Error("Invalid persisted tax configuration");
        const taxCents: number = taxCentsResult;
        const totalCents = taxableCents + taxCents;
        if (!Number.isSafeInteger(totalCents) || totalCents > MAX_MONEY_CENTS) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return reply
            .status(400)
            .send({
              success: false,
              error: "Checkout total exceeds the supported amount.",
            });
        }
        const method = paymentMethod as PaymentMethod;
        if (
          amountPaidCents < totalCents ||
          (method !== "CASH" && amountPaidCents !== totalCents)
        ) {
          await client.query("ROLLBACK");
          transactionOpen = false;
          return reply
            .status(400)
            .send({
              success: false,
              error:
                method === "CASH"
                  ? "Cash tender must cover the total due."
                  : "Verified transfer and card payments must equal the total due.",
            });
        }

        const saleId = `sale_${randomUUID()}`;
        const receiptNumber = `HS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const changeCents =
          method === "CASH" ? amountPaidCents - totalCents : 0;
        await client.query(
          `INSERT INTO sales (id, receipt_number, cashier_id, cashier_name, subtotal, discount, discount_type,
          tax_amount, total, amount_paid, change_amount, payment_method, payment_reference,
          payment_confirmed_by, status, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'COMPLETED',$15)`,
          [
            saleId,
            receiptNumber,
            user.id,
            user.name,
            toMoney(subtotalCents),
            toMoney(discountCents),
            discountType,
            toMoney(taxCents),
            toMoney(totalCents),
            toMoney(amountPaidCents),
            toMoney(changeCents),
            method,
            typeof body.paymentReference === "string"
              ? body.paymentReference.trim() || null
              : null,
            method === "CASH" ? null : user.name,
            key,
          ],
        );

        const remainingStock = new Map<string, number>();
        for (const item of resolvedItems) {
          const { line, product } = item;
          const previousQuantity =
            remainingStock.get(product.id) ?? Number(product.stock_quantity);
          const resultingQuantity = previousQuantity - item.baseUnits;
          await client.query(
            `INSERT INTO sale_items (id, sale_id, product_id, product_name, sku, quantity, unit_price,
             cost_price_snapshot, line_total, selling_unit, selling_unit_name, conversion_factor, price_tier)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              `si_${randomUUID()}`,
              saleId,
              product.id,
              product.name,
              product.sku,
              line.quantity,
              toMoney(item.priceCents),
              product.cost_price,
              toMoney(item.lineCents),
              line.sellingUnit,
              item.unitName,
              item.factor,
              line.priceTier,
            ],
          );
          await client.query(
            "UPDATE products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2",
            [resultingQuantity, product.id],
          );
          remainingStock.set(product.id, resultingQuantity);
          await client.query(
            `INSERT INTO stock_movements (id, product_id, product_name, sku, type, quantity_change,
             previous_quantity, resulting_quantity, user_id, user_name, transaction_id, receipt_number, note)
           VALUES ($1,$2,$3,$4,'SALE',$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
              `mov_${randomUUID()}`,
              product.id,
              product.name,
              product.sku,
              -item.baseUnits,
              previousQuantity,
              resultingQuantity,
              user.id,
              user.name,
              saleId,
              receiptNumber,
              `Sold ${line.quantity} ${item.unitName} (${item.baseUnits} ${product.base_unit})`,
            ],
          );
        }

        await client.query(
          `INSERT INTO payments (id, sale_id, payment_method, amount, payment_reference, confirmed_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,'SUCCESS')`,
          [
            `pay_${randomUUID()}`,
            saleId,
            method,
            toMoney(totalCents),
            typeof body.paymentReference === "string"
              ? body.paymentReference.trim() || null
              : null,
            method === "CASH" ? null : user.name,
          ],
        );
        await client.query(
          `INSERT INTO audit_logs (id, user_id, user_name, action_type, entity_type, entity_id, details)
         VALUES ($1,$2,$3,'SALE_COMPLETED','SALE',$4,$5)`,
          [
            `aud_${randomUUID()}`,
            user.id,
            user.name,
            saleId,
            `Completed receipt ${receiptNumber} for ${toMoney(totalCents)} via ${method}.`,
          ],
        );

        const sale = await loadSale(client, saleId);
        await client.query(
          "UPDATE checkout_idempotency SET sale_id = $1, response_json = $2::jsonb WHERE idempotency_key = $3",
          [saleId, JSON.stringify(sale), key],
        );
        await client.query("COMMIT");
        transactionOpen = false;
        return reply.status(201).send({ success: true, sale });
      } catch (error: unknown) {
        if (transactionOpen)
          await client.query("ROLLBACK").catch(() => undefined);
        fastify.log.error(error, "Checkout transaction failed");
        return reply
          .status(500)
          .send({
            success: false,
            error:
              "Checkout could not be completed. Please retry using the same idempotency key.",
          });
      } finally {
        client.release();
      }
    },
  );

  fastify.get(
    "/api/sales",
    { preHandler: requireAuth },
    async (request, reply) => {
      try {
        const user = request.currentUser!;
        const headers =
          user.role === "CASHIER"
            ? await query(
                saleSelect.replace(
                  " WHERE id = $1",
                  " WHERE cashier_id = $1 ORDER BY created_at DESC LIMIT 1000",
                ),
                [user.id],
              )
            : await query(
                `${saleSelect.replace(" WHERE id = $1", " ORDER BY created_at DESC LIMIT 1000")}`,
              );
        const ids = headers.rows.map((row) => row.id as string);
        const itemRows =
          ids.length === 0
            ? []
            : (
                await query(
                  `SELECT id, sale_id AS "saleId", product_id AS "productId", product_name AS "productName", sku, quantity,
                  unit_price::float AS "unitPrice", cost_price_snapshot::float AS "costPriceSnapshot",
                  line_total::float AS "lineTotal", selling_unit AS "sellingUnit",
                  selling_unit_name AS "sellingUnitName", conversion_factor AS "conversionFactor", price_tier AS "priceTier"
           FROM sale_items WHERE sale_id = ANY($1::varchar[]) ORDER BY sale_id, id`,
                  [ids],
                )
              ).rows;
        const itemsBySale = new Map<string, Record<string, unknown>[]>();
        for (const item of itemRows) {
          const saleItems = itemsBySale.get(item.saleId as string) || [];
          const { saleId, ...saleItem } = item;
          saleItems.push(saleItem);
          itemsBySale.set(saleId as string, saleItems);
        }
        const sales = headers.rows.map((sale) => ({
          ...sale,
          items: itemsBySale.get(sale.id as string) || [],
        }));
        return reply.status(200).send({ success: true, sales });
      } catch (error: unknown) {
        fastify.log.error(error, "Failed to retrieve sales");
        return reply
          .status(500)
          .send({ success: false, error: "Unable to retrieve sales history." });
      }
    },
  );
};
