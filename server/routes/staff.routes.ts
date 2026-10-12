import { FastifyPluginAsync } from 'fastify';
import { requireRole } from '../middleware/auth';
import { hashCredential } from '../auth/crypto';
import { logSecurityAudit } from '../auth/service';
import { query } from '../db/pool';
import { UserRole } from '../../src/types';

export const staffRoutes: FastifyPluginAsync = async (fastify) => {
  // All staff routes require ADMIN role
  fastify.addHook('preHandler', requireRole(['ADMIN']));

  // GET /api/staff
  fastify.get('/api/staff', async (_request, reply) => {
    try {
      const res = await query(
        `SELECT 
           id, name, email, role, active, pin,
           failed_login_attempts AS "failedLoginAttempts",
           last_login_at AS "lastLoginAt",
           created_at AS "createdAt"
         FROM users
         ORDER BY created_at ASC;`
      );

      return reply.status(200).send({
        success: true,
        count: res.rowCount,
        users: res.rows,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error retrieving staff list');
      return reply.status(500).send({ success: false, error: 'Failed to retrieve staff directory.' });
    }
  });

  // POST /api/staff
  fastify.post('/api/staff', async (request, reply) => {
    try {
      const { name, email, role, credential } = request.body as {
        name?: string;
        email?: string;
        role?: UserRole;
        credential?: string;
      };

      if (!name || !name.trim()) {
        return reply.status(400).send({ success: false, error: 'Staff name is required.' });
      }
      if (!email || !email.trim()) {
        return reply.status(400).send({ success: false, error: 'Staff email/username is required.' });
      }
      if (!role || !['ADMIN', 'CASHIER', 'INVENTORY'].includes(role)) {
        return reply.status(400).send({ success: false, error: 'Valid role is required (ADMIN, CASHIER, INVENTORY).' });
      }

      const initialCred = credential && credential.trim() ? credential.trim() : '1234';
      const passwordHash = await hashCredential(initialCred);

      const res = await query(
        `INSERT INTO users (name, email, role, active, password_hash, pin)
         VALUES ($1, $2, $3, TRUE, $4, $5)
         RETURNING id, name, email, role, active, created_at AS "createdAt";`,
        [name.trim(), email.trim().toLowerCase(), role, passwordHash, initialCred]
      );

      const newUser = res.rows[0];

      if (request.currentUser) {
        await logSecurityAudit(
          request.currentUser.id,
          request.currentUser.name,
          'STAFF_CREATE',
          `Created staff member ${newUser.name} with role ${newUser.role}`,
          request.ip
        );
      }

      return reply.status(201).send({
        success: true,
        user: newUser,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('unique constraint') || msg.includes('users_email_key')) {
        return reply.status(409).send({ success: false, error: 'An account with this email already exists.' });
      }
      fastify.log.error(err, 'Error creating staff member');
      return reply.status(500).send({ success: false, error: 'Failed to create staff member.' });
    }
  });

  // PATCH /api/staff/:id (Update details or toggle active)
  fastify.patch('/api/staff/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { name, email, role, active } = request.body as {
        name?: string;
        email?: string;
        role?: UserRole;
        active?: boolean;
      };

      // Check user exists
      const existingRes = await query(`SELECT id, name, email, role, active FROM users WHERE id = $1;`, [id]);
      if (existingRes.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Staff member not found.' });
      }

      const existing = existingRes.rows[0];

      // Prevent deactivating own account
      if (active === false && request.currentUser && request.currentUser.id === id) {
        return reply.status(400).send({ success: false, error: 'You cannot deactivate your own account.' });
      }

      const updatedName = name !== undefined ? name.trim() : existing.name;
      const updatedEmail = email !== undefined ? email.trim().toLowerCase() : existing.email;
      const updatedRole = role !== undefined ? role : existing.role;
      const updatedActive = active !== undefined ? active : existing.active;

      const res = await query(
        `UPDATE users
         SET name = $1, email = $2, role = $3, active = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING id, name, email, role, active, created_at AS "createdAt";`,
        [updatedName, updatedEmail, updatedRole, updatedActive, id]
      );

      const updated = res.rows[0];

      if (request.currentUser) {
        const action = active !== undefined && active !== existing.active ? (active ? 'STAFF_ACTIVATE' : 'STAFF_DEACTIVATE') : 'STAFF_UPDATE';
        await logSecurityAudit(
          request.currentUser.id,
          request.currentUser.name,
          action,
          `Updated staff member ${updated.name}: active=${updated.active}, role=${updated.role}`,
          request.ip
        );
      }

      return reply.status(200).send({
        success: true,
        user: updated,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error updating staff member');
      return reply.status(500).send({ success: false, error: 'Failed to update staff member.' });
    }
  });

  // PATCH /api/staff/:id/credential (Reset password or PIN)
  fastify.patch('/api/staff/:id/credential', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { credential } = request.body as { credential?: string };

      if (!credential || credential.trim().length < 4) {
        return reply.status(400).send({ success: false, error: 'Credential must be at least 4 characters.' });
      }

      const passwordHash = await hashCredential(credential.trim());

      const res = await query(
        `UPDATE users
         SET password_hash = $1, pin = $2, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
         WHERE id = $3
         RETURNING id, name;`,
        [passwordHash, credential.trim(), id]
      );

      if (res.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Staff member not found.' });
      }

      if (request.currentUser) {
        await logSecurityAudit(
          request.currentUser.id,
          request.currentUser.name,
          'STAFF_PASSWORD_RESET',
          `Reset credential for staff member ${res.rows[0].name}`,
          request.ip
        );
      }

      return reply.status(200).send({
        success: true,
        message: 'Credential reset successfully.',
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error resetting credential');
      return reply.status(500).send({ success: false, error: 'Failed to reset credential.' });
    }
  });

  // GET /api/audit-logs
  fastify.get('/api/audit-logs', async (_request, reply) => {
    try {
      const res = await query(
        `SELECT 
           id, user_id AS "userId", user_name AS "userName",
           action_type AS "actionType", entity_type AS "entityType", entity_id AS "entityId",
           previous_value AS "previousValue", new_value AS "newValue", details,
           created_at AS "timestamp"
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 100;`
      );

      return reply.status(200).send({
        success: true,
        count: res.rowCount,
        auditLogs: res.rows,
      });
    } catch (err: unknown) {
      fastify.log.error(err, 'Error retrieving audit logs');
      return reply.status(500).send({ success: false, error: 'Failed to retrieve audit trail.' });
    }
  });
};
