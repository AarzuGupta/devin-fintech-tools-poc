import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requireActor } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();
  const demoUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return (
    <AppShell actor={actor} demoUsers={demoUsers}>
      {children}
    </AppShell>
  );
}
