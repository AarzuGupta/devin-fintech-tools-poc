import type { ReactNode } from "react";
import type { Actor } from "@/lib/auth/roles";
import { DemoIdentitySwitcher } from "./DemoIdentitySwitcher";
import { NavLinks } from "./NavLinks";

interface AppShellProps {
  actor: Actor;
  demoUsers: { id: string; name: string; role: string }[];
  children: ReactNode;
}

export function AppShell({ actor, demoUsers, children }: AppShellProps) {
  return (
    <div className="grid h-screen grid-rows-[48px_1fr]">
      <header className="flex items-center justify-between border-b border-stroke bg-surface px-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded bg-brand text-xs font-bold text-white">
            IT
          </span>
          <span className="font-semibold">Internal Tools</span>
          <span className="text-stroke" aria-hidden>
            |
          </span>
          <span className="text-fg-muted">Compliance operations</span>
        </div>
        <DemoIdentitySwitcher current={actor} users={demoUsers} />
      </header>
      <div className="grid min-h-0 grid-cols-[200px_1fr]">
        <nav aria-label="Primary" className="border-r border-stroke bg-[#fafafa] p-2">
          <p className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-fg-muted uppercase">Compliance</p>
          <NavLinks isAdmin={actor.role === "ADMIN"} />
        </nav>
        <main className="flex min-h-0 min-w-0 flex-col">{children}</main>
      </div>
    </div>
  );
}
