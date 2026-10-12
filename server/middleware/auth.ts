import { FastifyRequest, FastifyReply } from 'fastify';
import { validateSession, SESSION_COOKIE_NAME, AuthenticatedUser } from '../auth/service';
import { UserRole } from '../../src/types';

// Augment FastifyRequest to include currentUser
declare module 'fastify' {
  interface FastifyRequest {
    currentUser?: AuthenticatedUser;
    sessionToken?: string;
  }
}

/**
 * Extracts and validates the session token from cookie or Authorization header.
 * Attaches request.currentUser if valid.
 */
export async function authenticateRequest(request: FastifyRequest): Promise<void> {
  let token: string | undefined;

  // 1. Try reading from signed or unsigned cookie
  if (request.cookies && request.cookies[SESSION_COOKIE_NAME]) {
    token = request.cookies[SESSION_COOKIE_NAME];
  }

  // 2. Fallback to Authorization: Bearer <token>
  if (!token && request.headers.authorization) {
    const parts = request.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      token = parts[1];
    }
  }

  if (token) {
    request.sessionToken = token;
    const user = await validateSession(token);
    if (user) {
      request.currentUser = user;
    }
  }
}

/**
 * Route guard that requires an active authenticated session.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticateRequest(request);

  if (!request.currentUser) {
    return reply.status(401).send({
      success: false,
      error: 'Authentication required. Please sign in to access this resource.',
    });
  }
}

/**
 * Route guard that restricts access based on operational roles.
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authenticateRequest(request);

    if (!request.currentUser) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required. Please sign in.',
      });
    }

    if (!allowedRoles.includes(request.currentUser.role)) {
      return reply.status(403).send({
        success: false,
        error: `Access denied. This action requires one of the following roles: [${allowedRoles.join(', ')}].`,
      });
    }
  };
}
