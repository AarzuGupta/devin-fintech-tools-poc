"use client";

import { Badge } from "@fluentui/react-components";
import {
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  Warning16Filled,
} from "@fluentui/react-icons";
import { RISK_LABELS, STATUS_LABELS } from "@/lib/format";

const STATUS_COLORS = {
  PENDING: "brand",
  ESCALATED: "warning",
  APPROVED: "success",
  REJECTED: "danger",
} as const;

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? "informative";
  return (
    <Badge appearance="tint" shape="rounded" color={color} data-testid="status-badge">
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const RISK_STYLES: Record<string, string> = {
  HIGH: "bg-[#c50f1f]",
  MEDIUM: "bg-[#da7b11]",
  LOW: "bg-[#107c10]",
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
  if (outcome === "PASS") return <CheckmarkCircle16Filled className="text-[#107c10]" aria-label="Pass" />;
  if (outcome === "FAIL") return <DismissCircle16Filled className="text-[#c50f1f]" aria-label="Fail" />;
  return <Warning16Filled className="text-[#da7b11]" aria-label="Needs review" />;
}

export function RoleBadge({ role }: { role: string }) {
  const label = role.charAt(0) + role.slice(1).toLowerCase();
  return (
    <Badge appearance="outline" shape="rounded" size="small" color={role === "ADMIN" ? "important" : "informative"}>
      {label}
    </Badge>
  );
}
