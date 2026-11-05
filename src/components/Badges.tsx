import {
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  Warning16Filled,
} from "@fluentui/react-icons";
import { RISK_LABELS, STATUS_LABELS } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-[#eaf2fc] text-[#0a4d8c] ring-[#cfe0f5]",
  ESCALATED: "bg-[#fdf4e3] text-[#8a4b00] ring-[#f2dcb0]",
  APPROVED: "bg-[#eaf6ee] text-[#1b6b3a] ring-[#c9e7d4]",
  REJECTED: "bg-[#fdeeee] text-[#a1232b] ring-[#f4d0d2]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      data-testid="status-badge"
      className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[12px] font-medium whitespace-nowrap ring-1 ring-inset ${
        STATUS_STYLES[status] ?? "bg-[#f0f0f2] text-fg-muted ring-stroke"
      }`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-[#d70015]",
  MEDIUM: "bg-[#c77700]",
  LOW: "bg-[#248a3d]",
};

export function RiskIndicator({ tier }: { tier: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${RISK_STYLES[tier] ?? "bg-gray-400"}`} />
      {RISK_LABELS[tier] ?? tier}
    </span>
  );
}

export function SignalOutcomeIcon({ outcome }: { outcome: string }) {
  if (outcome === "PASS") return <CheckmarkCircle16Filled className="text-[#248a3d]" aria-label="Pass" />;
  if (outcome === "FAIL") return <DismissCircle16Filled className="text-[#d70015]" aria-label="Fail" />;
  return <Warning16Filled className="text-[#c77700]" aria-label="Needs review" />;
}

export function RoleBadge({ role }: { role: string }) {
  const label = role.charAt(0) + role.slice(1).toLowerCase();
  return (
    <span
      className={`inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-[11px] font-medium ${
        role === "ADMIN" ? "bg-[#efeafc] text-[#5b3cc4]" : "bg-[#f0f0f2] text-[#55555a]"
      }`}
    >
      {label}
    </span>
  );
}
