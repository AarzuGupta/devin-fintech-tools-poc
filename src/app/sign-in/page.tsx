import { redirect } from "next/navigation";
import { RoleBadge } from "@/components/Badges";
import { DemoSignInButton } from "@/components/DemoSignInButton";
import { getCurrentActor } from "@/lib/auth/current";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  VIEWER: "Read-only access to the KYC queue and case details.",
  ANALYST: "Can approve, reject, or escalate pending cases.",
  ADMIN: "Analyst permissions, plus resolving escalated cases and viewing the global audit log.",
};

export default async function SignInPage() {
  if (await getCurrentActor()) redirect("/kyc");
  const users = await prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] });

  return (
    <div className="grid min-h-full place-items-center p-6">
      <div className="w-full max-w-lg rounded-xl border border-stroke bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3 px-6 pt-6 pb-2">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-[10px] bg-fg text-[12px] font-semibold text-white">
            IT
          </span>
          <div>
            <h1 className="text-[17px] leading-6 font-semibold tracking-[-0.01em]">Choose a demo identity</h1>
            <p className="text-fg-muted">Internal Tools · synthetic data only</p>
          </div>
        </div>
        <div role="note" className="mx-6 mt-4 rounded-[10px] border border-[#f2dcb0] bg-[#fdf6ea] px-3 py-2.5 text-[#8a4b00]">
          <strong>Demo impersonation, not authentication.</strong> Anyone can pick any identity below. Production use
          requires SSO (e.g. OIDC with your identity provider) and server-managed role assignment.
        </div>
        <ul className="m-6 divide-y divide-stroke-subtle overflow-hidden rounded-[10px] border border-stroke">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {u.name} <RoleBadge role={u.role} />
                </div>
                <p className="mt-0.5 text-[12px] text-fg-muted">{ROLE_DESCRIPTIONS[u.role]}</p>
              </div>
              <DemoSignInButton userId={u.id} name={u.name} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
