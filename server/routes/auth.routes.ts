import { FastifyPluginAsync } from "fastify";
import {
  authenticateCredentials,
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  checkFirstOwnerExists,
  logSecurityAudit,
} from "../auth/service";
import { hashCredential } from "../auth/crypto";
import { query } from "../db/pool";
import { authenticateRequest } from "../middleware/auth";
import { config } from "../config";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post("/api/auth/login", async (request, reply) => {
    const { email, credential } = request.body as {
      email?: string;
      credential?: string;
    };

    if (!email || !email.trim()) {
      return reply
        .status(400)
        .send({
          success: false,
          error: "Email or login identifier is required.",
        });
    }
    if (!credential || !credential.trim()) {
      return reply
        .status(400)
        .send({ success: false, error: "Password or PIN is required." });
    }

    const authResult = await authenticateCredentials(
      email,
      credential,
      request.ip,
    );

    if (!authResult.success || !authResult.user) {
      return reply
        .status(401)
        .send({
          success: false,
          error: authResult.error || "Authentication failed",
        });
    }

    const user = authResult.user;
    const { rawToken, expiresAt } = await createSession(
      user.id,
      request.ip,
      request.headers["user-agent"],
    );

    // Set secure HTTP-only session cookie
    reply.setCookie(SESSION_COOKIE_NAME, rawToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
      expires: expiresAt,
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return reply.status(200).send({
      success: true,
      user,
    });
  });

  // POST /api/auth/logout
  fastify.post("/api/auth/logout", async (request, reply) => {
    await authenticateRequest(request);

    if (request.sessionToken) {
      await revokeSession(request.sessionToken);
      if (request.currentUser) {
        await logSecurityAudit(
          request.currentUser.id,
          request.currentUser.name,
          "LOGOUT",
          "Staff member signed out",
          request.ip,
        );
      }
    }

    reply.clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: config.nodeEnv === "production",
    });

    return reply
      .status(200)
      .send({ success: true, message: "Signed out successfully." });
  });

  // GET /api/auth/me
  fastify.get("/api/auth/me", async (request, reply) => {
    await authenticateRequest(request);

    if (!request.currentUser) {
      return reply.status(401).send({
        success: false,
        error: "Not authenticated. Session is missing or expired.",
      });
    }

    return reply.status(200).send({
      success: true,
      user: request.currentUser,
    });
  });

  // GET /api/auth/setup-status
  fastify.get("/api/auth/setup-status", async (_request, reply) => {
    const hasOwner = await checkFirstOwnerExists();
    return reply.status(200).send({
      success: true,
      hasOwner,
    });
  });

  // POST /api/auth/setup-owner (Safe first-owner provisioning)
  fastify.post("/api/auth/setup-owner", async (request, reply) => {
    const hasOwner = await checkFirstOwnerExists();
    if (hasOwner) {
      return reply.status(403).send({
        success: false,
        error: "Store owner has already been provisioned.",
      });
    }

    const { name, email, credential } = request.body as {
      name?: string;
      email?: string;
      credential?: string;
    };

    if (!name || !name.trim()) {
      return reply
        .status(400)
        .send({ success: false, error: "Full name is required." });
    }
    if (!email || !email.trim()) {
      return reply
        .status(400)
        .send({ success: false, error: "Email is required." });
    }
    if (!credential || credential.length < 4) {
      return reply
        .status(400)
        .send({
          success: false,
          error: "Password or PIN must be at least 4 characters.",
        });
    }

    const passwordHash = await hashCredential(credential);
    const userId = `a0000000-0000-0000-0000-000000000001`;

    await query(
      `INSERT INTO users (id, name, email, role, active, password_hash)
       VALUES ($1, $2, $3, 'ADMIN', TRUE, $4)
       ON CONFLICT (email) DO UPDATE SET password_hash = $4, pin = NULL, active = TRUE;`,
      [userId, name.trim(), email.trim().toLowerCase(), passwordHash],
    );

    await logSecurityAudit(
      userId,
      name.trim(),
      "FIRST_OWNER_PROVISIONED",
      "Initial store owner provisioned",
      request.ip,
    );

    return reply.status(201).send({
      success: true,
      message: "Store owner provisioned successfully.",
      user: {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: "ADMIN",
        active: true,
      },
    });
  });
};
