import { FastifyPluginAsync } from "fastify";
import {
  authenticateCredentials,
  createSession,
  revokeSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  checkFirstOwnerExists,
  provisionFirstOwner,
  logSecurityAudit,
} from "../auth/service";
import { hashCredential } from "../auth/crypto";
import { getClient } from "../db/pool";
import { authenticateRequest } from "../middleware/auth";
import { config } from "../config";

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/login
  fastify.post("/api/auth/login", async (request, reply) => {
    const body = (request.body ?? {}) as {
      email?: unknown;
      credential?: unknown;
    };
    const email = typeof body.email === "string" ? body.email : "";
    const credential =
      typeof body.credential === "string" ? body.credential : "";

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
      // Production serves the UI and API on different origins (e.g. a Vercel
      // static site calling a separate Node host), so a Lax cookie would be
      // withheld from every cross-site request. Secure + SameSite=None keeps
      // the HTTP-only session working there; dev stays Lax on one origin.
      sameSite: config.nodeEnv === "production" ? "none" : "lax",
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
      sameSite: config.nodeEnv === "production" ? "none" : "lax",
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
    // Fast-path guard so a provisioned store rejects immediately. The
    // authoritative, concurrency-safe check happens inside the locked
    // transaction in provisionFirstOwner.
    const hasOwner = await checkFirstOwnerExists();
    if (hasOwner) {
      return reply.status(403).send({
        success: false,
        error: "Store owner has already been provisioned.",
      });
    }

    const body = (request.body ?? {}) as {
      name?: unknown;
      email?: unknown;
      credential?: unknown;
    };
    const name = typeof body.name === "string" ? body.name : "";
    const email = typeof body.email === "string" ? body.email : "";
    const credential =
      typeof body.credential === "string" ? body.credential : "";

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
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const client = await getClient();
    const { provisioned } = await provisionFirstOwner(client, {
      userId,
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,
    });

    // A conflicting id/email (or a concurrently provisioned owner) means we
    // intentionally did not write anything. Report the same generic message
    // so the response never reveals whether an account already exists.
    if (!provisioned) {
      return reply.status(403).send({
        success: false,
        error: "Store owner has already been provisioned.",
      });
    }

    await logSecurityAudit(
      userId,
      normalizedName,
      "FIRST_OWNER_PROVISIONED",
      "Initial store owner provisioned",
      request.ip,
    );

    return reply.status(201).send({
      success: true,
      message: "Store owner provisioned successfully.",
      user: {
        id: userId,
        name: normalizedName,
        email: normalizedEmail,
        role: "ADMIN",
        active: true,
      },
    });
  });
};
