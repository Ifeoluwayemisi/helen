import { query, getClient } from "../db/pool";
import {
  generateSessionToken,
  hashSessionToken,
  hashCredential,
  verifyCredential,
} from "./crypto";
import { User, UserRole } from "../../src/types";

export const SESSION_COOKIE_NAME = "hs_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/**
 * Single, uniform login failure message. Returned for every failure mode
 * (unknown account, wrong credential, deactivated, locked) so responses can
 * never be used to enumerate which accounts exist. The specific reason is
 * retained only in the security audit log.
 */
export const GENERIC_LOGIN_ERROR = "Invalid email or credential";

export interface AuthSession {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

/**
 * Creates a new session in PostgreSQL for the given user.
 */
export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await query(
    `INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5);`,
    [
      tokenHash,
      userId,
      expiresAt.toISOString(),
      ipAddress || null,
      userAgent || null,
    ],
  );

  return { rawToken, expiresAt };
}

/**
 * Validates a session token from an HTTP-only cookie or Bearer header.
 */
export async function validateSession(
  rawToken: string,
): Promise<AuthenticatedUser | null> {
  if (!rawToken || rawToken.length < 32) return null;

  const tokenHash = hashSessionToken(rawToken);

  const res = await query(
    `SELECT 
       u.id, u.name, u.email, u.role, u.active, u.created_at AS "createdAt",
       u.locked_until AS "lockedUntil",
       s.expires_at AS "expiresAt"
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1;`,
    [tokenHash],
  );

  if (res.rowCount === 0) return null;

  const row = res.rows[0];
  const now = new Date();

  // Check expiration
  if (new Date(row.expiresAt) <= now) {
    // Delete expired session
    await query(`DELETE FROM sessions WHERE id = $1;`, [tokenHash]);
    return null;
  }

  // Check user active status and account lockout
  if (!row.active) {
    return null;
  }

  if (row.lockedUntil && new Date(row.lockedUntil) > now) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    active: row.active,
    createdAt: row.createdAt,
  };
}

/**
 * Revokes a session (logs out).
 */
export async function revokeSession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  const tokenHash = hashSessionToken(rawToken);
  await query(`DELETE FROM sessions WHERE id = $1;`, [tokenHash]);
}

/**
 * Authenticates user credentials with rate limiting and lockout protection.
 */
