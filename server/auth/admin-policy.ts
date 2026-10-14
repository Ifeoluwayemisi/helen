/**
 * Administrative safety policy.
 *
 * The store must never be left with zero active administrators: deactivating
 * or demoting the final active admin would strand the terminal so nobody can
 * sign in (and first-owner setup intentionally never re-opens once an admin
 * exists).
 */

export interface AdminSubject {
  role: string;
  active: boolean;
}

/**
 * Returns true when applying the proposed change would remove the last active
 * administrator, which must be rejected.
 *
 * A change "removes" an active admin when the target is currently an active
 * ADMIN and either its role moves away from ADMIN or it is deactivated. The
 * change is only disallowed when that would leave one or zero active admins.
 */
export function wouldRemoveLastActiveAdmin(
  existing: AdminSubject,
  updatedRole: string,
  updatedActive: boolean,
  activeAdminCount: number,
): boolean {
  const removesActiveAdmin =
    existing.role === "ADMIN" &&
    existing.active &&
    (updatedRole !== "ADMIN" || updatedActive === false);
  return removesActiveAdmin && activeAdminCount <= 1;
}
