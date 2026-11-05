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
      <div className="w-full max-w-lg rounded border border-stroke bg-surface shadow-sm">
        <div className="border-b border-stroke px-6 py-4">
          <h1 className="text-lg font-semibold">Internal Tools · Choose a demo identity</h1>
          <p className="mt-1 text-fg-muted">Synthetic data only.</p>
        </div>
        <div role="note" className="mx-6 mt-4 rounded border border-[#f4bfab] bg-[#fdf6f3] px-3 py-2 text-[13px] text-[#8a3707]">
          <strong>Demo impersonation, not authentication.</strong> Anyone can pick any identity below. Production use
          requires SSO (e.g. OIDC with your identity provider) and server-managed role assignment.
        </div>
        <ul className="space-y-2 p-6">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 rounded border border-stroke px-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-semibold">
                  {u.name} <RoleBadge role={u.role} />
                </div>
                <p className="text-[12px] text-fg-muted">{ROLE_DESCRIPTIONS[u.role]}</p>
              </div>
              <DemoSignInButton userId={u.id} name={u.name} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