export async function authenticateCredentials(
  email: string,
  credential: string,
  ipAddress?: string,
): Promise<{ success: boolean; user?: AuthenticatedUser; error?: string }> {
  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, name, email, role, active, password_hash, pin, failed_login_attempts, locked_until, created_at AS "createdAt"
     FROM users
     WHERE LOWER(email) = $1;`,
    [normalizedEmail],
  );

  if (userRes.rowCount === 0) {
    await logSecurityAudit(
      null,
      normalizedEmail,
      "LOGIN_FAILED",
      `Login failed: Unknown account ${normalizedEmail}`,
      ipAddress,
    );
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  const user = userRes.rows[0];
  const now = new Date();

  // Check account active status
  if (!user.active) {
    await logSecurityAudit(
      user.id,
      user.name,
      "LOGIN_BLOCKED",
      `Login blocked: Account is deactivated`,
      ipAddress,
    );
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  // Check lockout status
  if (user.locked_until && new Date(user.locked_until) > now) {
    const remainingMins = Math.ceil(
      (new Date(user.locked_until).getTime() - now.getTime()) / 60000,
    );
    await logSecurityAudit(
      user.id,
      user.name,
      "LOGIN_LOCKED",
      `Login attempt on locked account (${remainingMins} mins remaining)`,
      ipAddress,
    );
    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  // Verify credential (first check password_hash via scrypt, fallback to pin comparison)
  let isValid = false;

  if (user.password_hash) {
    isValid = await verifyCredential(credential, user.password_hash);
  } else if (user.pin && credential === user.pin) {
    // If user has old plaintext pin, upgrade it to scrypt hash immediately!
    isValid = true;
    const newHash = await hashCredential(credential);
    await query(
      `UPDATE users SET password_hash = $1, pin = NULL WHERE id = $2;`,
      [newHash, user.id],
    );
  }

  if (!isValid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockoutSql = "";
    const params: unknown[] = [attempts, user.id];

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockDate = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      lockoutSql = `, locked_until = $3`;
      params.push(lockDate.toISOString());
    }

    await query(
      `UPDATE users SET failed_login_attempts = $1${lockoutSql} WHERE id = $2;`,
      params,
    );

    await logSecurityAudit(
      user.id,
      user.name,
      "LOGIN_FAILED",
      `Incorrect credential attempt ${attempts}/${MAX_FAILED_ATTEMPTS}`,
      ipAddress,
    );

    return { success: false, error: GENERIC_LOGIN_ERROR };
  }

  // Successful authentication -> Reset failed attempts
  await query(
    `UPDATE users 
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() 
     WHERE id = $1;`,
    [user.id],
  );

  await logSecurityAudit(
    user.id,
    user.name,
    "LOGIN_SUCCESS",
    `Staff member signed in successfully`,
    ipAddress,
  );

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      active: user.active,
      createdAt: user.createdAt,
    },
  };
}

/**
 * Records an immutable security audit event in PostgreSQL.
 */
export async function logSecurityAudit(
  userId: string | null,
  userName: string,
  actionType: string,
  details: string,
  ipAddress?: string,
): Promise<void> {
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const entityId = userId || "system";
  const extraDetails = ipAddress ? `${details} (IP: ${ipAddress})` : details;

  await query(
    `INSERT INTO audit_logs (id, user_id, user_name, action_type, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, 'AUTH', $5, $6);`,
    [auditId, userId, userName, actionType, entityId, extraDetails],
  );
}

/**
 * Checks whether the store already has an Administrator account.
 *
 * Counts admins regardless of `active` so that temporarily deactivating the
 * owner can never re-open first-owner provisioning (which could otherwise
 * create a second admin or strand the terminal at an unusable setup screen).
 */
export async function checkFirstOwnerExists(): Promise<boolean> {
  const res = await query(
    `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1;`,
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Stable advisory-lock key that serializes first-owner provisioning across
 * concurrent requests and server instances sharing one database.
 */
export const FIRST_OWNER_SETUP_LOCK_KEY = 762001001;

/**
 * Minimal structural view of a pooled PostgreSQL client used for
 * first-owner provisioning. Kept narrow so the atomic logic can be exercised
 * without a real database.
 */
export interface ProvisionQueryClient {
  query(
    text: string,
    params?: unknown[],
  ): Promise<{ rowCount: number | null; rows?: unknown[] }>;
  release(): void;
}

/**
 * Atomically provisions the single initial store owner.
 *
 * Concurrency guarantees (all enforced by the database, not a prior SELECT):
 * - `pg_advisory_xact_lock` serializes competing provisioning attempts for the
 *   duration of the transaction, so only the first can observe "no owner".
 * - `ON CONFLICT DO NOTHING` never updates an existing row, so a conflicting
 *   id or email can never overwrite existing credentials; the attempt simply
 *   reports `provisioned: false`.
 *
 * Any existing Administrator (active or not) blocks provisioning, matching
 * `checkFirstOwnerExists`.
 */
export async function provisionFirstOwner(
  client: ProvisionQueryClient,
  params: {
    userId: string;
    name: string;
    email: string;
    passwordHash: string;
  },
): Promise<{ provisioned: boolean }> {
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [
      FIRST_OWNER_SETUP_LOCK_KEY,
    ]);

    const existing = await client.query(
      `SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1;`,
    );
    if ((existing.rowCount ?? 0) > 0) {
      await client.query("COMMIT");
      return { provisioned: false };
    }

    const inserted = await client.query(
      `INSERT INTO users (id, name, email, role, active, password_hash)
       VALUES ($1, $2, $3, 'ADMIN', TRUE, $4)
       ON CONFLICT DO NOTHING
       RETURNING id;`,
      [params.userId, params.name, params.email, params.passwordHash],
    );

    await client.query("COMMIT");
    return { provisioned: (inserted.rowCount ?? 0) > 0 };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
