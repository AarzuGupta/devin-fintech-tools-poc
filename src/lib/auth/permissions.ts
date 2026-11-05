import { AppError } from "@/lib/errors";
import type { Actor, Role } from "./roles";

export type Permission =
  | "kyc:read"
  | "kyc:decide-pending"
  | "kyc:resolve-escalated"
  | "audit:read-all"
  | "refunds:read";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  VIEWER: ["kyc:read", "refunds:read"],
  ANALYST: ["kyc:read", "kyc:decide-pending", "refunds:read"],
  ADMIN: ["kyc:read", "kyc:decide-pending", "kyc:resolve-escalated", "audit:read-all", "refunds:read"],
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
