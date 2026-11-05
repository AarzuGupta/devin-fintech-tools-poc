import { createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { isRole, type Actor } from "./roles";

/**
 * DEMO SESSION ONLY. The cookie carries a user ID signed with HMAC-SHA256 so the
 * client cannot forge or alter it; the role is always looked up server-side.
 * This is not production authentication (no SSO, MFA, expiry rotation, etc.).
 */
export const SESSION_COOKIE = "demo_session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function signSession(userId: string): string {
  const payload = Buffer.from(userId, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the user ID if the token is authentic, otherwise null. */
export function verifySession(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  const userId = Buffer.from(payload, "base64url").toString("utf8");
  return userId || null;
}

/** Resolves a session token to an actor using the database as the source of truth for role. */
export async function resolveActor(
  db: Pick<PrismaClient, "user">,
  token: string | null | undefined,
): Promise<Actor | null> {
  const userId = verifySession(token);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !isRole(user.role)) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
