"use client";

import { ClipboardTaskListLtr20Regular, History20Regular } from "@fluentui/react-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/kyc", label: "KYC review", icon: ClipboardTaskListLtr20Regular, adminOnly: false },
  { href: "/audit", label: "Audit log", icon: History20Regular, adminOnly: true },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {ITEMS.filter((item) => isAdmin || !item.adminOnly).map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-9 items-center gap-2.5 rounded px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-brand ${
                active ? "bg-surface font-semibold text-fg shadow-[0_0_0_1px_var(--color-stroke)]" : "text-fg hover:bg-[#ebebeb]"
              }`}
            >
              {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded bg-brand" />}
              <Icon className={active ? "text-brand" : "text-fg-muted"} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
