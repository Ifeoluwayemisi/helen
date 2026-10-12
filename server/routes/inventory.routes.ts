import { FastifyPluginAsync } from 'fastify';
import { query, getClient } from '../db/pool';
import { requireRole, requireAuth } from '../middleware/auth';
import { logSecurityAudit } from '../auth/service';
import { StockMovementType, SellingUnitType } from '../../src/types';

export const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/inventory/movements (Audit ledger of all stock movements)
  fastify.get('/api/inventory/movements', { preHandler: requireAuth }, async (request, reply) => {
    try {
      const { productId, limit } = request.query as {
        productId?: string;
        limit?: string;
      };

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (productId && productId.trim()) {
        params.push(productId.trim());
        conditions.push(`product_id = $${params.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitVal = limit && !isNaN(parseInt(limit, 10)) ? Math.min(parseInt(limit, 10), 200) : 100;
      params.push(limitVal);

      const sql = `
        SELECT 
          id,
          product_id AS "productId",
          product_name AS "productName",
          sku,
          type,
          quantity_change AS "quantityChange",
          previous_quantity AS "previousQuantity",
          resulting_quantity AS "resultingQuantity",
          user_id AS "userId",
          user_name AS "userName",
          transaction_id AS "transactionId",
          receipt_number AS "receiptNumber",
          note,
          created_at AS "timestamp"
        FROM stock_movements
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${params.length};
      `;

      const res = await query(sql, params);

      return reply.status(200).send({
        success: true,
        count: res.rowCount,
        movements: res.rows,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error retrieving stock movements');
      return reply.status(500).send({ success: false, error: 'Failed to retrieve inventory movements.' });
    }
  });

  // POST /api/inventory/receive (Authorized Goods Intake / Delivery)
  // Permitted roles: ADMIN, INVENTORY. Cashiers are blocked (403).
  fastify.post('/api/inventory/receive', { preHandler: requireRole(['ADMIN', 'INVENTORY']) }, async (request, reply) => {
    const {
      productId,
      quantity,
      sellingUnit,
      unitCost,
      supplier,
      note,
    } = request.body as {
      productId?: string;
      quantity?: number;
      sellingUnit?: SellingUnitType;
      unitCost?: number;
      supplier?: string;
      note?: string;
    };

    if (!productId || !productId.trim()) {
      return reply.status(400).send({ success: false, error: 'Product ID is required.' });
    }

    const qty = Number(quantity);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      return reply.status(400).send({ success: false, error: 'Received quantity must be a positive integer.' });
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // 1. Fetch product with row-level lock
      const prodRes = await client.query(
        `SELECT id, name, sku, stock_quantity, base_unit, has_pack, pack_size, pack_unit_name, has_carton, carton_size, carton_unit_name 
         FROM products WHERE id = $1 FOR UPDATE;`,
        [productId.trim()]
      );

      if (prodRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ success: false, error: 'Product not found in catalog.' });
      }

      const product = prodRes.rows[0];
      const prevQty = Number(product.stock_quantity);

      // 2. Compute conversion multiplier based on selling unit
      let multiplier = 1;
      let unitLabel = product.base_unit || 'base units';

      if (sellingUnit === 'PACK' && product.has_pack && product.pack_size > 1) {
        multiplier = product.pack_size;
        unitLabel = product.pack_unit_name || `Pack of ${product.pack_size}`;
      } else if (sellingUnit === 'CARTON' && product.has_carton && product.carton_size > 1) {
        multiplier = product.carton_size;
        unitLabel = product.carton_unit_name || `Carton of ${product.carton_size}`;
      }

      const totalBaseQuantity = qty * multiplier;
      const newQty = prevQty + totalBaseQuantity;

      // 3. Update product stock quantity
      const updateRes = await client.query(
        `UPDATE products 
         SET stock_quantity = $1, 
             cost_price = COALESCE($2, cost_price),
             updated_at = NOW() 
         WHERE id = $3 
         RETURNING 
           id, name, category_id AS "categoryId", sku, barcode, 
           selling_price::float AS "sellingPrice", 
           wholesale_price::float AS "wholesalePrice",
           cost_price::float AS "costPrice", 
           stock_quantity AS "stockQuantity", 
           min_stock_threshold AS "minStockThreshold", 
           base_unit AS "baseUnit", 
           has_pack AS "hasPack", pack_unit_name AS "packUnitName", pack_size AS "packSize", 
           pack_retail_price::float AS "packRetailPrice", pack_wholesale_price::float AS "packWholesalePrice",
           has_carton AS "hasCarton", carton_unit_name AS "cartonUnitName", carton_size AS "cartonSize", 
           carton_retail_price::float AS "cartonRetailPrice", carton_wholesale_price::float AS "cartonWholesalePrice",
           active, created_at AS "createdAt", updated_at AS "updatedAt";`,
        [newQty, unitCost !== undefined && unitCost >= 0 ? unitCost : null, productId.trim()]
      );

      // 4. Insert immutable stock movement
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const movementNote = [
        `Received ${qty} ${unitLabel} (${totalBaseQuantity} ${product.base_unit}s)`,
        supplier ? `Supplier: ${supplier}` : null,
        note ? `Note: ${note}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const user = request.currentUser!;
      await client.query(
        `INSERT INTO stock_movements (
           id, product_id, product_name, sku, type, quantity_change, 
           previous_quantity, resulting_quantity, user_id, user_name, note
         ) VALUES ($1, $2, $3, $4, 'RECEIVED', $5, $6, $7, $8, $9, $10);`,
        [
          movementId,
          product.id,
          product.name,
          product.sku,
          totalBaseQuantity,
          prevQty,
          newQty,
          user.id,
          user.name,
          movementNote,
        ]
      );

      // 5. Commit transaction
      await client.query('COMMIT');

      // 6. Security & Audit log
      await logSecurityAudit(
        user.id,
        user.name,
        'STOCK_RECEIVE',
        `Received stock for ${product.name} (+${totalBaseQuantity} ${product.base_unit}s, from ${prevQty} to ${newQty})`,
        request.ip
      );

      return reply.status(200).send({
        success: true,
        message: `Successfully received ${qty} ${unitLabel} (${totalBaseQuantity} ${product.base_unit}s). New stock: ${newQty}.`,
        product: updateRes.rows[0],
        received: {
          inputQuantity: qty,
          sellingUnit: sellingUnit || 'BASE',
          multiplier,
          totalBaseUnits: totalBaseQuantity,
          previousQuantity: prevQty,
          resultingQuantity: newQty,
        },
      });
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      fastify.log.error(err, 'Error receiving stock');
      return reply.status(500).send({ success: false, error: 'Failed to record stock intake.' });
    } finally {
      client.release();
    }
  });

  // POST /api/inventory/adjust (Authorized Stock Reconciliation / Audit Adjustment)
  // Permitted roles: ADMIN, INVENTORY. Cashiers blocked (403).
  fastify.post('/api/inventory/adjust', { preHandler: requireRole(['ADMIN', 'INVENTORY']) }, async (request, reply) => {
    const {
      productId,
      newQuantity,
      reason,
      note,
    } = request.body as {
      productId?: string;
      newQuantity?: number;
      reason?: StockMovementType;
      note?: string;
    };

    if (!productId || !productId.trim()) {
      return reply.status(400).send({ success: false, error: 'Product ID is required.' });
    }

    const newQty = Number(newQuantity);
    if (isNaN(newQty) || newQty < 0 || !Number.isInteger(newQty)) {
      return reply.status(400).send({
        success: false,
        error: 'New quantity must be a non-negative integer. Negative stock is not permitted.',
      });
    }

    if (!note || !note.trim()) {
      return reply.status(400).send({
        success: false,
        error: 'A reason note is required for authorized inventory adjustments.',
      });
    }

    const validReasons: StockMovementType[] = ['ADJUSTMENT', 'DAMAGED', 'RETURN'];
    const movementReason: StockMovementType = reason && validReasons.includes(reason) ? reason : 'ADJUSTMENT';

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Fetch current product with lock
      const prodRes = await client.query(
        `SELECT id, name, sku, stock_quantity, base_unit 
         FROM products WHERE id = $1 FOR UPDATE;`,
        [productId.trim()]
      );

      if (prodRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.status(404).send({ success: false, error: 'Product not found.' });
      }

      const product = prodRes.rows[0];
      const prevQty = Number(product.stock_quantity);
      const qtyChange = newQty - prevQty;

      if (qtyChange === 0) {
        await client.query('ROLLBACK');
        return reply.status(400).send({
          success: false,
          error: `Stock is already ${newQty} ${product.base_unit}s. No adjustment needed.`,
        });
      }

      // Update product stock
      const updateRes = await client.query(
        `UPDATE products 
         SET stock_quantity = $1, updated_at = NOW() 
         WHERE id = $2 
         RETURNING 
           id, name, category_id AS "categoryId", sku, barcode, 
           selling_price::float AS "sellingPrice", 
           wholesale_price::float AS "wholesalePrice",
           cost_price::float AS "costPrice", 
           stock_quantity AS "stockQuantity", 
           min_stock_threshold AS "minStockThreshold", 
           base_unit AS "baseUnit", 
           has_pack AS "hasPack", pack_unit_name AS "packUnitName", pack_size AS "packSize", 
           pack_retail_price::float AS "packRetailPrice", pack_wholesale_price::float AS "packWholesalePrice",
           has_carton AS "hasCarton", carton_unit_name AS "cartonUnitName", carton_size AS "cartonSize", 
           carton_retail_price::float AS "cartonRetailPrice", carton_wholesale_price::float AS "cartonWholesalePrice",
           active, created_at AS "createdAt", updated_at AS "updatedAt";`,
        [newQty, productId.trim()]
      );

      // Record movement
      const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const user = request.currentUser!;

      await client.query(
        `INSERT INTO stock_movements (
           id, product_id, product_name, sku, type, quantity_change, 
           previous_quantity, resulting_quantity, user_id, user_name, note
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [
          movementId,
          product.id,
          product.name,
          product.sku,
          movementReason,
          qtyChange,
          prevQty,
          newQty,
          user.id,
          user.name,
          `Reason: ${movementReason} | Note: ${note.trim()}`,
        ]
      );

      await client.query('COMMIT');

      // Audit log
      await logSecurityAudit(
        user.id,
        user.name,
        'STOCK_ADJUSTMENT',
        `Adjusted stock for ${product.name} (${qtyChange > 0 ? `+${qtyChange}` : qtyChange} ${product.base_unit}s, from ${prevQty} to ${newQty}. Reason: ${movementReason}, Note: ${note.trim()})`,
        request.ip
      );

      return reply.status(200).send({
        success: true,
        message: `Stock for ${product.name} adjusted from ${prevQty} to ${newQty} ${product.base_unit}s.`,
        product: updateRes.rows[0],
        adjustment: {
          previousQuantity: prevQty,
          resultingQuantity: newQty,
          quantityChange: qtyChange,
          reason: movementReason,
        },
      });
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      fastify.log.error(err, 'Error adjusting stock');
      return reply.status(500).send({ success: false, error: 'Failed to adjust stock.' });
    } finally {
      client.release();
    }
  });
};
