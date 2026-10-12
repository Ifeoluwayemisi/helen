import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';

export const catalogRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/products
  fastify.get('/api/products', async (request, reply) => {
    try {
      const { search, categoryId } = request.query as {
        search?: string;
        categoryId?: string;
      };

      const conditions: string[] = ['active = true'];
      const params: unknown[] = [];

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
          cost_price::float AS "costPrice",
          stock_quantity AS "stockQuantity",
          min_stock_threshold AS "minStockThreshold",
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

  // GET /api/categories
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

  // GET /api/settings
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
