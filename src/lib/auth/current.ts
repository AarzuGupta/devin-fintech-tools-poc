import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import type { Actor } from "./roles";
import { resolveActor, SESSION_COOKIE } from "./session";

export async function getCurrentActor(): Promise<Actor | null> {
  const store = await cookies();
  return resolveActor(prisma, store.get(SESSION_COOKIE)?.value);
}

/** For pages: redirect anonymous visitors to the demo sign-in screen. */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) redirect("/sign-in");
  return actor;
}
