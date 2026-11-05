import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { Actor } from "./roles";
import { resolveActor, SESSION_COOKIE } from "./session";

export async function getCurrentActor(): Promise<Actor | null> {
  const store = await cookies();
  return resolveActor(prisma, store.get(SESSION_COOKIE)?.value);
}
