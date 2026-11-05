import { AppError } from "@/lib/errors";
import type { Actor, Role } from "./roles";

export type Permission =
  | "kyc:read"
  | "kyc:decide-pending"
  | "kyc:resolve-escalated"
  | "audit:read-all";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VIEWER: ["kyc:read"],
  ANALYST: ["kyc:read", "kyc:decide-pending"],
  ADMIN: ["kyc:read", "kyc:decide-pending", "kyc:resolve-escalated", "audit:read-all"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Throws unless an authenticated actor holds the permission. */
export function requirePermission(
  actor: Actor | null | undefined,
  permission: Permission,
): asserts actor is Actor {
  if (!actor) throw new AppError("UNAUTHENTICATED", "Sign in to continue.");
  if (!hasPermission(actor.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.");
  }
}
