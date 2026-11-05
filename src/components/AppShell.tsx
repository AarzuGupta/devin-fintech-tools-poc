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
    <div className="grid h-screen grid-rows-[52px_1fr]">
      <header className="flex items-center justify-between border-b border-stroke bg-surface px-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-fg text-[11px] font-semibold text-white">
            IT
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.01em]">Internal Tools</span>
          <span aria-hidden className="h-4 w-px bg-stroke" />
          <span className="text-fg-muted">Compliance operations</span>
        </div>
        <DemoIdentitySwitcher current={actor} users={demoUsers} />
      </header>
      <div className="grid min-h-0 grid-cols-[208px_1fr]">
        <nav aria-label="Primary" className="border-r border-stroke bg-sidebar px-3 py-4">
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Compliance</p>
          <NavLinks isAdmin={actor.role === "ADMIN"} />
        </nav>
        <main className="flex min-h-0 min-w-0 flex-col">{children}</main>
      </div>
    </div>
  );
}
