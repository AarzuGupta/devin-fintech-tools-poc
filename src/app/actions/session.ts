"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

/**
 * DEMO IMPERSONATION: anyone can become any seeded user. This exists only so
 * reviewers can try each role. It is not authentication and must be replaced by
 * SSO (e.g. OIDC) before any real use.
 */
export async function switchDemoUser(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) redirect("/sign-in?error=unknown-user");

  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  redirect("/kyc");
}

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}
