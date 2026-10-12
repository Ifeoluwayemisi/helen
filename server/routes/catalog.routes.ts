import { FastifyPluginAsync } from 'fastify';
import { query, getClient } from '../db/pool';
import { requireRole } from '../middleware/auth';
import { logSecurityAudit } from '../auth/service';

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/products (Public / Staff catalog search)
  fastify.get('/api/products', async (request, reply) => {
    try {
      const { search, categoryId, activeOnly } = request.query as {
        search?: string;
        categoryId?: string;
        activeOnly?: string;
      };

      const conditions: string[] = [];
      const params: unknown[] = [];

      // By default filter active products unless explicitly requested
      if (activeOnly !== 'false') {
        conditions.push('active = true');
      }

      if (categoryId && categoryId.trim() && categoryId !== 'all') {
        params.push(categoryId.trim());
        conditions.push(`category_id = $${params.length}`);
      }

      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        conditions.push(
          `(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR barcode ILIKE $${params.length})`
        );
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `
        SELECT 
          id,
          name,
          category_id AS "categoryId",
          sku,
          barcode,
          selling_price::float AS "sellingPrice",
          wholesale_price::float AS "wholesalePrice",
          cost_price::float AS "costPrice",
          stock_quantity AS "stockQuantity",
          min_stock_threshold AS "minStockThreshold",
          base_unit AS "baseUnit",
          has_pack AS "hasPack",
          pack_unit_name AS "packUnitName",
          pack_size AS "packSize",
          pack_retail_price::float AS "packRetailPrice",
          pack_wholesale_price::float AS "packWholesalePrice",
          has_carton AS "hasCarton",
          carton_unit_name AS "cartonUnitName",
          carton_size AS "cartonSize",
          carton_retail_price::float AS "cartonRetailPrice",
          carton_wholesale_price::float AS "cartonWholesalePrice",
          active,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM products
        ${whereClause}
        ORDER BY name ASC;
      `;

      const result = await query(sql, params);
      return reply.status(200).send({
        success: true,
        count: result.rowCount,
        products: result.rows,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error fetching products from database');
      return reply.status(503).send({
        success: false,
        error: 'Unable to retrieve products. Database service is unavailable.',
      });
    }
  });

  // GET /api/products/:id (Get single product)
  fastify.get('/api/products/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const sql = `
        SELECT 
          id,
          name,
          category_id AS "categoryId",
          sku,
          barcode,
          selling_price::float AS "sellingPrice",
          wholesale_price::float AS "wholesalePrice",
          cost_price::float AS "costPrice",
          stock_quantity AS "stockQuantity",
          min_stock_threshold AS "minStockThreshold",
          base_unit AS "baseUnit",
          has_pack AS "hasPack",
          pack_unit_name AS "packUnitName",
          pack_size AS "packSize",
          pack_retail_price::float AS "packRetailPrice",
          pack_wholesale_price::float AS "packWholesalePrice",
          has_carton AS "hasCarton",
          carton_unit_name AS "cartonUnitName",
          carton_size AS "cartonSize",
          carton_retail_price::float AS "cartonRetailPrice",
          carton_wholesale_price::float AS "cartonWholesalePrice",
          active,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM products
        WHERE id = $1
        LIMIT 1;
      `;

      const result = await query(sql, [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Product not found.' });
      }

      return reply.status(200).send({
        success: true,
        product: result.rows[0],
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error fetching product by ID');
      return reply.status(500).send({ success: false, error: 'Failed to retrieve product details.' });
    }
  });

  // POST /api/products (Quick product registration)
  // Protected: ADMIN or INVENTORY role required. Cashiers blocked (403).
  fastify.post('/api/products', { preHandler: requireRole(['ADMIN', 'INVENTORY']) }, async (request, reply) => {
    try {
      const {
        name,
        categoryId,
        sku,
        barcode,
        sellingPrice,
        wholesalePrice,
        costPrice,
        baseUnit,
        minStockThreshold,
        openingStock,
        hasPack,
        packUnitName,
        packSize,
        packRetailPrice,
        packWholesalePrice,
        hasCarton,
        cartonUnitName,
        cartonSize,
        cartonRetailPrice,
        cartonWholesalePrice,
      } = request.body as {
        name?: string;
        categoryId?: string;
        sku?: string;
        barcode?: string;
        sellingPrice?: number;
        wholesalePrice?: number;
        costPrice?: number;
        baseUnit?: string;
        minStockThreshold?: number;
        openingStock?: number;
        hasPack?: boolean;
        packUnitName?: string;
        packSize?: number;
        packRetailPrice?: number;
        packWholesalePrice?: number;
        hasCarton?: boolean;
        cartonUnitName?: string;
        cartonSize?: number;
        cartonRetailPrice?: number;
        cartonWholesalePrice?: number;
      };

      // 1. Validation
      if (!name || !name.trim()) {
        return reply.status(400).send({ success: false, error: 'Product name is required.' });
      }
      if (!categoryId || !categoryId.trim()) {
        return reply.status(400).send({ success: false, error: 'Product category is required.' });
      }

      const retailPriceNum = Number(sellingPrice);
      if (isNaN(retailPriceNum) || retailPriceNum < 0) {
        return reply.status(400).send({ success: false, error: 'Retail selling price must be a non-negative number.' });
      }

      // 2. Barcode normalization & collision prevention
      const cleanBarcode = barcode && barcode.trim().length > 0 ? barcode.trim() : null;
      if (cleanBarcode) {
        const barcodeCheck = await query('SELECT id, name FROM products WHERE barcode = $1;', [cleanBarcode]);
        if (barcodeCheck.rowCount && barcodeCheck.rowCount > 0) {
          return reply.status(409).send({
            success: false,
            error: `A product with barcode "${cleanBarcode}" already exists (${barcodeCheck.rows[0].name}).`,
          });
        }
      }

      // 3. SKU normalization & auto-generation if omitted
      let cleanSku = sku && sku.trim().length > 0 ? sku.trim().toUpperCase() : null;
      if (cleanSku) {
        const skuCheck = await query('SELECT id FROM products WHERE sku = $1;', [cleanSku]);
        if (skuCheck.rowCount && skuCheck.rowCount > 0) {
          return reply.status(409).send({
            success: false,
            error: `A product with SKU "${cleanSku}" already exists.`,
          });
        }
      } else {
        // Auto-generate clean SKU for drinks distribution
        const catPrefix = categoryId.replace(/^cat_/, '').substring(0, 3).toUpperCase();
        cleanSku = `${catPrefix || 'PRD'}-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
      }

      // 4. Selling units validation
      const resolvedBaseUnit = baseUnit && baseUnit.trim() ? baseUnit.trim().toLowerCase() : 'bottle';
      const cleanPack = Boolean(hasPack);
      const cleanCarton = Boolean(hasCarton);

      if (cleanPack) {
        if (!packSize || packSize <= 1) {
          return reply.status(400).send({ success: false, error: 'Pack size must be greater than 1 base unit.' });
        }
      }

      if (cleanCarton) {
        if (!cartonSize || cartonSize <= 1) {
          return reply.status(400).send({ success: false, error: 'Carton size must be greater than 1 base unit.' });
        }
      }

      const initialStock = openingStock && !isNaN(Number(openingStock)) ? Math.max(0, Math.floor(Number(openingStock))) : 0;
      const minStock = minStockThreshold && !isNaN(Number(minStockThreshold)) ? Math.max(0, Math.floor(Number(minStockThreshold))) : 5;
      const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const client = await getClient();
      try {
        await client.query('BEGIN');

        // Insert product
        const insertSql = `
          INSERT INTO products (
            id, name, category_id, sku, barcode, selling_price, wholesale_price, cost_price,
            stock_quantity, min_stock_threshold, base_unit,
            has_pack, pack_unit_name, pack_size, pack_retail_price, pack_wholesale_price,
            has_carton, carton_unit_name, carton_size, carton_retail_price, carton_wholesale_price,
            active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            TRUE, NOW(), NOW()
          ) RETURNING 
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
            active, created_at AS "createdAt", updated_at AS "updatedAt";
        `;

        const newProdRes = await client.query(insertSql, [
          productId,
          name.trim(),
          categoryId.trim(),
          cleanSku,
          cleanBarcode,
          retailPriceNum,
          wholesalePrice !== undefined && wholesalePrice !== null ? Number(wholesalePrice) : null,
          costPrice !== undefined && costPrice !== null ? Number(costPrice) : null,
          initialStock,
          minStock,
          resolvedBaseUnit,
          cleanPack,
          cleanPack ? (packUnitName?.trim() || `Pack of ${packSize}`) : null,
          cleanPack ? packSize : null,
          cleanPack && packRetailPrice !== undefined ? Number(packRetailPrice) : null,
          cleanPack && packWholesalePrice !== undefined ? Number(packWholesalePrice) : null,
          cleanCarton,
          cleanCarton ? (cartonUnitName?.trim() || `Carton of ${cartonSize}`) : null,
          cleanCarton ? cartonSize : null,
          cleanCarton && cartonRetailPrice !== undefined ? Number(cartonRetailPrice) : null,
          cleanCarton && cartonWholesalePrice !== undefined ? Number(cartonWholesalePrice) : null,
        ]);

        const newProduct = newProdRes.rows[0];
        const user = request.currentUser!;

        // Safe initial opening stock tracking: Record stock movement
        if (initialStock > 0) {
          const movementId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          await client.query(
            `INSERT INTO stock_movements (
               id, product_id, product_name, sku, type, quantity_change, 
               previous_quantity, resulting_quantity, user_id, user_name, note
             ) VALUES ($1, $2, $3, $4, 'OPENING_STOCK', $5, 0, $5, $6, $7, $8);`,
            [
              movementId,
              newProduct.id,
              newProduct.name,
              newProduct.sku,
              initialStock,
              user.id,
              user.name,
              `Opening stock initialized at ${initialStock} ${resolvedBaseUnit}s`,
            ]
          );
        }

        await client.query('COMMIT');

        // Security & Catalog audit log
        await logSecurityAudit(
          user.id,
          user.name,
          'PRODUCT_CREATE',
          `Registered product ${newProduct.name} (SKU: ${newProduct.sku}, Base unit: ${resolvedBaseUnit}, Retail: ₦${retailPriceNum}, Opening stock: ${initialStock})`,
          request.ip
        );

        return reply.status(201).send({
          success: true,
          message: 'Product registered successfully.',
          product: newProduct,
        });
      } catch (insertErr: unknown) {
        await client.query('ROLLBACK');
        fastify.log.error(insertErr, 'Error registering product');
        return reply.status(500).send({ success: false, error: 'Database error registering product.' });
      } finally {
        client.release();
      }
    } catch (err: unknown) {
      fastify.log.error(err, 'Product registration exception');
      return reply.status(500).send({ success: false, error: 'Failed to create product.' });
    }
  });

  // PATCH /api/products/:id (Update product details, selling units, prices)
  // Protected: ADMIN or INVENTORY role required. Cashiers blocked (403).
  fastify.patch('/api/products/:id', { preHandler: requireRole(['ADMIN', 'INVENTORY']) }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<{
        name: string;
        categoryId: string;
        sku: string;
        barcode: string;
        sellingPrice: number;
        wholesalePrice: number;
        costPrice: number;
        baseUnit: string;
        minStockThreshold: number;
        active: boolean;
        hasPack: boolean;
        packUnitName: string;
        packSize: number;
        packRetailPrice: number;
        packWholesalePrice: number;
        hasCarton: boolean;
        cartonUnitName: string;
        cartonSize: number;
        cartonRetailPrice: number;
        cartonWholesalePrice: number;
      }>;

      // 1. Fetch existing product
      const existingRes = await query(`SELECT * FROM products WHERE id = $1;`, [id]);
      if (existingRes.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Product not found.' });
      }
      const existing = existingRes.rows[0];

      // 2. Barcode collision validation
      let cleanBarcode = existing.barcode;
      if (body.barcode !== undefined) {
        const trimmed = body.barcode?.trim();
        cleanBarcode = trimmed && trimmed.length > 0 ? trimmed : null;
        if (cleanBarcode && cleanBarcode !== existing.barcode) {
          const colRes = await query('SELECT id, name FROM products WHERE barcode = $1 AND id <> $2;', [cleanBarcode, id]);
          if (colRes.rowCount && colRes.rowCount > 0) {
            return reply.status(409).send({
              success: false,
              error: `Barcode "${cleanBarcode}" is already assigned to ${colRes.rows[0].name}.`,
            });
          }
        }
      }

      // 3. Price change tracking & authorization
      const user = request.currentUser!;
      const isPriceChanging =
        (body.sellingPrice !== undefined && Number(body.sellingPrice) !== Number(existing.selling_price)) ||
        (body.wholesalePrice !== undefined && Number(body.wholesalePrice) !== Number(existing.wholesale_price));

      // Cashiers cannot change price; INVENTORY can edit stock/details, ADMIN has full authorization
      if (isPriceChanging && user.role === 'CASHIER') {
        return reply.status(403).send({ success: false, error: 'Cashiers are not permitted to change product prices.' });
      }

      const updatedName = body.name !== undefined ? body.name.trim() : existing.name;
      const updatedCategoryId = body.categoryId !== undefined ? body.categoryId.trim() : existing.category_id;
      const updatedSellingPrice = body.sellingPrice !== undefined ? Math.max(0, Number(body.sellingPrice)) : Number(existing.selling_price);
      const updatedWholesalePrice = body.wholesalePrice !== undefined ? (body.wholesalePrice !== null ? Math.max(0, Number(body.wholesalePrice)) : null) : existing.wholesale_price;
      const updatedCostPrice = body.costPrice !== undefined ? (body.costPrice !== null ? Math.max(0, Number(body.costPrice)) : null) : existing.cost_price;
      const updatedBaseUnit = body.baseUnit !== undefined ? body.baseUnit.trim().toLowerCase() : existing.base_unit;
      const updatedMinStock = body.minStockThreshold !== undefined ? Math.max(0, Number(body.minStockThreshold)) : existing.min_stock_threshold;
      const updatedActive = body.active !== undefined ? Boolean(body.active) : existing.active;

      const updatedHasPack = body.hasPack !== undefined ? Boolean(body.hasPack) : existing.has_pack;
      const updatedPackSize = body.packSize !== undefined ? body.packSize : existing.pack_size;
      const updatedPackUnitName = body.packUnitName !== undefined ? body.packUnitName : existing.pack_unit_name;
      const updatedPackRetailPrice = body.packRetailPrice !== undefined ? body.packRetailPrice : existing.pack_retail_price;
      const updatedPackWholesalePrice = body.packWholesalePrice !== undefined ? body.packWholesalePrice : existing.pack_wholesale_price;

      const updatedHasCarton = body.hasCarton !== undefined ? Boolean(body.hasCarton) : existing.has_carton;
      const updatedCartonSize = body.cartonSize !== undefined ? body.cartonSize : existing.carton_size;
      const updatedCartonUnitName = body.cartonUnitName !== undefined ? body.cartonUnitName : existing.carton_unit_name;
      const updatedCartonRetailPrice = body.cartonRetailPrice !== undefined ? body.cartonRetailPrice : existing.carton_retail_price;
      const updatedCartonWholesalePrice = body.cartonWholesalePrice !== undefined ? body.cartonWholesalePrice : existing.carton_wholesale_price;

      const updateSql = `
        UPDATE products SET
          name = $1,
          category_id = $2,
          barcode = $3,
          selling_price = $4,
          wholesale_price = $5,
          cost_price = $6,
          base_unit = $7,
          min_stock_threshold = $8,
          active = $9,
          has_pack = $10,
          pack_size = $11,
          pack_unit_name = $12,
          pack_retail_price = $13,
          pack_wholesale_price = $14,
          has_carton = $15,
          carton_size = $16,
          carton_unit_name = $17,
          carton_retail_price = $18,
          carton_wholesale_price = $19,
          updated_at = NOW()
        WHERE id = $20
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
          active, created_at AS "createdAt", updated_at AS "updatedAt";
      `;

      const updateRes = await query(updateSql, [
        updatedName,
        updatedCategoryId,
        cleanBarcode,
        updatedSellingPrice,
        updatedWholesalePrice,
        updatedCostPrice,
        updatedBaseUnit,
        updatedMinStock,
        updatedActive,
        updatedHasPack,
        updatedPackSize,
        updatedPackUnitName,
        updatedPackRetailPrice,
        updatedPackWholesalePrice,
        updatedHasCarton,
        updatedCartonSize,
        updatedCartonUnitName,
        updatedCartonRetailPrice,
        updatedCartonWholesalePrice,
        id,
      ]);

      const updatedProduct = updateRes.rows[0];

      // Audit logs
      if (isPriceChanging) {
        await logSecurityAudit(
          user.id,
          user.name,
          'PRICE_CHANGE',
          `Changed price for ${updatedProduct.name}: Retail ₦${existing.selling_price} -> ₦${updatedSellingPrice}${
            updatedWholesalePrice ? `, Wholesale ₦${existing.wholesale_price} -> ₦${updatedWholesalePrice}` : ''
          }`,
          request.ip
        );
      } else {
        await logSecurityAudit(
          user.id,
          user.name,
          'PRODUCT_UPDATE',
          `Updated product ${updatedProduct.name} details (Active: ${updatedActive})`,
          request.ip
        );
      }

      return reply.status(200).send({
        success: true,
        message: 'Product updated successfully.',
        product: updatedProduct,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error updating product');
      return reply.status(500).send({ success: false, error: 'Failed to update product.' });
    }
  });

  // GET /api/categories (Public / Staff categories list)
  fastify.get('/api/categories', async (_request, reply) => {
    try {
      const sql = `
        SELECT
          id,
          name,
          description,
          active,
          created_at AS "createdAt"
        FROM categories
        WHERE active = true
        ORDER BY name ASC;
      `;

      const result = await query(sql);
      return reply.status(200).send({
        success: true,
        count: result.rowCount,
        categories: result.rows,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error fetching categories from database');
      return reply.status(503).send({
        success: false,
        error: 'Unable to retrieve categories. Database service is unavailable.',
      });
    }
  });

  // GET /api/settings (Store business settings)
  fastify.get('/api/settings', async (_request, reply) => {
    try {
      const sql = `
        SELECT
          store_name AS "storeName",
          branch_name AS "branchName",
          phone,
          address,
          currency,
          receipt_footer AS "receiptFooter",
          tax_rate::float AS "taxRate",
          enable_tax AS "enableTax",
          low_stock_global_threshold AS "lowStockGlobalThreshold",
          timezone,
          bank_name AS "bankName",
          account_name AS "accountName",
          account_number AS "accountNumber"
        FROM business_settings
        WHERE id = 'default'
        LIMIT 1;
      `;

      const result = await query(sql);
      if (result.rowCount === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Store settings record not found.',
        });
      }

      const row = result.rows[0];
      const settings = {
        storeName: row.storeName,
        branchName: row.branchName,
        phone: row.phone,
        address: row.address,
        currency: row.currency,
        receiptFooter: row.receiptFooter,
        taxRate: row.taxRate,
        enableTax: row.enableTax,
        lowStockGlobalThreshold: row.lowStockGlobalThreshold,
        timezone: row.timezone,
        bankDetails: row.bankName
          ? {
              bankName: row.bankName,
              accountName: row.accountName,
              accountNumber: row.accountNumber,
            }
          : undefined,
      };

      return reply.status(200).send({
        success: true,
        settings,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error fetching settings from database');
      return reply.status(503).send({
        success: false,
        error: 'Unable to retrieve business settings. Database service is unavailable.',
      });
    }
  });
};
