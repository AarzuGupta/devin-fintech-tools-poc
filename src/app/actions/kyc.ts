"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/auth/current";
import { prisma } from "@/lib/db";
import { isAppError, type AppErrorCode } from "@/lib/errors";
import { decideCase } from "@/lib/services/kycService";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode | "INTERNAL"; message: string };

/**
 * The actor is always derived from the signed session cookie. The input schema is
 * strict, so any client-supplied role/actor fields are rejected outright.
 */
export async function decideCaseAction(input: unknown): Promise<ActionResult<Awaited<ReturnType<typeof decideCase>>>> {
  try {
    const actor = await getCurrentActor();
    const result = await decideCase(prisma, actor, input);
    revalidatePath("/kyc");
    revalidatePath("/audit");
    return { ok: true, data: result };
  } catch (error) {
    if (isAppError(error)) return { ok: false, code: error.code, message: error.message };
    console.error("decideCaseAction failed", error);
    return { ok: false, code: "INTERNAL", message: "Something went wrong. Please try again." };
  }
}
